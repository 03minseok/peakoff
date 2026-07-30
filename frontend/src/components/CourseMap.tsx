import { useEffect, useRef } from 'react'
import { useKakaoSdk } from '../hooks/useKakaoSdk'
import type { KakaoCustomOverlay, KakaoMap, KakaoPolyline } from '../types/kakao'
import type { Place } from '../types/api'
import './CourseMap.css'

interface Props {
  /** 지도에 찍을 장소 전체 */
  places: Place[]
  /**
   * 순서대로 이을 경로. 하나의 배열이 하루치다.
   *
   * 편집 화면은 현재 일차 하나만 넘기고, 최종 화면은 전체 일정을 넘긴다.
   * 일차별로 선을 따로 그어야 밤사이 이동이 경로처럼 보이지 않는다.
   */
  routes: string[][]
  /** 없으면 마커를 누를 수 없는 읽기 전용 지도가 된다 */
  onSelect?: (placeId: string) => void
}

/** 경주 시내 근처. 장소를 받기 전 잠깐 보여줄 초기 중심점 */
const FALLBACK_CENTER = { lat: 35.8397, lng: 129.2124 }

/** 경로에서 이 장소의 위치를 찾는다. 없으면 null */
function findInRoutes(routes: string[][], placeId: string) {
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const order = routes[routeIndex].indexOf(placeId)
    if (order >= 0) {
      return { routeIndex, order }
    }
  }
  return null
}

export function CourseMap({ places, routes, onSelect }: Props) {
  const status = useKakaoSdk()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const overlaysRef = useRef<KakaoCustomOverlay[]>([])
  const polylinesRef = useRef<KakaoPolyline[]>([])
  const hasFittedRef = useRef(false)

  /*
   * onSelect를 effect 의존성에 넣으면, 부모가 새 함수를 만들 때마다
   * 마커 전체가 지워졌다 다시 그려진다. 최신 함수를 ref에 담아두고 참조만 한다.
   */
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const interactive = onSelect !== undefined

  // 지도는 한 번만 만든다.
  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || mapRef.current || !window.kakao) {
      return
    }
    const { maps } = window.kakao
    mapRef.current = new maps.Map(containerRef.current, {
      center: new maps.LatLng(FALLBACK_CENTER.lat, FALLBACK_CENTER.lng),
      level: 8,
    })
  }, [status])

  /*
   * 장소나 경로가 바뀌면 마커와 선을 전부 지우고 다시 그린다.
   *
   * 바뀐 것만 골라 고치는 편이 이론상 빠르지만, 장소가 30곳 남짓이라 차이가 없고
   * "지금 화면 = 지금 상태"가 항상 보장되는 쪽이 버그가 훨씬 적다.
   */
  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map || !window.kakao) {
      return
    }
    const { maps } = window.kakao

    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []
    polylinesRef.current.forEach((polyline) => polyline.setMap(null))
    polylinesRef.current = []

    const bounds = new maps.LatLngBounds()
    const multiDay = routes.length > 1

    places.forEach((place) => {
      const position = new maps.LatLng(place.latitude, place.longitude)
      bounds.extend(position)

      const found = findInRoutes(routes, place.id)
      const isSelected = found !== null

      const pin = document.createElement(interactive ? 'button' : 'span')
      if (pin instanceof HTMLButtonElement) {
        pin.type = 'button'
        pin.addEventListener('click', () => onSelectRef.current?.(place.id))
        pin.setAttribute('aria-label', `${place.name} 코스에 추가`)
      }
      pin.className = isSelected ? 'map-pin map-pin--selected' : 'map-pin'
      // 여러 날을 함께 그릴 때는 "2-1"처럼 일차를 붙여야 같은 번호가 겹치지 않는다.
      pin.textContent = found
        ? multiDay
          ? `${found.routeIndex + 1}-${found.order + 1}`
          : String(found.order + 1)
        : ''
      pin.title = place.name

      const overlay = new maps.CustomOverlay({
        position,
        content: pin,
        xAnchor: 0.5,
        yAnchor: 0.5,
        // 담긴 장소가 다른 마커에 가리지 않도록 위로 올린다.
        zIndex: isSelected ? 2 : 1,
        clickable: interactive,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    })

    // 일차마다 따로 선을 긋는다. 두 곳 이상일 때만 의미가 있다.
    routes.forEach((route) => {
      const path = route
        .map((id) => places.find((place) => place.id === id))
        .filter((place): place is Place => place !== undefined)
        .map((place) => new maps.LatLng(place.latitude, place.longitude))

      if (path.length < 2) {
        return
      }
      const polyline = new maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: '#0d9488',
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      })
      polyline.setMap(map)
      polylinesRef.current.push(polyline)
    })

    /*
     * 화면 맞춤은 처음 한 번만. 장소를 담을 때마다 지도가 움직이면
     * 방금 어디를 눌렀는지 놓치게 된다.
     */
    if (!hasFittedRef.current && places.length > 0 && !bounds.isEmpty()) {
      map.setBounds(bounds)
      hasFittedRef.current = true
    }
  }, [places, routes, status, interactive])

  if (status !== 'ready') {
    return <MapPlaceholder status={status} />
  }

  return <div ref={containerRef} className="course-map" />
}

function MapPlaceholder({ status }: { status: 'no-key' | 'loading' | 'error' }) {
  const message = {
    'no-key': '지도 키가 설정되지 않았습니다. 아래 목록으로 코스를 짤 수 있어요.',
    loading: '지도를 불러오는 중…',
    error: '지도를 불러오지 못했습니다. 아래 목록으로 코스를 짤 수 있어요.',
  }[status]

  return (
    <div className="course-map course-map--placeholder">
      <p>{message}</p>
    </div>
  )
}
