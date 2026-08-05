import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../state/authContext'
import { PRIMARY_BUTTON, TEXT_INPUT } from './styles'

/** 여행 이름 최대 길이. 서버 SavedCourse.NAME_MAX_LENGTH와 같은 값이어야 한다 */
const NAME_MAX_LENGTH = 30

interface Props {
  /** 이름 입력란에 미리 채워둘 값. 예: "경주 2박 3일" */
  defaultName: string
  onClose: () => void
  /** 기기(localStorage) 저장. @returns 성공했는지 */
  onSaveToDevice: (name: string) => boolean
  /** 계정 저장. 로그인 상태일 때만 쓰인다. 실패하면 예외를 던진다 */
  onSaveToAccount: (name: string) => Promise<void>
}

type Phase = 'asking' | 'savedToDevice' | 'savedToAccount' | 'failed'

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
 * <p><b>이름은 목적지와 무관하게 한 번만 묻는다.</b> 기기에 저장하든 계정에 저장하든
 * 나중에 목록에서 알아볼 이름이 필요한 것은 같다. 기본값을 미리 채워 두는 것이 중요한데,
 * 빈칸으로 두면 "이름 짓기"가 저장을 막는 관문이 된다.
 *
 * <p>로그인 여부에 따라 묻는 내용이 다르다. 게스트에게는 로그인을 권하되 막지 않고,
 * 회원에게는 이미 한 일을 다시 시키지 않는다.
 */
export function GuestSaveSheet({ defaultName, onClose, onSaveToDevice, onSaveToAccount }: Props) {
  const { member } = useAuth()
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

  function handleSaveToDevice() {
    if (!nameIsValid) {
      return
    }
    setFailure(null)
    setPhase(onSaveToDevice(trimmedName) ? 'savedToDevice' : 'failed')
  }

  async function handleSaveToAccount() {
    if (!nameIsValid) {
      return
    }
    setFailure(null)
    setSaving(true)
    try {
      await onSaveToAccount(trimmedName)
      setPhase('savedToAccount')
    } catch (error: unknown) {
      // 서버가 이유를 준다(저장 개수 초과 등). 그대로 보여주는 편이 친절하다.
      setFailure(error instanceof Error ? error.message : '저장하지 못했어요.')
      setPhase('failed')
    } finally {
      setSaving(false)
    }
  }

  const done = phase === 'savedToDevice' || phase === 'savedToAccount'

  const title = done
    ? phase === 'savedToAccount'
      ? '계정에 저장했어요'
      : '이 기기에 저장했어요'
    : phase === 'failed'
      ? '저장하지 못했어요'
      : member
        ? '코스를 저장할까요?'
        : null

  const description = done
    ? phase === 'savedToAccount'
      ? '어느 기기에서 로그인해도 이 코스를 다시 열어볼 수 있어요.'
      : member
        ? '다음에 들어오면 첫 화면에서 이어서 볼 수 있어요.'
        : '다음에 들어오면 첫 화면에서 이어서 볼 수 있어요. 계정을 만들면 다른 기기에서도 열리고요.'
    : phase === 'failed'
      ? (failure ??
        '브라우저가 저장을 막고 있어요. 시크릿 모드이거나 저장 공간이 가득 찼을 수 있습니다.')
      : member
        ? '이름을 붙여 계정에 담아두면 나중에 다른 코스와 나란히 볼 수 있어요.'
        : '계정이 있으면 다른 기기에서도 이어서 볼 수 있고, 여행 날짜가 가까워지면 혼잡도 변화를 알려드려요.'

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
        aria-labelledby="guest-save-title"
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
              ↓
            </span>
            <h2
              id="guest-save-title"
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

          {/* 저장을 마치면 이름을 고칠 자리가 아니다. 목록에서 바꾸는 것이 맞다. */}
          {!done && (
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

          {!done && phase !== 'failed' && (
            <div className="bg-moderate-tint flex items-start gap-2.75 rounded-[16px] px-3.75 py-3.5">
              <span
                className="bg-moderate-soft text-moderate-deep mt-px grid h-4.5 w-4.5 flex-none place-items-center rounded-full text-[11px] font-bold"
                aria-hidden="true"
              >
                !
              </span>
              <div className="flex flex-col gap-0.75">
                <span className="text-moderate-deep text-[13.5px] font-semibold">
                  {member ? '계정에 저장하면 어디서든 열려요' : '이 기기에만 저장하면'}
                </span>
                <span className="text-moderate-deep/85 text-[12.5px] leading-[1.6]">
                  브라우저 데이터를 지우면 기기에 저장한 코스는 사라져요.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.25">
            {done ? (
              <>
                {/* 회원에게는 권할 계정이 이미 있다. 가입하라고 다시 말하지 않는다. */}
                {!member && (
                  <Link
                    to="/signup"
                    className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                  >
                    계정에도 저장하기
                  </Link>
                )}
                <button type="button" className={OUTLINE_BUTTON} onClick={onClose}>
                  닫기
                </button>
              </>
            ) : member ? (
              <>
                {/* 이미 로그인한 사람에게 로그인 버튼을 다시 보여주지 않는다. */}
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={handleSaveToAccount}
                  disabled={!nameIsValid || saving}
                >
                  {saving ? '저장 중…' : '계정에 저장'}
                </button>
                <button
                  type="button"
                  className={OUTLINE_BUTTON}
                  onClick={handleSaveToDevice}
                  disabled={!nameIsValid || saving}
                >
                  이 기기에만 저장
                </button>
                <button type="button" className={GHOST_BUTTON} onClick={onClose}>
                  나중에 할게요
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  로그인하고 저장하기
                </Link>
                <button
                  type="button"
                  className={OUTLINE_BUTTON}
                  onClick={handleSaveToDevice}
                  disabled={!nameIsValid}
                >
                  이 기기에만 저장
                </button>
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
