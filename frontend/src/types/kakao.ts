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

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi }
  }
}

export type { KakaoMapsApi }
