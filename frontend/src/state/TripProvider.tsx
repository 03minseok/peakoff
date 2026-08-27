import { useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { TripContext } from './tripContext'
import type { TripContextValue } from './tripContext'
import { EMPTY_TRIP_STATE, loadTripState, saveTripState } from './tripStorage'
import type { TripPlan, TripSource, TripState } from './tripTypes'

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
  | { type: 'REORDER_PLACE'; day: number; from: number; to: number }
  | { type: 'REPLACE_PLACE'; day: number; index: number; placeId: string }
  | { type: 'MARK_BASELINE' }
  | { type: 'RESTORE'; plan: TripPlan; days: string[][]; source?: TripSource | null }
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
      /*
       * 여행 조건을 새로 정하면 <b>담아둔 장소를 버린다.</b>
       *
       * 예전에는 남아 있는 일차의 선택을 살렸다. 기간만 줄였다 늘렸다 할 때는 편했지만,
       * 홈에서 다시 들어와 새 여행을 시작할 때도 <b>지난번 코스가 그대로 남아 있었다.</b>
       * 추천을 받아보고 온 사람에게는 더 이상하다 — 새로 시작한 줄 알았는데 예전 장소가 있다.
       *
       * 조건 화면은 "이번 여행을 어떻게 갈까"를 처음부터 정하는 자리다. 여기를 거쳤다는 것은
       * 새로 짜겠다는 뜻이므로 빈 일자로 시작한다. 일차 안에서 순서를 바꾸거나 장소를
       * 더하는 것은 편집 화면이 맡는다.
       *
       * 기간만 손보고 싶은 사람은 손해를 보지만, 그 경우는 되짚어 담으면 된다.
       * 반대는 되돌릴 수 없다 — 새 여행인데 옛 장소가 섞이면 어디까지가 이번 것인지 모른다.
       */
      const days = Array.from({ length: action.plan.nights + 1 }, () => [] as string[])
      /*
       * 조건 화면에서 처음부터 다시 정하는 것이므로 비교 기준도 새로 잡는다.
       *
       * source도 함께 버린다. 저장해둔 코스를 고치러 들어왔더라도 조건 화면을 지났다는 것은
       * <b>새로 짜겠다는 뜻</b>이다 — 장소를 전부 버린 마당에 저장할 때만 옛 코스를
       * 덮어쓰면, 이름은 그대로인데 내용이 전혀 다른 코스가 되어 되돌릴 수 없다.
       */
      return { plan: action.plan, days, baseline: null, source: null }
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
      /*
       * 같은 곳을 여러 번 담을 수 있다.
       *
       * 예전에는 같은 날 중복을 실수로 보고 조용히 무시했는데, 무시하는 편이 오히려
       * 나빴다 — 눌러도 아무 일이 없으면 사용자는 버튼이 고장난 줄 안다.
       *
       * 그리고 실제로 다시 들르는 일정이 있다. 아침에 들렀다 저녁에 다시 오는 곳,
       * 이틀 연속 가는 카페, 매일 돌아오는 숙소. 우리가 "실수일 것"이라고 판단해
       * 막을 일이 아니다. 잘못 담았으면 빼면 된다.
       *
       * 진단도 중복을 견딘다 — 방문마다 그 날짜의 자료로 따로 계산한다(PlannedVisit 참고).
       */
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

    /**
     * 잡아 끌어 옮기기. <b>이웃과 맞바꾸는 것이 아니라 뽑아서 끼워 넣는다.</b>
     *
     * 예전 위/아래 버튼은 두 항목을 맞바꿨다(swap). 한 칸씩만 움직이니 그래도 됐다.
     * 끌어 옮기기는 임의의 거리를 한 번에 가는데, 맞바꾸기로 세 칸을 건너면
     * 지나온 항목들의 순서가 뒤엉킨다. 그래서 <b>splice</b>여야 한다.
     */
    case 'REORDER_PLACE': {
      const current = state.days[dayIndex(action.day)] ?? []
      const { from, to } = action
      if (
        from === to ||
        from < 0 || from >= current.length ||
        to < 0 || to >= current.length
      ) {
        return state
      }
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
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
       *
       * source는 부르는 쪽이 정한다. 마이페이지의 "수정하기"는 코스를 넘겨 고쳐 쓰게 하고,
       * 남의 코스 "나도 짜보기"는 넘기지 않아 새 코스가 된다. 기본이 null이라
       * <b>빠뜨리면 새로 만들어지는 쪽</b>으로 넘어진다 — 남의 코스를 덮어쓰는 사고보다
       * 코스가 하나 더 생기는 쪽이 훨씬 낫다.
       */
      return { plan: action.plan, days: action.days, baseline: null, source: action.source ?? null }

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
      reorderPlace: (day, from, to) => dispatch({ type: 'REORDER_PLACE', day, from, to }),
      replacePlace: (day, index, placeId) =>
        dispatch({ type: 'REPLACE_PLACE', day, index, placeId }),
      markBaseline: () => dispatch({ type: 'MARK_BASELINE' }),
      restore: (plan, days, source) => dispatch({ type: 'RESTORE', plan, days, source }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    [state],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}
