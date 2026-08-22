import { useEffect } from 'react'
import type { FormEvent, ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  /** 입력칸들. 보통 AuthField 몇 개 */
  children: ReactNode
  submitLabel: string
  cancelLabel?: string
  /** 되돌릴 수 없는 행동. 제출 버튼이 경고색이 된다 */
  danger?: boolean
  /** 보낼 수 있는 상태인가. false면 제출 버튼이 잠긴다 */
  canSubmit?: boolean
  /** 처리 중. 버튼이 잠기고 문구가 바뀐다 */
  busy?: boolean
  /** 서버가 거절한 이유처럼 칸 하나에 붙일 수 없는 오류 */
  failure?: string | null
  onSubmit: () => void
  onCancel: () => void
}

/**
 * 값을 입력받아 확정하는 시트.
 *
 * <p>{@code ConfirmSheet}는 "예/아니오"를 묻고, 이쪽은 <b>무언가를 적어 넣어야</b> 답이 되는
 * 경우를 맡는다. 둘을 하나로 합치면 children이 있을 때와 없을 때 동작이 갈리는 컴포넌트가 되고,
 * 반대로 화면마다 시트를 따로 만들면 바깥 클릭·Escape·배경 잠금 같은 것을 매번 다시 적게 된다
 * (그러다 한 곳만 빠뜨린 적이 있다).
 *
 * <p><b>{@code <form>}인 것이 중요하다.</b> 입력칸에서 Enter를 치면 제출된다.
 * div로 두면 마우스로 버튼을 눌러야만 진행되어, 키보드만 쓰는 사람에게는 막다른 길이 된다.
 */
export function FormSheet({
  title,
  description,
  children,
  submitLabel,
  cancelLabel = '취소',
  danger = false,
  canSubmit = true,
  busy = false,
  failure,
  onSubmit,
  onCancel,
}: Props) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      // 처리 중에는 닫지 않는다. 요청은 이미 나갔는데 화면만 사라지면 결과를 알 수 없다.
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel, busy])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit && !busy) {
      onSubmit()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      {/*
        overflow-hidden이 있어야 안쪽 내용이 둥근 모서리를 넘어 사각으로 삐져나오지 않는다.
        max-h와 함께 두어 입력칸이 많아지거나 화면이 낮을 때 시트 안에서 스크롤되게 한다.
      */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="sheet-panel dialog-panel bg-bg relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-w-[420px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-sheet-title"
      >
        <div className="flex flex-none justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="max-w-form mx-auto flex w-full flex-col gap-4.5 overflow-y-auto px-5.5 pt-5 pb-6">
          <div className="flex flex-col gap-2">
            <h2
              id="form-sheet-title"
              className="text-fg m-0 text-[19px] leading-[1.35] font-bold tracking-[-0.02em] text-pretty"
            >
              {title}
            </h2>
            {description && (
              <p className="m-0 text-sm leading-[1.65] text-pretty">{description}</p>
            )}
          </div>

          <div className="flex flex-col gap-3.5">{children}</div>

          {failure && (
            <div
              className="bg-crowded-tint rounded-ui text-crowded-deep px-3.5 py-3 text-xs leading-[1.65]"
              role="alert"
            >
              {failure}
            </div>
          )}

          <div className="flex flex-col gap-2.25">
            <button
              type="submit"
              disabled={!canSubmit || busy}
              className={`rounded-ui disabled:bg-line disabled:text-hint h-13 cursor-pointer text-[15.5px] font-semibold transition-colors disabled:cursor-not-allowed ${
                danger
                  ? 'bg-crowded-strong hover:bg-crowded-deep text-white'
                  : 'bg-brand hover:bg-brand-hover text-fg'
              }`}
            >
              {busy ? '처리 중…' : submitLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="border-line bg-surface text-fg hover:bg-bg rounded-ui disabled:text-hint h-13 cursor-pointer border text-[15.5px] font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
