import { useState } from 'react'
import { ChevronRight } from '../components/icons'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AuthField } from '../components/AuthField'
import { AuthShell } from '../components/AuthShell'
import { BrandLockup } from '../components/BrandMark'
import { PRIMARY_BUTTON } from '../components/styles'
import { ApiRequestError } from '../services/api'
import { startSocialLogin } from '../services/socialLogin'
import { useAuth } from '../state/authContext'
import type { SocialProvider } from '../types/api'
import { validateEmail, validatePasswordPresence } from '../utils/validation'

interface Errors {
  email?: string
  password?: string
}

/** 카카오·네이버 버튼. 두 곳(모바일·데스크톱)에서 같은 모양이라 상수로 둔다. */
const SOCIAL_BUTTON =
  'flex h-13 w-full cursor-pointer items-center justify-center gap-2.25 rounded-ui border-0 text-[15.5px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-default'

/** 문구에 쓰는 이름. 실패 안내가 "어느 쪽이 안 됐는지"까지 말할 수 있어야 한다. */
const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()

  /**
   * 로그인을 마친 뒤 돌아갈 곳. 저장 시트가 넘겨준다.
   *
   * <p>없으면 지금까지처럼 뒤로 한 걸음 물러난다. 다만 가입 화면을 거쳐 왔다면 그 한 걸음이
   * 가입 화면이라, 이미 로그인한 사람에게 가입 폼을 다시 보여주게 된다. 그래서 이 값이 있으면
   * 그쪽을 우선한다.
   */
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<string | null>(null)
  /** 서버가 거절한 이유. 특정 칸의 문제가 아니라 조합의 문제라 폼 전체에 붙인다 */
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /**
   * 어느 제공자로 넘어가는 중인가. 아무 데도 아니면 null.
   *
   * 참/거짓이 아니라 <b>제공자를 담는</b> 이유: 두 버튼이 다 살아 있어, 참·거짓으로 두면
   * 카카오를 눌렀는데 네이버 버튼까지 "이동 중"이 된다. 누른 쪽만 그렇게 말해야 한다.
   */
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)

  /**
   * 소셜 로그인 시작.
   *
   * 성공하면 이 페이지를 떠나므로 <b>끝나고 정리하는 코드가 없다.</b> 실패했을 때만
   * 다시 누를 수 있게 되돌린다 — 인증키가 없는 배포이거나 서버가 꺼져 있는 경우다.
   *
   * 돌아올 곳으로 {@link from}을 넘긴다. 저장하려다 로그인하러 온 사람이 제공자 화면을 거쳐
   * 돌아왔을 때, 보던 화면이 아니라 홈으로 떨어지면 저장하려던 것을 다시 찾아가야 한다.
   */
  async function handleSocial(provider: SocialProvider) {
    setPendingProvider(provider)
    setNotice(null)
    setFailure(null)
    try {
      await startSocialLogin(provider, from ?? '/')
    } catch (error: unknown) {
      setPendingProvider(null)
      setFailure(
        error instanceof ApiRequestError
          ? error.message
          : `${PROVIDER_LABEL[provider]} 로그인을 시작하지 못했어요.
잠시 후 다시 시도해 주세요.`,
      )
    }
  }

  /**
   * 입력을 고치면 그 칸의 오류 문구를 즉시 지운다.
   *
   * 오류를 그대로 두면 이미 고친 칸에 빨간 글씨가 남아, 무엇을 더 고쳐야 하는지 알 수 없다.
   */
  function update(field: keyof Errors, setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setErrors((current) => ({ ...current, [field]: undefined }))
      setNotice(null)
      setFailure(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: Errors = {
      email: validateEmail(email),
      password: validatePasswordPresence(password),
    }
    setErrors(next)
    setFailure(null)

    if (next.email || next.password) {
      return
    }

    setSubmitting(true)
    try {
      await auth.login({ email: email.trim(), password })
      // 로그인 전에 보던 화면으로 돌려보낸다. 계정 만들기는 목적이 아니라 거쳐가는 단계다.
      if (from) {
        // 저장하러 온 사람은 돌아간 화면에서 시트가 다시 열려야 한다
        navigate(from, { replace: true, state: { resumeSave: true } })
      } else {
        navigate(-1)
      }
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiRequestError ? error.message : '로그인하지 못했습니다.\n잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      /*
        여기도 "피해서"였다. 진입 화면(PlanPage)의 큰 제목과 같은 말투인데,
        고친 자리와 안 고친 자리가 갈리면 서비스가 두 목소리로 말하게 된다.
        우리가 하는 일은 알려주는 것이고, 피할지는 사용자가 정한다.
      */
      panelTitle={
        <>
          붐비는 곳은 미리 알려드리고,
          <br />
          계획은 저장해두고
        </>
      }
      panelDescription={'로그인은 코스를 저장할 때만 필요해요.\n계획을 짜고 혼잡도를 확인하는 건 계정 없이도 전부 가능합니다.'}
    >
      {/* 데스크톱에서는 좌측 패널이 로고를 들고 있다. 두 번 보일 이유가 없다. */}
      <BrandLockup size={24} className="pt-2 lg:hidden" />

      <div className="flex flex-col gap-2.5 pt-3 pb-6">
        <h1 className="text-fg m-0 text-[27px] leading-[1.3] font-bold tracking-[-0.025em]">
          다시 오셨네요
        </h1>
        <p className="m-0 text-[14.5px] leading-[1.6] text-pretty">
          로그인하면 저장한 코스를 어느 기기에서든 이어서 볼 수 있어요.
        </p>
      </div>

      {/*
        코스를 저장하려다 넘어온 사람에게만 뜬다.

        <b>게스트가 가장 걱정하는 것은 "지금 짠 것이 날아가나"다.</b> 그 답을 먼저 주지 않으면
        로그인 화면이 위험해 보여서 뒤로 가버린다. 예전에는 저장 시트가 이 말을 했는데,
        게스트를 로그인 화면으로 바로 보내면서 이 자리로 옮겨 왔다.
      */}
      {from && (
        <div className="bg-moderate-tint mb-5 flex items-start gap-2.75 rounded-[16px] px-3.75 py-3.5">
          <span
            className="bg-moderate-soft text-moderate-deep mt-px grid h-4.5 w-4.5 flex-none place-items-center rounded-full text-[11px] font-bold"
            aria-hidden="true"
          >
            !
          </span>
          <div className="flex flex-col gap-0.75">
            <span className="text-moderate-deep text-[13.5px] font-semibold">
              지금 짠 코스는 그대로 있어요
            </span>
            <span className="text-moderate-deep/85 text-[12.5px] leading-[1.6]">
              로그인을 마치면 그 화면으로 돌아와 바로 저장할 수 있어요.
            </span>
          </div>
        </div>
      )}

      {/* noValidate: 브라우저 기본 말풍선 대신 우리 문구를 쓴다. 기본 말풍선은
          영어로 나올 수 있고 화면 디자인과도 따로 논다. */}
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="login-email"
          label="이메일"
          type="email"
          value={email}
          onChange={update('email', setEmail)}
          error={errors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />

        <AuthField
          id="login-password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={update('password', setPassword)}
          error={errors.password}
          autoComplete="current-password"
          placeholder="••••••••"
          labelAction={
            <button
              type="button"
              className="text-hint hover:text-muted cursor-pointer bg-transparent text-[12.5px] font-medium"
              onClick={() =>
                setNotice('비밀번호 찾기는 준비 중이에요.')
              }
            >
              비밀번호 찾기
            </button>
          }
        />

        {failure && (
          <div
            className="bg-crowded-tint rounded-ui text-crowded-deep px-3.5 py-3 text-xs leading-[1.65] whitespace-pre-line"
            role="alert"
          >
            {failure}
          </div>
        )}

        {notice && (
          <div
            className="bg-brand-tint rounded-ui text-brand-deep px-3.5 py-3 text-xs leading-[1.65]"
            role="status"
          >
            {notice}
          </div>
        )}

        <button type="submit" className={`${PRIMARY_BUTTON} mt-1`} disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>

        <p className="text-hint m-0 pt-0.5 text-center text-[13.5px]">
          계정이 없으신가요?{' '}
          <Link to="/signup" state={location.state} className="text-brand-deep font-semibold">
            회원가입
          </Link>
        </p>
      </form>

      <div className="flex items-center gap-3 pt-6.5 pb-4">
        <span className="bg-line h-px flex-1" aria-hidden="true" />
        <span className="text-hint text-xs">간편 로그인</span>
        <span className="bg-line h-px flex-1" aria-hidden="true" />
      </div>

      {/*
        버튼을 누르면 제공자 쪽으로 <b>화면이 통째로 넘어간다.</b> 그래서 이동 중 상태를 화면에
        오래 남길 필요가 없다 — 다만 주소를 받아오는 사이(수백 ms) 두 번 눌리는 것은 막는다.

        한쪽으로 넘어가는 동안 <b>둘 다</b> 잠근다. 곧 떠날 화면에서 다른 제공자를 새로 시작하면
        state가 덮어써져, 먼저 시작한 쪽이 돌아왔을 때 "우리가 시작한 로그인이 아니다"로 막힌다.
      */}
      <div className="flex flex-col gap-2.25 lg:flex-row">
        <button
          type="button"
          className={`${SOCIAL_BUTTON} bg-[#FEE500] text-[#191600]`}
          disabled={pendingProvider !== null}
          onClick={() => handleSocial('kakao')}
        >
          <span
            className="grid h-4.75 w-4.75 place-items-center rounded-full bg-[#191600] text-[11px] font-bold text-[#FEE500]"
            aria-hidden="true"
          >
            K
          </span>
          {pendingProvider === 'kakao' ? '카카오로 이동 중…' : '카카오로 계속하기'}
        </button>
        <button
          type="button"
          className={`${SOCIAL_BUTTON} bg-[#03C75A] text-white`}
          disabled={pendingProvider !== null}
          onClick={() => handleSocial('naver')}
        >
          <span
            className="grid h-4.75 w-4.75 place-items-center rounded-[5px] bg-white text-xs font-extrabold text-[#03C75A]"
            aria-hidden="true"
          >
            N
          </span>
          {pendingProvider === 'naver' ? '네이버로 이동 중…' : '네이버로 계속하기'}
        </button>
      </div>

      {/*
        mt-auto로 화면 아래에 붙인다. 데스크톱에서는 좌측 패널이 같은 링크를 들고 있어 감춘다.
        로그인 화면에서 돌아 나가는 길은 항상 열려 있어야 한다 — 로그인은 진입 장벽이 아니다.
      */}
      <div className="mt-auto pt-9 lg:hidden">
        <Link
          to="/"
          className="rounded-ui text-muted hover:text-fg bg-fill flex h-12.5 w-full items-center justify-center gap-1.5 text-[14.5px] font-semibold no-underline transition-colors"
        >
          로그인 없이 둘러보기 <ChevronRight size={15} />
        </Link>
      </div>
    </AuthShell>
  )
}
