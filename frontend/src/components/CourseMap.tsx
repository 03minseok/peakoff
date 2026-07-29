import { useEffect, useRef } from 'react'
import { useKakaoSdk } from '../hooks/useKakaoSdk'
import type { KakaoCustomOverlay, KakaoMap, KakaoPolyline } from '../types/kakao'
import type { Place } from '../types/api'
import './CourseMap.css'

interface Props {
  places: Place[]
  /** 현재 일차에 담긴 장소 ID. 배열 순서가 곧 방문 순서 */
  selectedPlaceIds: string[]
  onSelect: (placeId: string) => void
}

/** 경주 시내 근처. 장소를 받기 전 잠깐 보여줄 초기 중심점 */
const FALLBACK_CENTER = { lat: 35.8397, lng: 129.2124 }

export function CourseMap({ places, selectedPlaceIds, onSelect }: Props) {
  const status = useKakaoSdk()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const overlaysRef = useRef<KakaoCustomOverlay[]>([])
  const polylineRef = useRef<KakaoPolyline | null>(null)
  const hasFittedRef = useRef(false)

  /*
   * onSelect를 effect 의존성에 넣으면, 부모가 새 함수를 만들 때마다
   * 마커 전체가 지워졌다 다시 그려진다. 최신 함수를 ref에 담아두고 참조만 한다.
   */
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

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
   * 장소나 선택이 바뀌면 마커와 선을 전부 지우고 다시 그린다.
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
    polylineRef.current?.setMap(null)
    polylineRef.current = null

    const bounds = new maps.LatLngBounds()

    places.forEach((place) => {
      const position = new maps.LatLng(place.latitude, place.longitude)
      bounds.extend(position)

      const orderIndex = selectedPlaceIds.indexOf(place.id)
      const isSelected = orderIndex >= 0

      const pin = document.createElement('button')
      pin.type = 'button'
      pin.className = isSelected ? 'map-pin map-pin--selected' : 'map-pin'
      pin.textContent = isSelected ? String(orderIndex + 1) : ''
      // 마커에 이름이 안 보이므로, 최소한 읽어줄 수 있게 한다.
      pin.setAttribute('aria-label', `${place.name} 코스에 추가`)
      pin.title = place.name
      pin.addEventListener('click', () => onSelectRef.current(place.id))

      const overlay = new maps.CustomOverlay({
        position,
        content: pin,
        xAnchor: 0.5,
        yAnchor: 0.5,
        // 담긴 장소가 다른 마커에 가리지 않도록 위로 올린다.
        zIndex: isSelected ? 2 : 1,
        clickable: true,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    })

    // 담긴 순서대로 선을 잇는다. 두 곳 이상일 때만 의미가 있다.
    const path = selectedPlaceIds
      .map((id) => places.find((place) => place.id === id))
      .filter((place): place is Place => place !== undefined)
      .map((place) => new maps.LatLng(place.latitude, place.longitude))

    if (path.length >= 2) {
      const polyline = new maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: '#0d9488',
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      })
      polyline.setMap(map)
      polylineRef.current = polyline
    }

    /*
     * 화면 맞춤은 처음 한 번만. 장소를 담을 때마다 지도가 움직이면
     * 방금 어디를 눌렀는지 놓치게 된다.
     */
    if (!hasFittedRef.current && places.length > 0 && !bounds.isEmpty()) {
      map.setBounds(bounds)
      hasFittedRef.current = true
    }
  }, [places, selectedPlaceIds, status])

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
