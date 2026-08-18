import { useEffect, useRef } from 'react'
import { useKakaoSdk } from '../hooks/useKakaoSdk'
import { LEVEL_ON_SOLID } from './levelStyles'
import type { KakaoCustomOverlay, KakaoMap, KakaoPolyline } from '../types/kakao'
import type { CongestionLevel, Place } from '../types/api'

interface Props {
  /** 지도에 찍을 장소 전체 */
  places: Place[]
  /**
   * 장소별 한적도 등급. 담긴 마커의 색이 브랜드색 대신 등급색이 된다.
   *
   * <p>진단 화면에서만 넘긴다. 편집 화면에는 <b>넘기면 안 된다</b> —
   * 첫 코스는 사용자의 의도를 존중하기로 했고, 마커 색으로 점수를 미리 흘리면
   * "직접 짠 코스"가 아니라 시스템이 유도한 코스가 되어 진단의 의미가 사라진다.
   *
   * <p>없으면 지금까지처럼 전부 브랜드색이다.
   */
  levels?: Record<string, CongestionLevel>
  /**
   * 순서대로 이을 경로. 하나의 배열이 하루치다.
   *
   * 편집 화면은 현재 일차 하나만 넘기고, 최종 화면은 전체 일정을 넘긴다.
   * 일차별로 선을 따로 그어야 밤사이 이동이 경로처럼 보이지 않는다.
   */
  routes: string[][]
  /** 없으면 마커를 누를 수 없는 읽기 전용 지도가 된다 */
  onSelect?: (placeId: string) => void
  /**
   * 지도 상자에 덧붙일 클래스. 주로 화면별 높이를 덮어쓰는 데 쓴다.
   *
   * 높이를 컴포넌트 안에서 정하지 않는 이유: 편집 화면은 데스크톱에서 화면 높이만큼
   * 세워 두고, 최종 화면은 본문 흐름에 맞춰 낮게 둔다. 컴포넌트를 나누는 대신
   * 클래스만 바깥에서 받는다.
   */
  className?: string
}

/** 경주 시내 근처. 장소를 받기 전 잠깐 보여줄 초기 중심점 */
const FALLBACK_CENTER = { lat: 35.8397, lng: 129.2124 }

/*
 * isolate(= isolation: isolate)가 있어야 한다.
 *
 * 카카오 지도는 안쪽 요소에 z-index를 직접 매긴다(타일·오버레이·컨트롤). 이 상자가
 * 쌓임 맥락을 만들지 않으면 그 값들이 <b>페이지 최상위로 새어나가</b>, z-index를 주지 않은
 * 바깥 요소 위로 올라온다. overflow-hidden은 보이는 범위만 자를 뿐 쌓임 순서와는 무관하다.
 *
 * 실제로 진단 화면에서 아래에 붙어 따라오는 "최종 코스 확인하기"가 지도와 겹치는 구간에서
 * 지도 뒤로 숨었다. isolate로 안쪽 z-index를 이 상자 안에 가둔다.
 */
const MAP_BOX = 'isolate h-[290px] w-full overflow-hidden rounded-card border border-line'

/*
 * 마커는 React가 아니라 document.createElement로 만들어 카카오 오버레이에 넣는다.
 * Tailwind는 소스를 글자 그대로 훑으므로, 클래스를 이렇게 완성된 문자열로 두어야
 * 빌드에 포함된다. 조립하면 CSS가 생성되지 않는다.
 *
 * 흰 테두리는 border가 아니라 ring 형태의 그림자로 준다. 지도 배경이 무엇이든
 * 마커가 배경에서 떨어져 보이게 하려는 것이고, border와 달리 크기를 밀어내지 않는다.
 */
const PIN_WRAP = 'flex flex-col items-center gap-1'
const PIN_BASE = 'grid place-items-center box-border rounded-full font-mono'
const PIN_DOT =
  'h-3.5 w-3.5 bg-muted shadow-[0_0_0_2px_rgba(255,255,255,0.92),0_2px_6px_rgba(42,62,84,0.18)]'
/*
 * 담긴 장소의 마커. 색만 떼어 두 갈래로 쓴다.
 *
 * 조립한 문자열이지만 Tailwind가 놓치지 않는다 — 붙이는 조각(`bg-brand`, `bg-quiet-strong` …)이
 * 저마다 소스에 글자 그대로 적혀 있기 때문이다. 금지된 것은 `bg-${level}`처럼
 * <b>어디에도 온전히 적혀 있지 않은</b> 이름을 만들어내는 쪽이다.
 */
const PIN_MARKED_SHAPE =
  'h-7 w-auto min-w-7 px-1.5 text-[13px] font-semibold leading-none shadow-[0_0_0_3px_rgba(255,255,255,0.92),0_2px_6px_rgba(42,62,84,0.18)]'
/*
 * 색과 글자색을 항상 <b>짝으로</b> 붙인다. 배경만 갈아끼우면 글자가 묻는 일이 실제로 있었다 —
 * 예전에는 PIN_MARKED_SHAPE에 text-white가 박혀 있었고, 브랜드가 밝은 파스텔로 바뀌던 날
 * 편집 화면 마커의 번호가 배경에 묻어 사라졌다.
 *
 * 등급색은 본문용 LEVEL_SOLID가 아니라 LEVEL_ON_SOLID를 쓴다. 지도 타일 위에서는
 * 본문용 색의 대비가 죽고, 마커 안에 번호가 들어가 글자까지 받아야 하기 때문이다.
 */
const PIN_MARKED = `${PIN_MARKED_SHAPE} bg-brand text-fg`
const PIN_CLICKABLE = 'cursor-pointer hover:bg-brand-hover'
/** 담긴 장소에만 붙는 이름표. 번호만으로는 어디가 어디인지 알 수 없다. */
const PIN_LABEL =
  'rounded-md bg-white/95 px-1.5 py-0.5 text-[11.5px] font-semibold text-fg whitespace-nowrap shadow-[0_1px_3px_rgba(42,62,84,0.12)]'

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

export function CourseMap({ places, routes, levels, onSelect, className = '' }: Props) {
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
      const isMarked = found !== null

      // 이미 담은 곳은 다시 담을 수 없으므로 버튼으로 만들지 않는다.
      const clickable = interactive && !isMarked

      const pin = document.createElement(clickable ? 'button' : 'span')
      if (pin instanceof HTMLButtonElement) {
        pin.type = 'button'
        pin.addEventListener('click', () => onSelectRef.current?.(place.id))
        pin.setAttribute('aria-label', `${place.name} 코스에 추가`)
      }
      // 등급을 받은 곳만 등급색이다. 담기지 않은 주변 장소는 여전히 회색 점이다.
      const level = levels?.[place.id]
      pin.className = [
        PIN_BASE,
        isMarked
          ? level
            ? `${PIN_MARKED_SHAPE} ${LEVEL_ON_SOLID[level]}`
            : PIN_MARKED
          : PIN_DOT,
        // 등급색 마커에 hover로 브랜드색을 덧씌우면 색이 뜻하는 바가 흔들린다.
        clickable && !level ? PIN_CLICKABLE : '',
      ].join(' ')
      // 여러 날을 함께 그릴 때는 "2-1"처럼 일차를 붙여야 같은 번호가 겹치지 않는다.
      pin.textContent = found
        ? multiDay
          ? `${found.routeIndex + 1}-${found.order + 1}`
          : String(found.order + 1)
        : ''
      pin.title = place.name

      const marker = document.createElement('div')
      marker.className = PIN_WRAP
      marker.appendChild(pin)

      // 이름표는 담긴 곳에만 붙인다. 모든 마커에 붙이면 글자가 서로 겹쳐 지도가 읽히지 않는다.
      if (isMarked) {
        const label = document.createElement('span')
        label.className = PIN_LABEL
        label.textContent = place.name
        marker.appendChild(label)
      }

      const overlay = new maps.CustomOverlay({
        position,
        content: marker,
        xAnchor: 0.5,
        /*
          yAnchor는 콘텐츠 높이에 대한 비율이다. 담긴 마커는 아래에 이름표가 붙어
          전체가 더 길어지므로, 0.5로 두면 좌표가 이름표 근처에 찍힌다.
          동그라미 가운데가 실제 좌표에 오도록 비율을 줄인다.
        */
        yAnchor: isMarked ? 0.28 : 0.5,
        // 담긴 장소가 다른 마커에 가리지 않도록 위로 올린다.
        zIndex: isMarked ? 2 : 1,
        clickable,
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
        // 지도 마커의 한적색(--c-quiet-strong)과 같은 값. 카카오가 그리는 캔버스라
        // CSS 변수를 못 쓰는 자리여서 직접 적는다 — 여기만 index.css와 따로 논다.
        strokeColor: '#0e7a5f',
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      })
      polyline.setMap(map)
      polylinesRef.current.push(polyline)
    })

    /*
     * 편집 지도(interactive)는 처음 한 번만 맞춘다. 장소를 담을 때마다 지도가 움직이면
     * 방금 어디를 눌렀는지 놓치게 된다.
     *
     * 읽기 전용 지도는 반대로 <b>매번</b> 다시 맞춘다. 보여줄 경로가 통째로 바뀌기
     * 때문이다(일차 전환). 한 번만 맞추면 2일차로 넘겼을 때 그 날 장소들이
     * 화면 밖에 있어도 지도가 그대로 멈춰 있다.
     */
    const shouldFit = !interactive || !hasFittedRef.current
    if (shouldFit && places.length > 0 && !bounds.isEmpty()) {
      map.setBounds(bounds)
      hasFittedRef.current = true
    }
    // levels가 빠져 있으면 장소 교체 없이 점수만 바뀐 경우(날짜 이동) 마커 색이 낡은 채 남는다.
  }, [places, routes, levels, status, interactive])

  // 대체 화면도 같은 크기로 그린다. 지도를 못 불러왔을 때 자리가 줄어들면
  // 옆 칸까지 따라 움직여 화면이 흔들린다.
  if (status !== 'ready') {
    return <MapPlaceholder status={status} className={className} />
  }

  return <div ref={containerRef} className={`${MAP_BOX} ${className}`} />
}

function MapPlaceholder({
  status,
  className,
}: {
  status: 'no-key' | 'loading' | 'error'
  className: string
}) {
  const message = {
    'no-key': '지도 키가 설정되지 않았습니다. 아래 목록으로 코스를 짤 수 있어요.',
    loading: '지도를 불러오는 중…',
    error: '지도를 불러오지 못했습니다. 아래 목록으로 코스를 짤 수 있어요.',
  }[status]

  return (
    <div
      className={`${MAP_BOX} ${className} bg-surface grid place-items-center p-4 text-center text-[13px]`}
    >
      <p className="m-0 max-w-[28ch]">{message}</p>
    </div>
  )
}
