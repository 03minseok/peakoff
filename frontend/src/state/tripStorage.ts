import type { TripState } from './tripTypes'

/**
 * 여행 상태를 sessionStorage에 보관한다.
 *
 * localStorage가 아니라 sessionStorage인 이유:
 * 게스트 이용은 1회성이다. 탭을 닫으면 사라지는 편이 서비스 정의와 맞고,
 * 며칠 뒤에 다시 들어왔을 때 예전 날짜가 남아 있는 혼란도 막는다.
 * "저장해서 나중에 다시 보기"는 로그인 기능이 맡을 몫이다.
 */
const STORAGE_KEY = 'peakoff.trip'

export const EMPTY_TRIP_STATE: TripState = { plan: null }

/**
 * 저장된 값이 지금 코드가 기대하는 모양인지 확인한다.
 *
 * 개발 중 상태 구조를 바꾸면 브라우저에는 옛 모양이 남아 있다. 그대로 읽어 쓰면
 * 화면이 알 수 없는 이유로 깨지므로, 모양이 다르면 없는 것으로 친다.
 */
function isValidPlan(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const plan = value as Record<string, unknown>
  return (
    typeof plan.region === 'string' &&
    typeof plan.startDate === 'string' &&
    typeof plan.nights === 'number'
  )
}

export function loadTripState(): TripState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return EMPTY_TRIP_STATE
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!isValidPlan(parsed.plan)) {
      return EMPTY_TRIP_STATE
    }
    return { plan: parsed.plan as TripState['plan'] }
  } catch {
    // 저장소를 못 쓰는 환경(사파리 시크릿 모드 등)에서도 앱은 돌아가야 한다.
    return EMPTY_TRIP_STATE
  }
}

export function saveTripState(state: TripState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 저장에 실패해도 화면 동작은 막지 않는다. 새로고침 시 입력이 사라질 뿐이다.
  }
}
