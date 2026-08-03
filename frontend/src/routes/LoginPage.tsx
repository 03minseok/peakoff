import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthField } from '../components/AuthField'
import { AuthShell } from '../components/AuthShell'
import { PRIMARY_BUTTON } from '../components/styles'
import { validateEmail, validatePasswordPresence } from '../utils/validation'

interface Errors {
  email?: string
  password?: string
}

/** 카카오·네이버 버튼. 두 곳(모바일·데스크톱)에서 같은 모양이라 상수로 둔다. */
const SOCIAL_BUTTON =
  'flex h-13 w-full cursor-pointer items-center justify-center gap-2.25 rounded-ui border-0 text-[15.5px] font-semibold transition-opacity hover:opacity-90'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<string | null>(null)

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
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: Errors = {
      email: validateEmail(email),
      password: validatePasswordPresence(password),
    }
    setErrors(next)

    if (next.email || next.password) {
      return
    }

    // TODO(2층): POST /api/auth/login 을 호출하고 받은 토큰을 보관한다.
    setNotice(
      '계정 기능은 준비 중이에요. 지금은 로그인 없이도 코스 편집·진단·대안 추천까지 모두 이용할 수 있어요.',
    )
  }

  return (
    <AuthShell
      panelTitle={
        <>
          붐비는 곳은 피해서,
          <br />
          계획은 저장해두고
        </>
      }
      panelDescription="로그인은 코스를 저장할 때만 필요해요. 계획을 짜고 혼잡도를 확인하는 건 계정 없이도 전부 가능합니다."
    >
      {/* 데스크톱에서는 좌측 패널이 로고를 들고 있다. 두 번 보일 이유가 없다. */}
      <div className="flex items-center gap-2 pt-2 lg:hidden">
        <span className="bg-brand relative h-5.5 w-5.5 rounded-[8px]" aria-hidden="true">
          <span className="bg-bg absolute top-1.75 left-1.75 h-2 w-2 rounded-full" />
        </span>
        <span className="text-fg text-xs font-bold tracking-[0.16em]">PEAKOFF</span>
      </div>

      <div className="flex flex-col gap-2.5 pt-3 pb-6">
        <h1 className="text-fg m-0 text-[27px] leading-[1.3] font-bold tracking-[-0.025em]">
          다시 오셨네요
        </h1>
        <p className="m-0 text-[14.5px] leading-[1.6] text-pretty">
          로그인하면 저장한 코스를 어느 기기에서든 이어서 볼 수 있어요.
        </p>
      </div>

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
                setNotice('비밀번호 찾기도 계정 기능과 함께 열릴 예정이에요.')
              }
            >
              비밀번호 찾기
            </button>
          }
        />

        {notice && (
          <div
            className="bg-brand-tint rounded-ui text-brand-deep px-3.5 py-3 text-xs leading-[1.65]"
            role="status"
          >
            {notice}
          </div>
        )}

        <button type="submit" className={`${PRIMARY_BUTTON} mt-1`}>
          로그인
        </button>

        <p className="text-hint m-0 pt-0.5 text-center text-[13.5px]">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="text-brand font-semibold">
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
        카카오·네이버는 자리만 잡아둔다. 소셜 로그인은 외부 개발자 등록과 검수가 필요해
        마감 일정상 마지막 순서다. 화면을 먼저 완성해두면 나중에 이 버튼의
        onClick만 바꿔 끼우면 된다.
      */}
      <div className="flex flex-col gap-2.25 lg:flex-row">
        <button
          type="button"
          className={`${SOCIAL_BUTTON} bg-[#FEE500] text-[#191600]`}
          onClick={() => setNotice('간편 로그인은 준비 중이에요. 이메일로 먼저 이용해 주세요.')}
        >
          <span
            className="grid h-4.75 w-4.75 place-items-center rounded-full bg-[#191600] text-[11px] font-bold text-[#FEE500]"
            aria-hidden="true"
          >
            K
          </span>
          카카오로 계속하기
        </button>
        <button
          type="button"
          className={`${SOCIAL_BUTTON} bg-[#03C75A] text-white`}
          onClick={() => setNotice('간편 로그인은 준비 중이에요. 이메일로 먼저 이용해 주세요.')}
        >
          <span
            className="grid h-4.75 w-4.75 place-items-center rounded-[5px] bg-white text-xs font-extrabold text-[#03C75A]"
            aria-hidden="true"
          >
            N
          </span>
          네이버로 계속하기
        </button>
      </div>
      <p className="text-hint pt-2.5 text-center text-xs">간편 로그인은 준비 중이에요</p>

      {/*
        mt-auto로 화면 아래에 붙인다. 데스크톱에서는 좌측 패널이 같은 링크를 들고 있어 감춘다.
        로그인 화면에서 돌아 나가는 길은 항상 열려 있어야 한다 — 로그인은 진입 장벽이 아니다.
      */}
      <div className="mt-auto pt-9 lg:hidden">
        <Link
          to="/"
          className="rounded-ui text-muted hover:text-fg flex h-12.5 w-full items-center justify-center gap-1.5 bg-[#EDF1F0] text-[14.5px] font-semibold no-underline transition-colors"
        >
          로그인 없이 둘러보기 <span aria-hidden="true">›</span>
        </Link>
      </div>
    </AuthShell>
  )
}
