import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, fetchAlternatives } from '../services/api'
import type { Alternative } from '../types/api'
import { CongestionBadge } from './CongestionBadge'

interface Props {
  /** 교체 대상 장소 */
  originName: string
  originPlaceId: string
  /** 그 자리를 방문하는 날짜. 같은 후보라도 날짜에 따라 한적도가 다르다 */
  visitDate: string
  /** 이미 그 날에 담겨 있는 장소들. 후보에서 빼야 같은 곳이 두 번 들어가지 않는다 */
  excludePlaceIds: string[]
  onClose: () => void
  onSelect: (placeId: string) => void
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; alternatives: Alternative[] }
  | { phase: 'error'; message: string }

/**
 * 대안 후보를 보여주는 하단 시트.
 *
 * 후보마다 <b>추천 근거를 반드시 함께</b> 보여준다. 점수만 나열하면 사용자는
 * 왜 이곳이 추천됐는지 알 수 없고, 서비스가 데이터를 어떻게 썼는지도 드러나지 않는다.
 */
export function AlternativeSheet({
  originName,
  originPlaceId,
  visitDate,
  excludePlaceIds,
  onClose,
  onSelect,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchAlternatives(originPlaceId, visitDate, 8, controller.signal)
      .then((result) => {
        // 이미 그 날에 담긴 곳은 고를 수 없으므로 아예 보여주지 않는다.
        const selectable = result.filter((item) => !excludePlaceIds.includes(item.place.id))
        setLoad({ phase: 'loaded', alternatives: selectable })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoad({
          phase: 'error',
          message:
            error instanceof ApiRequestError ? error.message : '대안을 불러오지 못했습니다.',
        })
      })

    return () => controller.abort()
    // excludePlaceIds는 배열이라 매 렌더 새 참조가 될 수 있어 의존성에서 뺀다.
    // 시트는 열릴 때 한 번만 받으면 되고, 여는 동안 담긴 목록은 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPlaceId, visitDate])

  // 열리면 시트로 초점을 옮긴다. 키보드 사용자가 시트 밖에 남아 있으면 안 된다.
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-black/45"
      onClick={onClose}
    >
      {/*
        내용 영역 클릭이 배경까지 올라가면 시트가 닫힌다.
        키보드 사용자는 Escape로 닫으므로 이 div에는 역할을 주지 않는다.

        화면을 다 덮지 않는다 — 뒤에 있는 코스가 조금 보여야 맥락을 잃지 않는다.
      */}
      <div
        ref={panelRef}
        className="bg-bg rounded-card flex max-h-[78svh] w-full max-w-app flex-col rounded-b-none px-4 pt-2 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] focus-visible:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 아래에서 올라온 시트임을 알리는 손잡이 표시 */}
        <div className="bg-line mx-auto mb-3 h-1 w-9 rounded-full" aria-hidden="true" />

        <header className="mb-3 flex items-start justify-between gap-2">
          <h2 id="sheet-title" className="text-fg text-base font-normal">
            <strong className="font-bold">{originName}</strong> 대신 어떠세요?
          </h2>
          <button
            type="button"
            className="text-muted hover:text-fg h-8 w-8 shrink-0 cursor-pointer rounded-md"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {load.phase === 'loading' && (
          <p className="py-6 text-center text-sm">후보를 찾는 중…</p>
        )}
        {load.phase === 'error' && (
          <p className="text-danger py-6 text-center text-sm">{load.message}</p>
        )}

        {load.phase === 'loaded' && load.alternatives.length === 0 && (
          <p className="py-6 text-center text-sm">추천할 만한 다른 곳을 찾지 못했어요.</p>
        )}

        {load.phase === 'loaded' && load.alternatives.length > 0 && (
          <ul className="overflow-y-auto">
            {load.alternatives.map((alternative) => (
              <li key={alternative.place.id}>
                <button
                  type="button"
                  className="border-line hover:bg-surface flex w-full cursor-pointer flex-col gap-1 border-b px-2 py-3 text-left"
                  onClick={() => onSelect(alternative.place.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-fg text-[15px] font-semibold">
                      {alternative.place.name}
                    </span>
                    <CongestionBadge
                      level={alternative.level}
                      label={alternative.levelLabel}
                      quietness={alternative.quietness}
                      size="sm"
                    />
                  </span>
                  {/* 추천 근거. 이름 다음으로 눈에 들어와야 한다 — 데이터를 어떻게 썼는지 보여주는 자리다. */}
                  <span className="text-brand-strong text-[13px] leading-snug">
                    {alternative.reason}
                  </span>
                  <span className="text-muted text-xs">
                    {alternative.place.categoryName} · 추천도 {alternative.recommendation}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
