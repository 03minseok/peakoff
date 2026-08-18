import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AuthField } from '../components/AuthField'
import { AuthShell } from '../components/AuthShell'
import { PRIMARY_BUTTON } from '../components/styles'
import { ApiRequestError } from '../services/api'
import { consumeReturnTo, consumeState } from '../services/socialLogin'
import { useAuth } from '../state/authContext'
import type { SocialLinkCandidate, SocialProvider } from '../types/api'

/** 이 화면이 있을 수 있는 상태. 화면 조각마다 조건을 따로 두지 않으려고 하나로 모았다 */
type Phase =
  | { status: 'working' }
  | { status: 'linking'; candidate: SocialLinkCandidate }
  | { status: 'failed'; message: string }

const SUPPORTED: SocialProvider[] = ['kakao', 'naver']

/**
 * 제공자가 사용자를 되돌려 보내는 곳.
 *
 * <p>주소에 인가 코드가 붙어 온다. 그 코드를 서버에 넘기면 로그인이 끝나거나,
 * "같은 이메일의 계정이 있으니 비밀번호를 확인하자"는 답이 온다.
 *
 * <p>화면이 거의 비어 있는 것은 의도다. 여기 머무는 시간은 1초 남짓이고, 사용자가 할 일이 없다.
 * 대신 실패했을 때는 <b>무엇을 해야 하는지</b>가 남아야 해서 그때만 내용을 채운다.
 */
export function OAuthCallbackPage() {
  const { provider } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const auth = useAuth()

  const [phase, setPhase] = useState<Phase>({ status: 'working' })

  /**
   * 코드를 <b>한 번만</b> 넘기게 막는 빗장.
   *
   * 인가 코드는 일회용이라 두 번 보내면 두 번째는 반드시 실패한다(KOE320). 그런데 개발 모드의
   * StrictMode는 effect를 일부러 두 번 실행한다 — 그대로 두면 첫 요청으로 로그인이 되고
   * 두 번째 요청이 실패해, 성공했는데도 "로그인 실패" 화면이 뜬다.
   *
   * 상태(useState)가 아니라 ref인 이유: 상태를 바꾸면 다시 그려지고, 그 사이 두 번째 effect가
   * 이미 지나간다. ref는 값을 바꿔도 다시 그리지 않아 <b>즉시</b> 막힌다.
   */
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true

    const code = params.get('code')
    const state = params.get('state')
    /*
     * 사용자가 동의 화면에서 취소하면 code 대신 error가 온다. 이건 실패가 아니라
     * 사용자의 선택이라, 오류 문구 대신 조용히 로그인 화면으로 돌려보낸다.
     */
    if (params.get('error') !== null) {
      navigate('/login', { replace: true })
      return
    }

    if (provider === undefined || !SUPPORTED.includes(provider as SocialProvider)) {
      setPhase({ status: 'failed', message: '지원하지 않는 로그인 방식이에요.' })
      return
    }
    if (code === null) {
      setPhase({ status: 'failed', message: '로그인 정보가 없어요. 다시 시도해 주세요.' })
      return
    }
    /*
     * 우리가 시작한 로그인이 맞는지 확인한다. 이 검사가 없으면 남이 만들어둔 로그인 주소를
     * 눌렀을 때 그 사람의 계정으로 로그인되고, 사용자는 자기 계정인 줄 알고 코스를 저장한다.
     *
     * 통과한 state는 아래에서 서버로도 넘어간다 — 네이버가 토큰 교환에 그 값을 요구한다.
     * 확인이 먼저다. 검사를 통과하지 못한 값을 서버로 보내지 않는다.
     */
    if (!consumeState(state)) {
      setPhase({ status: 'failed', message: '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.' })
      return
    }

    auth
      .completeSocialLogin(provider as SocialProvider, code, state)
      .then((candidate) => {
        if (candidate === null) {
          // replace를 쓴다. 뒤로 가기를 눌렀을 때 이미 써버린 코드가 담긴 주소로 돌아오면 실패한다.
          navigate(consumeReturnTo(), { replace: true })
          return
        }
        setPhase({ status: 'linking', candidate })
      })
      .catch((error: unknown) => {
        setPhase({
          status: 'failed',
          message:
            error instanceof ApiRequestError
              ? error.message
              : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
        })
      })
  }, [auth, navigate, params, provider])

  if (phase.status === 'linking') {
    return <LinkForm candidate={phase.candidate} />
  }

  return (
    <AuthShell
      panelTitle="잠시만요"
      panelDescription="로그인을 마무리하고 있어요."
      footer={null}
    >
      <div className="flex flex-col gap-3 pt-10">
        {phase.status === 'working' ? (
          <p className="text-muted m-0 text-[15px]">로그인 중이에요…</p>
        ) : (
          <>
            <h1 className="text-fg m-0 text-[22px] font-bold tracking-[-0.02em]">
              로그인하지 못했어요
            </h1>
            <p className="text-muted m-0 text-[14.5px] leading-[1.6]">{phase.message}</p>
            <Link
              to="/login"
              className={`${PRIMARY_BUTTON} mt-2 flex items-center justify-center no-underline`}
            >
              로그인 화면으로
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}

/**
 * 기존 계정과 이을지 확인하는 화면.
 *
 * <p>비밀번호를 묻는 이유를 <b>화면에 적는다.</b> 소셜 로그인을 눌렀는데 갑자기 비밀번호를
 * 요구하면 사용자는 피싱을 의심한다. "이미 이 이메일로 가입한 계정이 있다"는 사실을 먼저
 * 보여주면 묻는 이유가 납득된다.
 */
function LinkForm({ candidate }: { candidate: SocialLinkCandidate }) {
  const auth = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length === 0) {
      setFailure('비밀번호를 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setFailure(null)
    try {
      await auth.linkSocial({ linkTicket: candidate.linkTicket, password })
      navigate(consumeReturnTo(), { replace: true })
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiRequestError
          ? error.message
          : '연결에 실패했어요. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      panelTitle="계정을 이어드릴게요"
      panelDescription="이미 쓰던 계정에 간편 로그인을 붙입니다."
      footer={null}
    >
      <form className="flex flex-col gap-3.5 pt-8" onSubmit={handleSubmit}>
        <h1 className="text-fg m-0 text-[22px] font-bold tracking-[-0.02em]">
          이미 가입한 계정이 있어요
        </h1>
        <p className="text-muted m-0 text-[14.5px] leading-[1.65]">
          <strong className="text-fg font-semibold">{candidate.email}</strong>로 가입한 계정이
          있어요. 비밀번호를 입력하면 {candidate.provider} 계정을 연결해 드릴게요. 저장해둔 코스도
          그대로 남아요.
        </p>

        <AuthField
          id="link-password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setFailure(null)
          }}
          autoComplete="current-password"
          error={failure ?? undefined}
        />

        <button type="submit" className={PRIMARY_BUTTON} disabled={submitting}>
          {submitting ? '연결하는 중…' : '연결하고 로그인'}
        </button>

        {/*
          빠져나갈 길을 남긴다. 비밀번호가 기억나지 않는 사람을 이 화면에 가둘 수 없다.
          지금은 새 계정으로 가는 길이 없어(연결하지 않으면 로그인되지 않는다) 로그인 화면으로
          돌려보낸다 — 이메일과 비밀번호로는 여전히 들어올 수 있다.
        */}
        <Link
          to="/login"
          className="text-hint hover:text-fg mt-1 self-center py-1 text-[13px] no-underline"
        >
          다음에 할게요
        </Link>
      </form>
    </AuthShell>
  )
}
