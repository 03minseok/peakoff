import { createContext, useContext } from 'react'
import type { TripPlan, TripState } from './tripTypes'

/**
 * Context 정의와 훅.
 *
 * Provider 컴포넌트({@link ../state/TripProvider})와 파일을 나눈 이유:
 * 한 파일이 컴포넌트와 컴포넌트가 아닌 것을 함께 내보내면 Fast Refresh가 동작하지 않는다.
 * 편집할 때마다 화면 상태가 초기화되면 코스를 담아둔 채로 UI를 다듬을 수 없다.
 */
export interface TripContextValue {
  state: TripState
  setPlan: (plan: TripPlan) => void
  addPlace: (day: number, placeId: string) => void
  removePlace: (day: number, index: number) => void
  movePlace: (day: number, index: number, direction: -1 | 1) => void
  /** 해당 자리의 장소만 다른 곳으로 바꾼다. 일차와 순서는 유지된다 */
  replacePlace: (day: number, index: number, placeId: string) => void
  /** 진단에 들어가며 지금 코스를 원안으로 찍는다. 이후 비교의 기준이 된다 */
  markBaseline: () => void
  reset: () => void
}

export const TripContext = createContext<TripContextValue | null>(null)

export function useTrip(): TripContextValue {
  const context = useContext(TripContext)
  if (!context) {
    // Provider 밖에서 부르면 조용히 undefined를 쓰다가 엉뚱한 곳에서 터진다. 여기서 막는다.
    throw new Error('useTrip은 TripProvider 안에서만 쓸 수 있습니다.')
  }
  return context
}
