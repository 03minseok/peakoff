/**
 * 카카오맵 SDK 타입 선언.
 *
 * 공식 타입 패키지가 없어 <b>실제로 쓰는 부분만</b> 직접 적었다.
 * 전체를 옮겨 적으면 유지 비용만 늘고, 안 쓰는 API의 시그니처가 틀려도 알 수 없다.
 * 새 기능을 쓰게 되면 그때 여기에 추가한다.
 */

export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void
  isEmpty(): boolean
}

export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number): void
  setCenter(latlng: KakaoLatLng): void
  relayout(): void
}

export interface KakaoPolyline {
  setMap(map: KakaoMap | null): void
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
}

interface KakaoMapsApi {
  /** autoload=false로 불러왔을 때 초기화를 끝내는 콜백 */
  load(callback: () => void): void

  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds

  Polyline: new (options: {
    path: KakaoLatLng[]
    strokeWeight?: number
    strokeColor?: string
    strokeOpacity?: number
    strokeStyle?: string
  }) => KakaoPolyline

  CustomOverlay: new (options: {
    position: KakaoLatLng
    content: HTMLElement | string
    xAnchor?: number
    yAnchor?: number
    zIndex?: number
    clickable?: boolean
  }) => KakaoCustomOverlay
}

/**
 * 카카오톡 공유가 쓰는 <b>피드 템플릿</b>. 실제로 채우는 칸만 적었다.
 *
 * <p>{@code link}가 두 벌인 것은 카카오의 요구다 — 폰에서 연 카톡과 PC 카톡이 서로 다른 주소를
 * 열 수 있게 나뉘어 있다. 우리는 같은 주소를 둘 다에 넣는다(반응형 한 벌이라 갈릴 이유가 없다).
 */
export interface KakaoShareLink {
  mobileWebUrl: string
  webUrl: string
}

export interface KakaoFeedTemplate {
  objectType: 'feed'
  content: {
    title: string
    description: string
    /** ⚠️ 피드 템플릿의 <b>필수</b> 칸이다. 사진이 없으면 이 템플릿을 쓸 수 없다 */
    imageUrl: string
    link: KakaoShareLink
  }
  buttons?: { title: string; link: KakaoShareLink }[]
}

/** 사진이 없을 때. 글자와 링크만 있으면 된다 */
export interface KakaoTextTemplate {
  objectType: 'text'
  text: string
  link: KakaoShareLink
  buttonTitle?: string
}

/**
 * 카카오 JavaScript SDK. <b>지도 SDK와 다른 물건이다</b> —
 * 지도는 {@code window.kakao}(소문자), 이쪽은 {@code window.Kakao}(대문자)이고
 * 스크립트도 각각 받는다. 둘은 같은 JavaScript 앱 키를 쓴다.
 */
export interface KakaoJsSdk {
  init(appKey: string): void
  isInitialized(): boolean
  Share: {
    sendDefault(settings: KakaoFeedTemplate | KakaoTextTemplate): void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi }
    Kakao?: KakaoJsSdk
  }
}

export type { KakaoMapsApi }
