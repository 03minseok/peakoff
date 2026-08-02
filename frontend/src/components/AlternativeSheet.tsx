import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, fetchAlternatives } from '../services/api'
import type { Alternative } from '../types/api'
import { CongestionBadge } from './CongestionBadge'
import { LEVEL_SOLID } from './levelStyles'

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
 * 대안 후보를 보여주는 패널.
 *
 * 모바일에서는 아래에서 올라오는 시트, 1024px부터는 화면 가운데 모달이다.
 * 좁은 화면에서는 엄지가 닿는 아래쪽에서 올라오는 편이 자연스럽고,
 * 넓은 화면에서는 아래에 붙은 시트가 화면 한쪽에만 몰려 어색해진다.
 * 마크업은 하나로 두고 정렬·모서리·그림자만 클래스로 갈랐다.
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
      className="fixed inset-0 z-100 flex items-end justify-center bg-[rgb(22_33_31/0.42)] lg:items-center lg:p-6"
      onClick={onClose}
    >
      {/*
        내용 영역 클릭이 배경까지 올라가면 시트가 닫힌다.
        키보드 사용자는 Escape로 닫으므로 이 div에는 역할을 주지 않는다.

        화면을 다 덮지 않는다 — 뒤에 있는 코스가 조금 보여야 맥락을 잃지 않는다.
      */}
      <div
        ref={panelRef}
        className="bg-bg flex max-h-[84svh] w-full max-w-[560px] flex-col rounded-t-[24px] shadow-[0_-10px_40px_rgb(22_33_31/0.24)] focus-visible:outline-none lg:max-h-[76svh] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(22_33_31/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 아래에서 올라온 시트임을 알리는 손잡이 표시.
            모달일 때는 끌어올릴 것이 없으므로 감춘다. */}
        <div className="flex flex-none justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-full" aria-hidden="true" />
        </div>

        <header className="border-line bg-surface flex flex-none flex-col gap-2 border-b px-4.5 pt-3.5 pb-3.5 lg:rounded-t-[24px] lg:px-6 lg:pt-5.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-hint text-[12.5px]">교체할 자리</span>
              <h2
                id="sheet-title"
                className="text-fg m-0 text-[19px] font-bold tracking-[-0.015em]"
              >
                {originName} 대신 어디요?
              </h2>
            </div>
            <button
              type="button"
              className="text-muted hover:bg-line/60 rounded-chip grid h-8.5 w-8.5 flex-none cursor-pointer place-items-center bg-transparent text-base transition-colors"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <p className="m-0 text-[13px] leading-[1.6] text-pretty">
            같은 날 방문할 곳 중에서, 동선과 테마가 비슷하면서 더 한적한 곳을 골랐어요.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-5">
          {load.phase === 'loading' && (
            <p className="py-6 text-center text-sm">후보를 찾는 중…</p>
          )}
          {load.phase === 'error' && (
            <p className="text-crowded-deep py-6 text-center text-sm">{load.message}</p>
          )}

          {load.phase === 'loaded' && load.alternatives.length === 0 && (
            <p className="py-6 text-center text-sm">추천할 만한 다른 곳을 찾지 못했어요.</p>
          )}

          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {load.alternatives.map((alternative, index) => (
                <li
                  key={alternative.place.id}
                  className="bg-surface shadow-rest flex flex-col gap-3 rounded-[18px] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-fg text-base font-semibold tracking-[-0.01em]">
                          {alternative.place.name}
                        </span>
                        {/* 서버가 점수순으로 내려준다. 맨 위 하나만 표시해 시선을 모은다. */}
                        {index === 0 && (
                          <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            추천
                          </span>
                        )}
                      </div>
                      <span className="text-hint text-[12.5px]">
                        {alternative.place.categoryName}
                      </span>
                    </div>
                    <CongestionBadge
                      level={alternative.level}
                      label={alternative.levelLabel}
                      size="sm"
                    />
                  </div>

                  {/*
                    두 점수를 막대로 나란히 둔다. 한적도는 등급 색, 추천도는 잉크색이다.
                    같은 색으로 두면 "어느 쪽이 이 서비스의 핵심 지표인지"가 흐려진다.
                  */}
                  <div className="flex gap-4">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex justify-between">
                        <span className="text-hint text-[11.5px]">한적도</span>
                        <span className="text-fg font-mono text-[11.5px] font-semibold">
                          {alternative.quietness}
                        </span>
                      </div>
                      <div className="bg-line h-1.5 overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${LEVEL_SOLID[alternative.level]}`}
                          style={{ width: `${alternative.quietness}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex justify-between">
                        <span className="text-hint text-[11.5px]">추천도</span>
                        <span className="text-fg font-mono text-[11.5px] font-semibold">
                          {alternative.recommendation}
                        </span>
                      </div>
                      <div className="bg-line h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-fg h-full rounded-full"
                          style={{ width: `${alternative.recommendation}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 추천 근거. 이름 다음으로 눈에 들어와야 한다 — 데이터를 어떻게 썼는지 보여주는 자리다. */}
                  <div className="bg-bg rounded-ui flex items-start gap-2.5 px-3 py-2.75">
                    <span
                      className="bg-quiet-soft/50 text-brand-deep mt-px grid h-4 w-4 flex-none place-items-center rounded-full text-[10px] font-bold"
                      aria-hidden="true"
                    >
                      i
                    </span>
                    <p className="m-0 text-[12.5px] leading-[1.6] text-pretty">
                      {alternative.reason}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="bg-brand hover:bg-brand-hover rounded-ui h-11 cursor-pointer text-[14.5px] font-semibold text-white transition-colors"
                    onClick={() => onSelect(alternative.place.id)}
                  >
                    이 장소로 교체
                  </button>
                </li>
              ))}
            </ul>
          )}

          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <button
              type="button"
              className="text-hint mt-2.5 h-11 w-full cursor-pointer bg-transparent text-[13.5px] font-medium"
              onClick={onClose}
            >
              그대로 둘게요
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
