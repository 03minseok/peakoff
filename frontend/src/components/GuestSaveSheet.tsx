import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PRIMARY_BUTTON } from './styles'

interface Props {
  onClose: () => void
  /** 실제 저장은 부모가 한다. @returns 저장에 성공했는지 */
  onSaveToDevice: () => boolean
}

type Phase = 'asking' | 'saved' | 'failed'

/**
 * 코스를 저장하려 할 때 아래에서 올라오는 시트.
 *
 * 화면을 옮기지 않고 그 자리에서 묻는다. 저장은 결과를 확인하다가 곁들이는 행동이지
 * 새 화면으로 넘어갈 만큼 큰 일이 아니다. 뒤에 최종 비교 결과가 비쳐 보이는 것도
 * "지금 이 코스를 저장하는 중"이라는 맥락을 유지해준다.
 *
 * 선택지를 셋으로 나눈 것이 핵심이다. 로그인만 걸어두면 계정을 만들기 싫은 사람은
 * 저장을 아예 못 한다. 그래서 "이 기기에만 저장"이 가운데 있다 — 로그인은 권하되 막지는 않는다.
 */
export function GuestSaveSheet({ onClose, onSaveToDevice }: Props) {
  const [phase, setPhase] = useState<Phase>('asking')

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

  function handleSaveToDevice() {
    setPhase(onSaveToDevice() ? 'saved' : 'failed')
  }

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
              {phase === 'saved' ? (
                '이 기기에 저장했어요'
              ) : phase === 'failed' ? (
                '저장하지 못했어요'
              ) : (
                <>
                  코스를 저장하려면
                  <br />
                  로그인하세요
                </>
              )}
            </h2>
            <p className="m-0 text-sm leading-[1.65] text-pretty">
              {phase === 'saved'
                ? '다음에 들어오면 첫 화면에서 이어서 볼 수 있어요. 계정을 만들면 다른 기기에서도 열리고요.'
                : phase === 'failed'
                  ? '브라우저가 저장을 막고 있어요. 시크릿 모드이거나 저장 공간이 가득 찼을 수 있습니다.'
                  : '계정이 있으면 다른 기기에서도 이어서 볼 수 있고, 여행 날짜가 가까워지면 혼잡도 변화를 알려드려요.'}
            </p>
          </div>

          {phase !== 'failed' && (
            <div className="bg-moderate-tint flex items-start gap-2.75 rounded-[16px] px-3.75 py-3.5">
              <span
                className="bg-moderate-soft text-moderate-deep mt-px grid h-4.5 w-4.5 flex-none place-items-center rounded-full text-[11px] font-bold"
                aria-hidden="true"
              >
                !
              </span>
              <div className="flex flex-col gap-0.75">
                <span className="text-moderate-deep text-[13.5px] font-semibold">
                  {phase === 'saved' ? '이 기기에만 저장됐어요' : '지금은 이 기기에만 저장됩니다'}
                </span>
                <span className="text-moderate-deep/85 text-[12.5px] leading-[1.6]">
                  브라우저 데이터를 지우면 코스가 사라져요.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.25">
            {phase === 'saved' ? (
              <>
                <Link
                  to="/signup"
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  계정에도 저장하기
                </Link>
                <button
                  type="button"
                  className="border-line bg-surface text-fg hover:bg-bg rounded-ui h-13 cursor-pointer border text-[15.5px] font-semibold transition-colors"
                  onClick={onClose}
                >
                  닫기
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
                  className="border-line bg-surface text-fg hover:bg-bg rounded-ui h-13 cursor-pointer border text-[15.5px] font-semibold transition-colors"
                  onClick={handleSaveToDevice}
                >
                  {phase === 'failed' ? '다시 시도' : '이 기기에만 저장'}
                </button>
                <button
                  type="button"
                  className="text-hint hover:text-muted rounded-ui h-11 cursor-pointer bg-transparent text-[13.5px] font-medium transition-colors"
                  onClick={onClose}
                >
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
