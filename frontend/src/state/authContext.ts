import { createContext, useContext } from 'react'
import type { AuthMember, LoginRequest, SignupRequest } from '../types/api'

/**
 * Context 정의와 훅.
 *
 * Provider와 파일을 나눈 이유는 {@link ./tripContext}와 같다 —
 * 한 파일이 컴포넌트와 컴포넌트가 아닌 것을 함께 내보내면 Fast Refresh가 동작하지 않는다.
 */
export interface AuthContextValue {
  /** 로그인하지 않았으면 null. 게스트도 서비스 전체를 쓸 수 있으므로 정상 상태다 */
  member: AuthMember | null
  /**
   * 저장된 토큰이 살아 있는지 서버에 확인하는 중.
   *
   * 이 값을 두지 않으면 새로고침 직후 잠깐 "로그아웃 상태"로 그려졌다가 로그인 상태로 바뀌어,
   * 헤더가 깜빡인다.
   */
  loading: boolean
  signup: (request: SignupRequest) => Promise<void>
  login: (request: LoginRequest) => Promise<void>
  logout: () => void

  /*
   * 계정 관리 중 여기 있는 것은 둘뿐이다. 비밀번호 변경은 로그인 상태를 바꾸지 않아서
   * 화면이 api를 직접 부른다 — 상태를 건드리지 않는 일까지 통과시키면 이 Context가
   * "인증 상태를 들고 있는 곳"이 아니라 "인증 API 목록"이 된다.
   */

  /** 닉네임 변경. 새 토큰을 받아 저장까지 여기서 끝낸다 */
  changeNickname: (nickname: string) => Promise<void>
  /** 회원 탈퇴. 성공하면 곧바로 로그아웃 상태가 된다 */
  deleteAccount: (password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.')
  }
  return context
}
