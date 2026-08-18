import { createContext, useContext } from 'react'
import type {
  AuthMember,
  LoginRequest,
  SignupRequest,
  SocialLinkCandidate,
  SocialLinkRequest,
  SocialProvider,
} from '../types/api'

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

  /**
   * 소셜 로그인 마무리. 제공자가 돌려준 인가 코드를 로그인으로 바꾼다.
   *
   * 끝이 둘이라 반환값으로 가른다.
   * - `null`: 로그인이 끝났다. 화면은 돌아갈 곳으로 이동하면 된다
   * - 후보 객체: 같은 이메일의 기존 계정이 있다. 비밀번호를 받아 {@link linkSocial}을 불러야 한다
   *
   * 인가 코드는 한 번만 쓸 수 있으므로 <b>같은 코드로 두 번 부르면 안 된다.</b>
   *
   * state는 제공자가 주소로 돌려준 값을 그대로 넘긴다. 네이버가 토큰 교환에도 요구하는 값이라
   * 서버까지 가야 한다 — 우리가 시작한 로그인인지 확인하는 일은 부르기 <b>전에</b> 끝나 있어야 한다.
   */
  completeSocialLogin: (
    provider: SocialProvider,
    code: string,
    state: string,
  ) => Promise<SocialLinkCandidate | null>

  /** 비밀번호를 확인해 소셜 계정을 기존 계정에 연결한다. 성공하면 곧바로 로그인 상태가 된다 */
  linkSocial: (request: SocialLinkRequest) => Promise<void>

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
