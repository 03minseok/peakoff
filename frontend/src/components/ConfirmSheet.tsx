import { useEffect } from 'react'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** 되돌릴 수 없는 행동. 확인 버튼이 경고색이 된다 */
  danger?: boolean
  /** 처리 중. 버튼이 잠기고 문구가 바뀐다 */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 되돌릴 수 없는 행동을 묻는 시트.
 *
 * <p><b>{@code window.confirm}을 쓰지 않는 이유</b>: 브라우저 기본 대화상자는 디자인 시스템
 * 바깥에 있다. 글꼴·색·모서리 어느 것도 우리가 정할 수 없고, 브라우저마다 모양이 다르며,
 * 버튼 문구가 "확인/취소"로 고정돼 무엇이 일어나는지 말해주지 못한다.
 *
 * <p>모양은 {@code SaveCourseSheet}·{@code CourseDetailOverlay}와 맞춘다 — 이 서비스에서
 * "아래에서 올라오는 면"은 곧 "지금 답해야 하는 것"이라는 뜻이 되게 한다.
 */
export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  // 뒤 화면 잠금. ⚠️ body가 아니라 html에 건다 — 이유는 useScrollLock 주석에
  useScrollLock()
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      // 처리 중에는 닫지 않는다. 요청은 이미 나갔는데 화면만 사라지면 결과를 알 수 없다.
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKey)


    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [onCancel, busy])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative w-full rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-w-[400px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="mx-auto flex w-full max-w-form flex-col gap-4.5 px-5.5 pt-5 pb-6">
          <div className="flex flex-col gap-2">
            <h2
              id="confirm-sheet-title"
              className="text-fg m-0 text-[19px] leading-[1.35] font-bold tracking-[-0.02em] text-pretty"
            >
              {title}
            </h2>
            {description && (
              <p className="m-0 text-sm leading-[1.65] whitespace-pre-line text-pretty">{description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2.25">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`press rounded-ui h-13 cursor-pointer text-[15.5px] font-semibold disabled:cursor-not-allowed disabled:bg-line disabled:text-hint ${
                danger
                  ? 'bg-crowded-strong hover:bg-crowded-deep text-white'
                  : 'bg-brand hover:bg-brand-hover text-fg'
              }`}
            >
              {busy ? '처리 중…' : confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="press border-line bg-surface text-fg hover:bg-bg rounded-ui h-13 cursor-pointer border text-[15.5px] font-semibold disabled:cursor-not-allowed disabled:text-hint"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
