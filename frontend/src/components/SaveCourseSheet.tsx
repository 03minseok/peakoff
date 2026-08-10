import { useEffect, useState } from 'react'
import { ArrowDownToLine } from './icons'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../state/authContext'
import { PRIMARY_BUTTON, TEXT_INPUT } from './styles'

/** 여행 이름 최대 길이. 서버 SavedCourse.NAME_MAX_LENGTH와 같은 값이어야 한다 */
const NAME_MAX_LENGTH = 30

interface Props {
  /** 이름 입력란에 미리 채워둘 값. 예: "경주 2박 3일" */
  defaultName: string
  onClose: () => void
  /** 계정 저장. 실패하면 예외를 던진다 */
  onSave: (name: string) => Promise<void>
}

type Phase = 'asking' | 'saved' | 'failed'

const OUTLINE_BUTTON =
  'h-13 cursor-pointer rounded-ui border border-line bg-surface text-[15.5px] font-semibold text-fg transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-hint'

const GHOST_BUTTON =
  'h-11 cursor-pointer rounded-ui bg-transparent text-[13.5px] font-medium text-hint transition-colors hover:text-muted'

/**
 * 코스를 저장하려 할 때 아래에서 올라오는 시트.
 *
 * <p>화면을 옮기지 않고 그 자리에서 묻는다. 저장은 결과를 확인하다가 곁들이는 행동이지
 * 새 화면으로 넘어갈 만큼 큰 일이 아니다.
 *
 * <h3>저장은 계정에만 한다</h3>
 * 예전에는 "이 기기에만 저장"(localStorage)이 함께 있었다. 뺀 이유는 그 저장이
 * <b>저장처럼 보이지만 저장이 아니었기</b> 때문이다 — 브라우저 데이터를 지우거나 다른 기기로
 * 옮기면 사라지고, 시크릿 모드에서는 애초에 실패한다. 사용자는 "저장했다"고 믿는데
 * 서비스는 그걸 지켜줄 수 없는 상태였다.
 *
 * <p>대신 <b>게스트는 저장 직전까지 전부 쓸 수 있다.</b> 코스 편집·진단·대안 교체·날짜 이동은
 * 로그인 없이 그대로 돌아간다. 로그인은 진입 장벽이 아니라 남기고 싶을 때 거치는 문이다.
 *
 * <p>그래서 게스트에게는 <b>이름을 묻지 않는다.</b> 아직 저장할 수 없는데 이름부터 짓게 하면
 * 채워 넣은 것이 버려진다.
 */
export function SaveCourseSheet({ defaultName, onClose, onSave }: Props) {
  const { member } = useAuth()
  const location = useLocation()

  const [name, setName] = useState(defaultName)
  const [phase, setPhase] = useState<Phase>('asking')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)

    // 시트가 떠 있는 동안 뒤 화면이 같이 스크롤되면 어느 쪽을 조작하는지 헷갈린다.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const trimmedName = name.trim()
  const nameIsValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH

  async function handleSave() {
    if (!nameIsValid) {
      return
    }
    setFailure(null)
    setSaving(true)
    try {
      await onSave(trimmedName)
      setPhase('saved')
    } catch (error: unknown) {
      // 서버가 이유를 준다(저장 개수 초과 등). 그대로 보여주는 편이 친절하다.
      setFailure(error instanceof Error ? error.message : '저장하지 못했어요.')
      setPhase('failed')
    } finally {
      setSaving(false)
    }
  }

  /*
   * 로그인·가입을 마치면 이 화면으로 되돌아오게 한다.
   *
   * 없으면 게스트가 "로그인하고 저장하기"를 눌렀다가 홈으로 떨어져, 방금 짠 코스를 스스로
   * 찾아 들어와야 한다. 코스 자체는 sessionStorage에 남아 있지만 <b>돌아오는 길이 없으면</b>
   * 남아 있다는 사실을 알 방법이 없다.
   */
  const returnTo = { from: location.pathname }

  const title =
    phase === 'saved'
      ? '계정에 저장했어요'
      : phase === 'failed'
        ? '저장하지 못했어요'
        : member
          ? '코스를 저장할까요?'
          : null

  const description =
    phase === 'saved'
      ? '어느 기기에서 로그인해도 이 코스를 다시 열어볼 수 있어요.'
      : phase === 'failed'
        ? (failure ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
        : member
          ? '이름을 붙여 계정에 담아두면 나중에 다른 코스와 나란히 볼 수 있어요.'
          : '계정을 만들면 짠 코스를 저장해두고, 다음에 짠 코스와 한적 지수를 나란히 맞대어 볼 수 있어요.'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/*
        뒤 화면을 덮는 막. 눌러서 닫을 수 있다.
        버튼이 아니라 div이므로 키보드 사용자를 위해 아래 "나중에 할게요"와 Esc가 같은 일을 한다.
      */}
      <div
        className="absolute inset-0 bg-[rgb(22_33_31/0.4)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="bg-bg relative max-h-[92svh] overflow-y-auto rounded-t-[26px] shadow-[0_-10px_40px_rgb(22_33_31/0.24)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-course-title"
      >
        {/* 손잡이. 이 면이 아래에서 끌어올린 것이라는 신호다. */}
        <div className="flex justify-center pt-2.5">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="mx-auto flex w-full max-w-form flex-col gap-4.5 px-5.5 pt-5 pb-6">
          <div className="flex flex-col gap-2.25">
            <span
              className="bg-brand-tint text-brand-deep grid h-11.5 w-11.5 place-items-center rounded-[16px] text-xl"
              aria-hidden="true"
            >
              <ArrowDownToLine />
            </span>
            <h2
              id="save-course-title"
              className="text-fg m-0 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-pretty"
            >
              {title ?? (
                <>
                  코스를 저장하려면
                  <br />
                  로그인하세요
                </>
              )}
            </h2>
            <p className="m-0 text-sm leading-[1.65] text-pretty">{description}</p>
          </div>

          {/*
            이름은 <b>저장할 수 있는 사람에게만</b> 묻는다. 저장을 마친 뒤에도 묻지 않는다 —
            이름을 고치는 자리는 목록이지 여기가 아니다.
          */}
          {member && phase !== 'saved' && (
            <div className="flex flex-col gap-1.75">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="course-name" className="text-muted text-[12.5px] font-semibold">
                  여행 이름
                </label>
                <span
                  className={`text-xs ${trimmedName.length > NAME_MAX_LENGTH ? 'text-crowded-deep' : 'text-hint'}`}
                >
                  {trimmedName.length}/{NAME_MAX_LENGTH}
                </span>
              </div>
              <input
                id="course-name"
                type="text"
                className={TEXT_INPUT}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={NAME_MAX_LENGTH}
                placeholder="예: 한적한 경주 첫 여행"
              />
            </div>
          )}

          {/*
            게스트가 가장 걱정하는 것은 "지금 짠 것이 날아가나"다. 그 답을 먼저 준다.
            이 안내가 없으면 로그인 버튼이 위험해 보여서 그냥 닫게 된다.
          */}
          {!member && phase === 'asking' && (
            <div className="bg-moderate-tint flex items-start gap-2.75 rounded-[16px] px-3.75 py-3.5">
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
                  로그인을 마치면 이 화면으로 돌아와 바로 저장할 수 있어요.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.25">
            {phase === 'saved' ? (
              <>
                <Link
                  to="/my"
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  마이페이지에서 보기
                </Link>
                <button type="button" className={OUTLINE_BUTTON} onClick={onClose}>
                  닫기
                </button>
              </>
            ) : member ? (
              <>
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={() => void handleSave()}
                  disabled={!nameIsValid || saving}
                >
                  {saving ? '저장 중…' : '저장하기'}
                </button>
                <button type="button" className={GHOST_BUTTON} onClick={onClose}>
                  나중에 할게요
                </button>
              </>
            ) : (
              <>
                {/*
                  가입을 먼저 권한다. 여기까지 온 게스트는 계정이 없을 가능성이 높다 —
                  있었다면 진작 로그인해서 이 화면을 안 봤을 것이다.
                */}
                <Link
                  to="/signup"
                  state={returnTo}
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  회원가입하고 저장하기
                </Link>
                <Link
                  to="/login"
                  state={returnTo}
                  className={`${OUTLINE_BUTTON} grid place-items-center no-underline`}
                >
                  이미 계정이 있어요
                </Link>
                <button type="button" className={GHOST_BUTTON} onClick={onClose}>
                  나중에 할게요
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
