import { createContext, useContext } from 'react'
import type { TripPlan, TripSource, TripState } from './tripTypes'

/**
 * Context 정의와 훅.
 *
 * Provider 컴포넌트({@link ../state/TripProvider})와 파일을 나눈 이유:
 * 한 파일이 컴포넌트와 컴포넌트가 아닌 것을 함께 내보내면 Fast Refresh가 동작하지 않는다.
 * 편집할 때마다 화면 상태가 초기화되면 코스를 담아둔 채로 UI를 다듬을 수 없다.
 */
export interface TripContextValue {
  state: TripState
  /** 조건 화면에서 여행을 새로 정한다. 원안 기준도 함께 초기화된다 */
  setPlan: (plan: TripPlan) => void
  /**
   * 진단 화면에서 더 한적한 날짜로 옮긴다.
   *
   * {@link setPlan}과 달리 원안을 지우지 않는다 — 날짜 이동도 혼잡을 피한 결과이므로
   * 최종 비교에 그 효과가 남아야 한다.
   */
  changeStartDate: (startDate: string) => void
  addPlace: (day: number, placeId: string) => void
  removePlace: (day: number, index: number) => void
  /**
   * 잡아 끌어 순서를 바꾼다. from 자리의 장소를 빼내 to 자리에 끼워 넣는다.
   *
   * 이웃과 맞바꾸는(swap) 방식이 아니라 <b>뽑아서 끼워 넣는다</b>(splice).
   * 맞바꾸기로 여러 칸을 건너면 지나온 항목들의 순서가 뒤엉킨다 —
   * 위/아래 버튼 시절에는 한 칸씩만 움직여 문제가 없었다.
   */
  reorderPlace: (day: number, from: number, to: number) => void
  /** 해당 자리의 장소만 다른 곳으로 바꾼다. 일차와 순서는 유지된다 */
  replacePlace: (day: number, index: number, placeId: string) => void
  /** 진단에 들어가며 지금 코스를 원안으로 찍는다. 이후 비교의 기준이 된다 */
  markBaseline: () => void
  /**
   * 저장해둔 코스를 흐름에 다시 올린다. 원안 기준은 초기화된다.
   *
   * @param source 고쳐 쓸 코스. 주면 결과 화면의 저장이 <b>그 코스를 덮어쓴다.</b>
   *               <b>주지 않으면 새 코스가 된다</b> — 남의 코스를 "나도 짜보기"로
   *               담아 오는 길이 그렇다. 빠뜨렸을 때 새로 만들어지는 쪽으로 넘어진다
   */
  restore: (plan: TripPlan, days: string[][], source?: TripSource | null) => void
  /**
   * 방금 저장한 코스를 <b>고쳐 쓸 대상으로 찍는다.</b>
   *
   * ⚠️ 이것이 없으면 저장 버튼을 두 번 누른 사용자에게 <b>같은 코스가 두 개 생긴다.</b>
   * 결과 화면은 source가 있으면 PUT, 없으면 POST로 가르는데, 새로 저장한 뒤에도
   * source가 계속 null이라 두 번째 누름이 또 새 코스를 만들었다.
   *
   * {@link restore}로 대신할 수 없다. 그쪽은 원안(baseline)을 지우는데, 이 화면은
   * 원안과 개선안을 맞대는 자리라 그 순간 비교가 통째로 무너진다.
   */
  markSaved: (source: TripSource) => void
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
