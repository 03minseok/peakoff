import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
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
  | { type: 'RESET' }

function reducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'SET_PLAN':
      return { ...state, plan: action.plan }
    case 'RESET':
      return EMPTY_TRIP_STATE
  }
}

interface TripContextValue {
  state: TripState
  setPlan: (plan: TripPlan) => void
  reset: () => void
}

const TripContext = createContext<TripContextValue | null>(null)

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
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [state],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip(): TripContextValue {
  const context = useContext(TripContext)
  if (!context) {
    // Provider 밖에서 부르면 조용히 undefined를 쓰다가 엉뚱한 곳에서 터진다. 여기서 막는다.
    throw new Error('useTrip은 TripProvider 안에서만 쓸 수 있습니다.')
  }
  return context
}
