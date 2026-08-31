import { createContext, useContext } from 'react'
import type { FavoritePlace } from '../types/api'

/**
 * 찜 상태를 화면 어디서나 읽고 바꾼다.
 *
 * <h3>왜 컨텍스트인가</h3>
 * 하트는 <b>여러 화면에 선다</b>(지금은 장소 상세 시트, 앞으로 검색 결과·진단 목록).
 * 시트마다 "이 곳이 찜인가"를 서버에 물으면 열 때마다 요청이 하나씩 늘고, 시트를 닫았다
 * 열면 하트가 잠깐 꺼진 채로 그려진다. 로그인할 때 <b>한 번 받아 두면</b> 그 뒤로는
 * 메모리 조회다.
 *
 * <p>Provider와 파일을 나눈 이유는 {@code tripContext}·{@code authContext}와 같다 —
 * 한 파일이 컴포넌트와 컴포넌트 아닌 것을 함께 내보내면 Fast Refresh가 동작하지 않는다.
 */
export interface FavoriteContextValue {
  /** 찜한 곳. 최근에 찜한 것부터. 게스트는 늘 빈 배열이다 */
  favorites: FavoritePlace[]
  /** 이 장소가 찜인가. 하트를 그리는 데 쓴다 */
  isFavorite: (placeId: string) => boolean
  /**
   * 찜을 켜고 끈다.
   *
   * <p><b>화면을 먼저 바꾸고 서버에 보낸다</b>(낙관적 갱신). 하트는 누른 그 순간
   * 반응해야 눌린 것으로 읽히는데, 왕복을 기다리면 느린 망에서 두 번 누르게 된다.
   * 실패하면 되돌린다.
   *
   * <p>게스트가 부르면 아무 일도 일어나지 않는다 — 화면이 먼저 막지만,
   * 여기서도 막아야 화면 하나를 고칠 때 규칙이 새지 않는다.
   */
  toggle: (place: { id: string; name: string }) => void
}

export const FavoriteContext = createContext<FavoriteContextValue | null>(null)

export function useFavorites(): FavoriteContextValue {
  const value = useContext(FavoriteContext)
  if (!value) {
    throw new Error('FavoriteProvider 안에서만 쓸 수 있습니다.')
  }
  return value
}
