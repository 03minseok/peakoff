import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthField } from '../components/AuthField'
import { AuthShell } from '../components/AuthShell'
import { PRIMARY_BUTTON } from '../components/styles'
import { useTrip } from '../state/tripContext'
import { passwordStrength } from '../utils/passwordStrength'
import { validateEmail, validatePassword } from '../utils/validation'

const NICKNAME_MAX_LENGTH = 12

/**
 * 동의 항목.
 *
 * 필수와 선택을 구조로 구분한다. 라벨 문구에만 "(필수)"를 적어두면
 * 제출 가능 여부를 판단하는 코드가 문자열을 뒤져야 한다.
 */
const TERMS = [
  { id: 'age', label: '만 14세 이상입니다 (필수)', required: true, hasDetail: false },
  { id: 'tos', label: '서비스 이용약관 (필수)', required: true, hasDetail: true },
  { id: 'privacy', label: '개인정보 처리방침 (필수)', required: true, hasDetail: true },
  { id: 'marketing', label: '혼잡도 알림 및 소식 받기 (선택)', required: false, hasDetail: true },
] as const

type TermId = (typeof TERMS)[number]['id']
type Agreed = Record<TermId, boolean>

const NO_AGREEMENT: Agreed = { age: false, tos: false, privacy: false, marketing: false }

const CHECKBOX_BASE =
  'grid h-5.5 w-5.5 flex-none place-items-center rounded-[7px] text-xs font-bold'
const CHECKBOX_ON = `${CHECKBOX_BASE} bg-brand text-white`
const CHECKBOX_OFF = `${CHECKBOX_BASE} bg-[#EDF1F0] text-[#CBD6D5]`

interface Errors {
  email?: string
  password?: string
}

export function SignupPage() {
  const { state } = useTrip()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [agreed, setAgreed] = useState<Agreed>(NO_AGREEMENT)
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<string | null>(null)

  const strength = passwordStrength(password)

  /*
   * 비밀번호 확인은 <b>입력하는 동안</b> 검사한다.
   *
   * 다른 칸과 달리 이건 사용자가 "지금 제대로 따라 치고 있는지"를 알아야 하는 값이다.
   * 제출한 뒤에 알려주면 두 칸을 다 지우고 처음부터 다시 치게 된다.
   */
  const mismatch = confirm.length > 0 && password !== confirm

  const allAgreed = TERMS.every((term) => agreed[term.id])
  const requiredAgreed = TERMS.filter((term) => term.required).every((term) => agreed[term.id])

  const filled =
    email.length > 0 && password.length > 0 && confirm.length > 0 && nickname.length > 0
  const canSubmit = filled && !mismatch && requiredAgreed

  // 짜던 코스가 있으면 가입이 곧 그 코스를 저장하는 일이 된다. 그때만 버튼이 그렇게 말한다.
  const hasCourse = state.days.some((day) => day.length > 0)

  function toggleAll() {
    const next = !allAgreed
    setAgreed({ age: next, tos: next, privacy: next, marketing: next })
  }

  function toggle(id: TermId) {
    setAgreed((current) => ({ ...current, [id]: !current[id] }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    /*
     * 빈 칸 검사는 여기서 하지 않는다. 하나라도 비어 있으면 버튼이 아예 눌리지 않으므로
     * 이 지점에 도달했다는 것은 전부 채워졌다는 뜻이다. 남은 것은 "모양이 맞는가"뿐이다.
     */
    const next: Errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setErrors(next)

    if (next.email || next.password) {
      return
    }

    // TODO(2층): POST /api/auth/signup 을 호출한다. 동의 항목도 함께 보낸다.
    setNotice(
      '계정 기능은 준비 중이에요. 지금은 가입 없이도 코스 편집·진단·대안 추천까지 모두 이용할 수 있어요.',
    )
  }

  return (
    <AuthShell
      panelTitle={
        <>
          한적한 여행을
          <br />
          계정에 담아두세요
        </>
      }
      panelDescription="가입하면 완성한 코스를 저장해두고, 다음에 짠 코스와 한적 지수를 나란히 맞대어 볼 수 있어요."
      footer={
        <div className="flex flex-col gap-2.5">
          <button
            type="submit"
            form="signup-form"
            className={PRIMARY_BUTTON}
            disabled={!canSubmit}
          >
            {hasCourse ? '가입하고 코스 저장하기' : '가입하기'}
          </button>
          <Link to="/" className="text-hint hover:text-muted text-center text-[13.5px] font-medium">
            로그인 없이 둘러보기
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5 pt-3 pb-6">
        <h1 className="text-fg m-0 text-[27px] leading-[1.3] font-bold tracking-[-0.025em]">
          계정 만들기
        </h1>
        <p className="m-0 text-[14.5px] leading-[1.6] text-pretty">
          30초면 돼요. 지금까지 짠 코스도 그대로 옮겨집니다.
        </p>
      </div>

      {/*
        제출 버튼이 폼 바깥(화면 아래 고정 영역)에 있다. form 속성으로 이 폼과 이어주면
        버튼을 폼 안에 두지 않고도 Enter 키 제출과 submit 이벤트가 그대로 동작한다.
      */}
      <form id="signup-form" className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="signup-email"
          label="이메일"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value)
            setErrors((current) => ({ ...current, email: undefined }))
            setNotice(null)
          }}
          error={errors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />

        <AuthField
          id="signup-password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setErrors((current) => ({ ...current, password: undefined }))
            setNotice(null)
          }}
          error={errors.password}
          autoComplete="new-password"
          placeholder="8자 이상, 숫자 포함"
          below={
            <div className="flex items-center gap-2.25">
              <div className="bg-line/70 h-1.25 flex-1 overflow-hidden rounded-[3px]">
                <div
                  className={`h-full rounded-[3px] transition-all duration-200 ${strength.barClass}`}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
              {/* 폭을 고정해 라벨 길이가 바뀌어도 막대가 흔들리지 않게 한다. */}
              <span
                className={`w-13 flex-none text-right text-[11.5px] font-semibold ${strength.textClass}`}
              >
                {strength.label}
              </span>
            </div>
          }
        />

        <AuthField
          id="signup-password-confirm"
          label="비밀번호 확인"
          type="password"
          value={confirm}
          onChange={(value) => {
            setConfirm(value)
            setNotice(null)
          }}
          error={mismatch ? '비밀번호가 일치하지 않아요' : undefined}
          autoComplete="new-password"
          placeholder="한 번 더 입력해주세요"
        />

        <AuthField
          id="signup-nickname"
          label="닉네임"
          type="text"
          value={nickname}
          onChange={(value) => {
            setNickname(value)
            setNotice(null)
          }}
          autoComplete="nickname"
          placeholder="코스에 표시될 이름"
          maxLength={NICKNAME_MAX_LENGTH}
          below={
            <span className="text-hint text-xs">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          }
        />

        <div className="bg-surface shadow-rest mt-1 flex flex-col rounded-[18px] px-4">
          <button
            type="button"
            onClick={toggleAll}
            className="border-line/60 flex h-13.5 cursor-pointer items-center gap-2.75 border-b bg-transparent p-0 text-left"
          >
            <span className={allAgreed ? CHECKBOX_ON : CHECKBOX_OFF} aria-hidden="true">
              ✓
            </span>
            <span className="text-fg text-[15px] font-semibold">전체 동의</span>
          </button>

          {TERMS.map((term) => (
            <div key={term.id} className="flex h-12 items-center gap-2.75">
              <button
                type="button"
                onClick={() => toggle(term.id)}
                className="flex cursor-pointer items-center gap-2.75 bg-transparent p-0 text-left"
                aria-pressed={agreed[term.id]}
              >
                <span className={agreed[term.id] ? CHECKBOX_ON : CHECKBOX_OFF} aria-hidden="true">
                  ✓
                </span>
                <span className="text-muted text-sm">{term.label}</span>
              </button>
              <span className="flex-1" />
              {term.hasDetail && (
                <button
                  type="button"
                  className="text-hint hover:text-muted cursor-pointer bg-transparent px-0.5 py-1.5 text-[12.5px]"
                  onClick={() => setNotice('약관 전문은 준비 중이에요.')}
                >
                  보기
                </button>
              )}
            </div>
          ))}
        </div>

        {notice && (
          <div
            className="bg-brand-tint rounded-ui text-brand-deep px-3.5 py-3 text-xs leading-[1.65]"
            role="status"
          >
            {notice}
          </div>
        )}

        <p className="text-hint m-0 pt-1 pb-2 text-center text-[13.5px]">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-brand font-semibold">
            로그인
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
