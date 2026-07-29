import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, fetchAlternatives } from '../services/api'
import type { Alternative } from '../types/api'
import { CongestionBadge } from './CongestionBadge'
import './AlternativeSheet.css'

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
    <div className="sheet-backdrop" onClick={onClose}>
      {/*
        내용 영역 클릭이 배경까지 올라가면 시트가 닫힌다.
        키보드 사용자는 Escape로 닫으므로 이 div에는 역할을 주지 않는다.
      */}
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />

        <header className="sheet-head">
          <h2 id="sheet-title" className="sheet-title">
            <strong>{originName}</strong> 대신 어떠세요?
          </h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {load.phase === 'loading' && <p className="sheet-status">후보를 찾는 중…</p>}
        {load.phase === 'error' && (
          <p className="sheet-status sheet-status--error">{load.message}</p>
        )}

        {load.phase === 'loaded' && load.alternatives.length === 0 && (
          <p className="sheet-status">추천할 만한 다른 곳을 찾지 못했어요.</p>
        )}

        {load.phase === 'loaded' && load.alternatives.length > 0 && (
          <ul className="alt-list">
            {load.alternatives.map((alternative) => (
              <li key={alternative.place.id}>
                <button
                  type="button"
                  className="alt"
                  onClick={() => onSelect(alternative.place.id)}
                >
                  <span className="alt-head">
                    <span className="alt-name">{alternative.place.name}</span>
                    <CongestionBadge
                      level={alternative.level}
                      label={alternative.levelLabel}
                      quietness={alternative.quietness}
                      size="sm"
                    />
                  </span>
                  <span className="alt-reason">{alternative.reason}</span>
                  <span className="alt-meta">
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
