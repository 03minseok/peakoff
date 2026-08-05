import type { TripPlan } from './tripTypes'

/**
 * "이 기기에만 저장" — 로그인 없이 코스를 남겨두는 자리.
 *
 * 여행 상태는 {@link ./tripStorage} 가 sessionStorage에 들고 있어 탭을 닫으면 사라진다.
 * 그건 "지금 진행 중인 작업"이라 그게 맞다. 반면 여기 저장하는 것은 사용자가
 * <b>명시적으로 남기겠다고 누른 결과물</b>이라, 탭을 닫아도 남아야 한다. 그래서 localStorage다.
 *
 * 한 벌만 보관한다. 여러 코스를 쌓아 관리하는 것은 계정이 할 일이고,
 * 목록·삭제·이름짓기 같은 화면이 따라붙어야 해서 기기 저장이 감당할 범위를 넘는다.
 */
const STORAGE_KEY = 'peakoff.savedCourse'

/** 이름 기능이 생기기 전에 저장된 값에 붙일 이름. 지우지 않고 이걸로 채운다 */
const FALLBACK_NAME = '저장한 코스'

export interface SavedCourse {
  /** 사용자가 붙인 여행 이름 */
  name: string
  /** 저장 시각 (ISO). "언제 저장한 코스인지" 화면에 보여주기 위한 값 */
  savedAt: string
  plan: TripPlan
  days: string[][]
}

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

/**
 * 저장된 값이 지금 코드가 기대하는 모양인지 확인한다.
 *
 * localStorage는 sessionStorage와 달리 <b>몇 달 전 값이 남아 있을 수 있다.</b>
 * 그 사이 상태 구조를 바꿨다면 그대로 읽어 쓰는 순간 화면이 깨진다. 모양이 다르면 없는 것으로 친다.
 */
/** name은 나중에 생긴 필드라 여기서 요구하지 않는다. 없으면 {@link loadSavedCourse}가 채운다. */
function isValidSavedCourse(value: unknown): value is SavedCourse {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const saved = value as Record<string, unknown>
  return (
    typeof saved.savedAt === 'string' &&
    isValidPlan(saved.plan) &&
    Array.isArray(saved.days) &&
    saved.days.every(
      (day) => Array.isArray(day) && day.every((id) => typeof id === 'string'),
    )
  )
}

export function loadSavedCourse(): SavedCourse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSavedCourse(parsed)) {
      return null
    }
    /*
     * 이름은 나중에 생긴 필드다. 없다고 값을 버리면 그 전에 저장해둔 코스가 사라진다.
     * 모양이 어긋난 것과 필드가 늘어난 것은 다르게 다뤄야 한다.
     */
    return { ...parsed, name: parsed.name?.trim() ? parsed.name : FALLBACK_NAME }
  } catch {
    // 저장소를 못 쓰는 환경(사파리 시크릿 모드 등)에서도 앱은 돌아가야 한다.
    return null
  }
}

/** @returns 저장에 성공했는지. 실패하면 화면에서 "저장하지 못했어요"로 알려야 한다 */
export function saveCourseToDevice(name: string, plan: TripPlan, days: string[][]): boolean {
  try {
    const saved: SavedCourse = {
      name: name.trim() || FALLBACK_NAME,
      savedAt: new Date().toISOString(),
      plan,
      days,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    return true
  } catch {
    // 저장 공간이 꽉 찼거나 저장소가 막힌 경우. 조용히 성공한 척하지 않는다.
    return false
  }
}

export function clearSavedCourse(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못해도 화면 동작은 막지 않는다.
  }
}
