import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { addFavorite, fetchFavorites, removeFavorite } from '../services/api'
import type { FavoritePlace } from '../types/api'
import { useAuth } from './authContext'
import { FavoriteContext } from './favoriteContext'

/**
 * 찜 목록을 들고 있는다.
 *
 * <h3>로그인 상태를 따라간다</h3>
 * 로그인하면 받아 오고, 로그아웃하면 비운다. 비우지 않으면 <b>다음 사람이 앞사람의 찜을</b>
 * 하트가 켜진 채로 보게 된다 — 한 기기를 나눠 쓰는 자리에서 실제로 일어난다.
 *
 * <h3>실패해도 화면을 막지 않는다</h3>
 * 찜은 곁들이는 기능이라 목록을 못 받아 왔다고 서비스를 멈출 이유가 없다.
 * 그때는 하트가 전부 꺼진 채로 보이고, 누르면 그때 서버가 답한다.
 */
export function FavoriteProvider({ children }: { children: ReactNode }) {
  const { member } = useAuth()
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])

  useEffect(() => {
    if (!member) {
      setFavorites([])
      return
    }
    const controller = new AbortController()
    fetchFavorites(controller.signal)
      .then(setFavorites)
      .catch(() => {
        // 곁들이는 기능이다. 못 받아 오면 꺼진 채로 두고, 누를 때 서버가 답하게 한다.
      })
    return () => controller.abort()
  }, [member])

  const isFavorite = useCallback(
    (placeId: string) => favorites.some((favorite) => favorite.placeId === placeId),
    [favorites],
  )

  /*
   * ■ 화면을 먼저 바꾸고 서버에 보낸다
   *
   * 하트는 누른 그 순간 반응해야 눌린 것으로 읽힌다. 왕복을 기다리면 느린 망에서
   * 사용자가 한 번 더 누르고, 그러면 켰다 끈 셈이 된다.
   *
   * <p>실패하면 되돌린다. 서버가 거절했는데 화면만 켜져 있으면, 다음에 열었을 때
   * 아무 이유 없이 꺼져 있는 것으로 보인다.
   */
  const toggle = useCallback(
    (place: {
      id: string
      name: string
      categoryName: string | null
      imageUrl: string | null
      /**
       * ⚠️ 새로 찜할 때는 <b>화면이 모른다</b>(상세 시트는 지역을 받지 않는다).
       * 서버가 찾아 담으므로, 낙관적으로 그리는 동안만 null이었다가
       * 다음에 목록을 받을 때 채워진다 — 그 사이에 "여행가기" 문이 잠깐 없을 뿐이다.
       */
      region?: string | null
      regionName?: string | null
    }) => {
      if (!member) {
        return
      }
      const wasFavorite = favorites.some((favorite) => favorite.placeId === place.id)
      const previous = favorites

      setFavorites(
        wasFavorite
          ? previous.filter((favorite) => favorite.placeId !== place.id)
          : /*
             * 맨 앞에 넣는다. 목록이 "최근에 찜한 것부터"라 서버가 돌려줄 자리와 같다.
             * createdAt은 서버가 정하는 값이지만, 다시 받아 오기 전까지 목록을 그리려면
             * 자리를 채워야 한다 — 다음 로그인에 서버 값으로 갈린다.
             */
            [
              {
                /*
                 * 낙관적으로 그리는 동안은 <b>온전한 장소를 모른다.</b> 상세 시트가 넘겨준 것은
                 * 이름·분류·사진뿐이고 좌표가 없다 — 반쯤 채운 장소를 넣으면 캐시가 그것을
                 * 진짜로 여겨 지도 마커가 (0,0)에 찍힌다. 다음에 목록을 받을 때 서버가 채운다.
                 */
                place: null,
                placeId: place.id,
                placeName: place.name,
                categoryName: place.categoryName,
                imageUrl: place.imageUrl,
                region: place.region ?? null,
                regionName: place.regionName ?? null,
                createdAt: new Date().toISOString(),
              },
              ...previous,
            ],
      )

      const request = wasFavorite ? removeFavorite(place.id) : addFavorite(place.id)
      request.catch(() => setFavorites(previous))
    },
    [favorites, member],
  )

  const value = useMemo(
    () => ({ favorites, isFavorite, toggle }),
    [favorites, isFavorite, toggle],
  )

  return <FavoriteContext.Provider value={value}>{children}</FavoriteContext.Provider>
}
