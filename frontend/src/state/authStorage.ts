import type { AuthMember } from '../types/api'

/**
 * 로그인 상태를 브라우저에 보관한다.
 *
 * <b>localStorage인 이유</b>: 로그인은 "탭을 닫아도 유지되는 것"이 정의다.
 * 진행 중인 코스({@link ./tripStorage})는 sessionStorage에 두지만, 그건 지금 하던 작업이라
 * 성격이 다르다.
 *
 * <b>알고 쓰는 위험</b>: localStorage의 값은 페이지에서 돌아가는 자바스크립트가 전부 읽을 수 있다.
 * XSS가 나면 토큰이 함께 털린다. 완전히 막으려면 httpOnly 쿠키를 써야 하는데,
 * 그러면 CSRF 대비와 쿠키 도메인 설정이 따라붙는다. 파일럿 범위에서는 토큰 유효기간을
 * 짧게 두는 것으로 대신하고, 이 선택을 여기 적어둔다.
 */
const STORAGE_KEY = 'peakoff.auth'

export interface StoredAuth {
  token: string
  member: AuthMember
  /** 만료 시각(epoch ms). 서버가 준 expiresInSeconds를 저장 시점에 더해 계산한다 */
  expiresAt: number
}

function isValidMember(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const member = value as Record<string, unknown>
  return (
    typeof member.id === 'number' &&
    typeof member.email === 'string' &&
    typeof member.nickname === 'string'
  )
}

/**
 * 저장된 값이 지금 코드가 기대하는 모양인지 확인한다.
 *
 * 만료된 값은 <b>없는 것으로 친다.</b> 이 확인이 없으면 화면이 로그인 상태로 그려진 뒤
 * 첫 요청에서 401을 맞고 그제서야 로그아웃되어, 사용자에게는 화면이 한 번 깜빡인 것처럼 보인다.
 */
function isValidAuth(value: unknown): value is StoredAuth {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const auth = value as Record<string, unknown>
  return (
    typeof auth.token === 'string' &&
    typeof auth.expiresAt === 'number' &&
    auth.expiresAt > Date.now() &&
    isValidMember(auth.member)
  )
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isValidAuth(parsed)) {
      // 만료됐거나 모양이 다르면 남겨둘 이유가 없다.
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    // 저장소를 못 쓰는 환경(사파리 시크릿 모드 등)에서도 앱은 돌아가야 한다.
    return null
  }
}

export function saveAuth(token: string, member: AuthMember, expiresInSeconds: number): StoredAuth {
  const auth: StoredAuth = {
    token,
    member,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  } catch {
    // 저장에 실패해도 이번 세션은 로그인 상태로 쓸 수 있어야 한다.
    // 새로고침하면 풀리는 것이 유일한 차이다.
  }
  return auth
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못해도 화면 동작은 막지 않는다.
  }
}
