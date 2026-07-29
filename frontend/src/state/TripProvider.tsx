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
  | { type: 'ADD_PLACE'; day: number; placeId: string }
  | { type: 'REMOVE_PLACE'; day: number; index: number }
  | { type: 'MOVE_PLACE'; day: number; index: number; direction: -1 | 1 }
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
      return { plan: action.plan, days }
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
      addPlace: (day, placeId) => dispatch({ type: 'ADD_PLACE', day, placeId }),
      removePlace: (day, index) => dispatch({ type: 'REMOVE_PLACE', day, index }),
      movePlace: (day, index, direction) =>
        dispatch({ type: 'MOVE_PLACE', day, index, direction }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [state],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}
