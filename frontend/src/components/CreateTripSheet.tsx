import { useEffect, useRef, useState } from 'react'
import { Close } from './icons'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props {
  /** 만들기. 실패하면 예외를 던진다 — 문구는 서버가 준 것을 그대로 쓴다 */
  onCreate: (name: string) => Promise<void>
  onClose: () => void
}

/** 서버 Trip.NAME_MAX_LENGTH와 같은 값이어야 한다 */
const NAME_MAX_LENGTH = 30

/**
 * 여행 이름을 묻는 시트.
 *
 * <h3>왜 인라인이 아니라 시트인가</h3>
 * 처음에는 제목 줄 아래에 입력칸이 펼쳐지게 했다. 그런데 그 자리는 <b>여행 목록이 서는
 * 자리</b>라, 칸이 열릴 때마다 아래 카드들이 통째로 밀려 내려갔다 — 무엇을 만들려는지
 * 보려고 열었는데 보고 있던 것이 움직인다.
 *
 * <p>시트는 그 위에 뜬다. 아래는 그대로 있고, 닫으면 원래 보던 자리로 돌아온다.
 * 이 서비스에서 <b>"아래에서 올라오는 면"은 곧 "지금 답해야 하는 것"</b>이라는 뜻이고
 * ({@code ConfirmSheet}·{@code SaveCourseSheet}와 같은 모양), 이름을 정하는 일이
 * 정확히 그것이다.
 *
 * <h3>닫는 길을 셋 둔다</h3>
 * X 버튼 · 뒤 어두운 면 누르기 · Esc. 하나만 두면 그 하나를 못 찾은 사람이 갇힌다 —
 * 특히 X는 <b>눈에 보이는</b> 길이라, 제스처나 키를 모르는 사람에게 유일한 답이다.
 */
export function CreateTripSheet({ onCreate, onClose }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 뒤 화면 잠금. ⚠️ body가 아니라 html에 건다 — 이유는 useScrollLock 주석에
  useScrollLock()

  useEffect(() => {
    /*
     * 열자마자 초점을 준다. 여기까지 왔다는 것은 이름을 지을 마음이 이미 섰다는 뜻이라
     * 칸을 한 번 더 누르게 할 이유가 없다.
     */
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      // 만드는 중에는 닫지 않는다. 요청은 나갔는데 화면만 사라지면 결과를 알 수 없다.
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, busy])

  const trimmed = name.trim()

  async function handleSubmit() {
    if (!trimmed || busy) {
      return
    }
    setFailure(null)
    setBusy(true)
    try {
      await onCreate(trimmed)
      onClose()
    } catch (error: unknown) {
      // 서버가 이유를 준다(여행 개수 초과 등). 그대로 보여주는 편이 친절하다.
      setFailure(error instanceof Error ? error.message : '여행을 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={busy ? undefined : onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative w-full rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-w-[400px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-trip-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="mx-auto flex w-full max-w-form flex-col gap-4.5 px-5.5 pt-5 pb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <h2
                id="create-trip-title"
                className="text-fg m-0 text-[19px] leading-[1.35] font-bold tracking-[-0.02em]"
              >
                어떤 여행인가요?
              </h2>
              {/*
                이 시트가 여는 것이 무엇인지 한 줄로 말한다. "여행"이라는 낱말만으로는
                코스와 무엇이 다른지 모른다 — 지역이 달라도 묶인다는 것이 이 기능의 전부다.
              */}
              <p className="text-hint m-0 text-[13px] leading-relaxed">
                이름만 정하면 돼요. 코스는 만들고 나서 담을 수 있어요.
              </p>
            </div>

            {/* 눈에 보이는 닫는 길. 제스처나 Esc를 모르는 사람에게는 이것이 유일한 답이다 */}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="닫기"
              className="text-hint hover:text-fg -mt-1 -mr-1 flex-none cursor-pointer rounded-full border-0 bg-transparent p-2 transition-colors disabled:cursor-not-allowed"
            >
              <Close size={18} />
            </button>
          </div>

          <form
            className="flex flex-col gap-2.25"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit()
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 가을 제주 한 바퀴"
              maxLength={NAME_MAX_LENGTH}
              className="border-line bg-surface text-fg h-13 w-full rounded-ui border px-3.5 font-sans text-base"
            />

            {failure && (
              <p className="text-crowded-deep m-0 text-[13px] leading-relaxed whitespace-pre-line">
                {failure}
              </p>
            )}

            <button
              type="submit"
              disabled={!trimmed || busy}
              className="press bg-brand hover:bg-brand-hover text-fg disabled:bg-line disabled:text-hint rounded-ui h-13 cursor-pointer border-0 text-[15.5px] font-semibold disabled:cursor-not-allowed"
            >
              {busy ? '만드는 중…' : '만들기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
