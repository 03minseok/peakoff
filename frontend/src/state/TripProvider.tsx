import { useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { TripContext } from './tripContext'
import type { TripContextValue } from './tripContext'
import { EMPTY_TRIP_STATE, loadTripState, saveTripState } from './tripStorage'
import type { TripPlan, TripState } from './tripTypes'

/**
 * 여행 흐름의 공유 상태.
 *
 * 단계가 여러 화면에 걸쳐 있고(조건 → 편집 → 진단), 각 화면이 앞 단계 입력을 알아야 한다.
 * 화면끼리 props로 넘길 수 없는 구조라 Context를 쓴다.
 *
 * 라우터 state(navigate에 실어 보내기)를 쓰지 않은 이유: 새로고침하면 사라진다.
 * 심사 중 새로고침 한 번에 입력이 날아가면 안 된다.
 */
type TripAction =
  | { type: 'SET_PLAN'; plan: TripPlan }
  | { type: 'CHANGE_START_DATE'; startDate: string }
  | { type: 'ADD_PLACE'; day: number; placeId: string }
  | { type: 'REMOVE_PLACE'; day: number; index: number }
  | { type: 'MOVE_PLACE'; day: number; index: number; direction: -1 | 1 }
  | { type: 'REPLACE_PLACE'; day: number; index: number; placeId: string }
  | { type: 'MARK_BASELINE' }
  | { type: 'RESTORE'; plan: TripPlan; days: string[][] }
  | { type: 'RESET' }

/** day는 1부터 시작한다. 배열 인덱스로 바꿔 쓴다. */
function dayIndex(day: number): number {
  return day - 1
}

/** 해당 일차 배열만 바꾼 새 days를 만든다. 나머지 일차는 그대로 둔다. */
function replaceDay(days: string[][], day: number, next: string[]): string[][] {
  return days.map((placeIds, index) => (index === dayIndex(day) ? next : placeIds))
}

function reducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'SET_PLAN': {
      // 기간이 바뀌면 일차 수도 따라 바뀐다.
      // 남아 있는 일차의 선택은 살리고, 줄어든 일차만 버린다.
      const dayCount = action.plan.nights + 1
      const days = Array.from({ length: dayCount }, (_, index) => state.days[index] ?? [])
      // 조건 화면에서 처음부터 다시 정하는 것이므로 비교 기준도 새로 잡는다.
      return { plan: action.plan, days, baseline: null }
    }

    case 'CHANGE_START_DATE': {
      if (!state.plan) {
        return state
      }
      /*
       * 진단 화면에서 "더 한적한 날짜"를 골랐을 때.
       *
       * SET_PLAN과 달리 <b>원안을 지우지 않는다.</b> 날짜 이동도 장소 교체와 마찬가지로
       * 혼잡을 피한 결과이므로, 최종 비교에서 두 효과가 함께 잡혀야 한다.
       */
      return { ...state, plan: { ...state.plan, startDate: action.startDate } }
    }

    case 'ADD_PLACE': {
      const current = state.days[dayIndex(action.day)] ?? []
      // 같은 날 같은 곳을 두 번 넣는 것은 실수일 가능성이 높다. 조용히 무시한다.
      if (current.includes(action.placeId)) {
        return state
      }
      return { ...state, days: replaceDay(state.days, action.day, [...current, action.placeId]) }
    }

    case 'REMOVE_PLACE': {
      const current = state.days[dayIndex(action.day)] ?? []
      return {
        ...state,
        days: replaceDay(
          state.days,
          action.day,
          current.filter((_, index) => index !== action.index),
        ),
      }
    }

    case 'MOVE_PLACE': {
      const current = state.days[dayIndex(action.day)] ?? []
      const target = action.index + action.direction
      // 첫 항목의 "위로", 마지막 항목의 "아래로"는 아무 일도 하지 않는다.
      if (target < 0 || target >= current.length) {
        return state
      }
      const next = [...current]
      ;[next[action.index], next[target]] = [next[target], next[action.index]]
      return { ...state, days: replaceDay(state.days, action.day, next) }
    }

    case 'REPLACE_PLACE': {
      const current = state.days[dayIndex(action.day)] ?? []
      // 그 날에 이미 있는 곳으로 바꾸면 같은 곳이 두 번 들어간다.
      // 화면에서 그런 후보를 미리 걸러내지만, 여기서도 막아둔다.
      if (current.includes(action.placeId)) {
        return state
      }
      const next = current.map((placeId, index) =>
        index === action.index ? action.placeId : placeId,
      )
      return { ...state, days: replaceDay(state.days, action.day, next) }
    }

    case 'MARK_BASELINE':
      // 코스 편집을 마치고 진단에 들어가는 순간 찍는다. 날짜와 장소를 함께 담는다.
      // 다시 편집하고 들어오면 그 코스가 새 원안이 된다.
      if (!state.plan) {
        return state
      }
      return { ...state, baseline: { plan: state.plan, days: state.days } }

    case 'RESTORE':
      /*
       * 기기에 저장해둔 코스를 다시 불러온다.
       *
       * baseline을 null로 두는 것이 중요하다. 저장된 것은 "완성된 코스" 한 벌뿐이고,
       * 그때의 원안이 무엇이었는지는 남아 있지 않다. 불러온 코스를 원안이라고 우기면
       * 최종 비교 화면이 "아무것도 개선되지 않았다"는 거짓 결과를 보여준다.
       * 다시 진단에 들어가는 순간 이 코스가 새 원안으로 찍힌다.
       */
      return { plan: action.plan, days: action.days, baseline: null }

    case 'RESET':
      return EMPTY_TRIP_STATE
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  // 초기값을 함수로 넘겨 sessionStorage 읽기가 렌더마다 반복되지 않게 한다.
  const [state, dispatch] = useReducer(reducer, null, loadTripState)

  useEffect(() => {
    saveTripState(state)
  }, [state])

  const value = useMemo<TripContextValue>(
    () => ({
      state,
      setPlan: (plan) => dispatch({ type: 'SET_PLAN', plan }),
      changeStartDate: (startDate) => dispatch({ type: 'CHANGE_START_DATE', startDate }),
      addPlace: (day, placeId) => dispatch({ type: 'ADD_PLACE', day, placeId }),
      removePlace: (day, index) => dispatch({ type: 'REMOVE_PLACE', day, index }),
      movePlace: (day, index, direction) =>
        dispatch({ type: 'MOVE_PLACE', day, index, direction }),
      replacePlace: (day, index, placeId) =>
        dispatch({ type: 'REPLACE_PLACE', day, index, placeId }),
      markBaseline: () => dispatch({ type: 'MARK_BASELINE' }),
      restore: (plan, days) => dispatch({ type: 'RESTORE', plan, days }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [state],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}
