import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from '../services/api'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'
import { clearAuth, loadAuth, saveAuth } from './authStorage'
import type { AuthMember, LoginRequest, SignupRequest } from '../types/api'

/**
 * 로그인 상태를 앱 전체가 공유한다.
 *
 * <p>첫 렌더에서 저장된 토큰을 곧바로 {@link api.setAuthToken}에 넣는다.
 * useEffect까지 기다리면 그 사이에 나가는 요청에 토큰이 빠진다.
 */
function restoreTokenSynchronously(): AuthMember | null {
  const stored = loadAuth()
  if (!stored) {
    return null
  }
  api.setAuthToken(stored.token)
  return stored.member
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<AuthMember | null>(restoreTokenSynchronously)

  // 복원할 토큰이 없으면 서버에 물어볼 것도 없다. 처음부터 확인이 끝난 상태로 둔다.
  const [loading, setLoading] = useState(() => loadAuth() !== null)

  /**
   * 저장된 토큰이 서버에서도 유효한지 확인한다.
   *
   * 만료 시각은 저장할 때 계산해두지만 그것만 믿을 수 없다 —
   * 서버에서 회원이 지워졌거나 서명 키가 바뀌었으면 시각이 남아 있어도 무효다.
   */
  useEffect(() => {
    if (!loading) {
      return
    }
    const controller = new AbortController()

    api
      .fetchMe(controller.signal)
      .then((fresh) => {
        // 닉네임이 바뀌었을 수 있으니 서버가 준 값으로 갱신한다.
        setMember(fresh)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        // 토큰이 죽었다. 조용히 로그아웃 상태로 돌린다 — 사용자가 한 일이 아니라 알릴 것도 없다.
        api.setAuthToken(null)
        clearAuth()
        setMember(null)
        setLoading(false)
      })

    return () => controller.abort()
  }, [loading])

  /** 가입·로그인이 성공한 뒤 공통으로 하는 일. 한 곳에 모아 한쪽만 빠뜨리는 일을 막는다. */
  const accept = useCallback((result: { token: string; member: AuthMember; expiresInSeconds: number }) => {
    api.setAuthToken(result.token)
    saveAuth(result.token, result.member, result.expiresInSeconds)
    setMember(result.member)
    setLoading(false)
  }, [])

  const signup = useCallback(
    async (request: SignupRequest) => {
      accept(await api.signup(request))
    },
    [accept],
  )

  const login = useCallback(
    async (request: LoginRequest) => {
      accept(await api.login(request))
    },
    [accept],
  )

  const logout = useCallback(() => {
    api.setAuthToken(null)
    clearAuth()
    setMember(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ member, loading, signup, login, logout }),
    [member, loading, signup, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
