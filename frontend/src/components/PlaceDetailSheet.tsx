import { useEffect, useState } from 'react'
import { Close } from './icons'
import { CongestionBadge } from './CongestionBadge'
import { fetchPlaceDescription } from '../services/api'
import type { CongestionLevel } from '../types/api'

/**
 * 장소 하나를 자세히 보는 창.
 *
 * <h3>왜 카드 안에서 펼치지 않는가</h3>
 * 처음에는 카드 아래로 밀어 내리는 방식이었다. 소개글이 500자쯤 되다 보니
 * <b>펼치는 순간 그 아래 일정이 통째로 화면 밖으로 밀려났고</b>, 코스가 길수록 심했다.
 * 읽고 나서 원래 보던 자리로 돌아오려면 스크롤을 되짚어야 했다.
 *
 * <p>창으로 띄우면 <b>뒤 화면이 그대로 남는다.</b> 닫으면 보던 자리다.
 * 사진도 카드 안에서는 못 키우지만 여기서는 크게 둘 수 있다 — 그 장소를 고를지 말지를
 * 정하는 데 우리가 가진 것 중 사진이 가장 큰 몫이다.
 *
 * <h3>열 때 한 번만 부른다</h3>
 * 소개글은 지역 카탈로그(목록 API)에 없고 상세 조회에만 있어 장소마다 공사를 한 번씩
 * 부른다. 일일 한도가 API당 1,000회라 <b>사용자가 연 것만</b> 부르면 넉넉하다 —
 * 목록에 미리 붙였다면 화면을 그릴 때마다 담긴 곳 수만큼 나갔을 것이고,
 * 그 모양이 2026-08-26 한도 소진 사고였다.
 *
 * <p>서버가 6시간 캐시로 받쳐 두므로 같은 장소를 다시 열면 공사까지 가지 않는다.
 */
interface Props {
  placeId: string
  placeName: string
  categoryName: string
  imageUrl: string | null
  /** 그 날의 한적도. 예측이 닿지 않는 장소는 null이라 배지를 그리지 않는다 */
  quietness?: number | null
  level?: CongestionLevel | null
  levelLabel?: string | null
  onClose: () => void
}

type State =
  | { phase: 'loading' }
  | { phase: 'loaded'; address: string | null; overview: string | null }
  | { phase: 'error' }

/**
 * 공사가 준 소개글을 화면에 쓸 글자로 옮긴다.
 *
 * <p>{@code <br>}만 줄바꿈으로 살리고 나머지 태그는 지운다. ⚠️ <b>innerHTML로 넣지 않는다</b> —
 * 우리가 만든 문자열이 아니다. 태그를 그냥 두면 글 안에 "&lt;br&gt;"이 보이고,
 * innerHTML로 넣으면 남이 준 문자열을 그대로 실행하는 셈이다.
 *
 * <p>연달아 나오는 빈 줄은 하나로 줄인다 — 원문에 {@code <br><br><br>}이 흔하다.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function PlaceDetailSheet({
  placeId,
  placeName,
  categoryName,
  imageUrl,
  quietness,
  level,
  levelLabel,
  onClose,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaceDescription(placeId, controller.signal)
      .then((description) => setState({ phase: 'loaded', ...description }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [placeId])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    // 창이 떠 있는 동안 뒤 화면이 함께 움직이면 닫았을 때 보던 자리를 잃는다.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-surface relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-h-[84svh] lg:max-w-[480px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
      >
        {/*
          닫기 버튼이 사진 위에 얹힌다. 사진이 맨 위를 가로지르므로 헤더 줄을 따로 두면
          사진이 그만큼 내려가고, 이 창에서 가장 큰 몫인 사진이 작아진다.
          흐린 검정 바탕에 흰 글자 — 사진이 밝든 어둡든 읽혀야 한다.
        */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="press absolute top-3 right-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[rgb(42_62_84/0.55)] text-base text-white"
        >
          <Close />
        </button>

        {/*
          ⚠️ 스크롤 막대를 감춘다({@code no-scrollbar}).

          이 창은 사진이 맨 위를 가로지르고 둥근 모서리로 잘려 있는데, 그 위에 세로 막대가
          서면 <b>사진 오른쪽이 한 줄 깎인 것처럼</b> 보인다. 윈도우처럼 막대가 자리를
          차지하는 환경에서 특히 그렇다.

          <b>스크롤은 그대로 된다</b> — 막대만 안 보인다. 여기서는 감춰도 되는 이유가
          있다: 창 안에 든 것이 사진과 글 한 덩이라 "아래에 더 있다"가 글 흐름으로
          이미 보이고, 손가락·휠·키보드 어느 쪽으로도 내려간다.

          ⚠️ 목록에는 쓰지 말 것. 거기서는 막대가 "얼마나 남았는가"를 말해 준다.
        */}
        <div className="no-scrollbar overscroll-contain flex-1 overflow-y-auto">
          {/* 사진. 이 창의 주인공이라 폭을 꽉 채운다 */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={placeName}
              className="h-60 w-full flex-none object-cover"
            />
          ) : (
            /* 사진이 없는 관광지가 많다. 빈 칸으로 두면 안 불러온 것처럼 보여 이름을 크게 둔다 */
            <div className="bg-bg text-muted grid h-40 w-full place-items-center text-[28px] font-bold">
              {placeName.slice(0, 2)}
            </div>
          )}

          <div className="flex flex-col gap-3.5 px-5 pt-4 pb-6">
            {/*
              ⚠️ 출처를 <b>중립적으로</b> 적는다. 공사 이름이나 로고를 서비스 안에 쓰지 않는 것이
              공모전 규칙이라(CLAUDE.md 절대 규칙 4), 기관명 대신 "공공데이터"로만 밝힌다.
            */}
            <span className="text-hint text-[11px]">공공데이터 기반 이미지</span>

            <div className="flex flex-col gap-1.5">
              <h2
                id="place-detail-title"
                className="text-fg m-0 text-[20px] leading-[1.35] font-bold tracking-[-0.015em] text-pretty"
              >
                {placeName}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-hint text-[12.5px]">{categoryName}</span>
                {/*
                  한적도는 있을 때만. 예측이 닿지 않는 장소(음식점·숙박·상점)에는 없는데,
                  없는 값에 아무 등급이나 얹으면 그 자체가 거짓말이 된다.
                */}
                {level != null && levelLabel != null && (
                  <CongestionBadge
                    level={level}
                    label={levelLabel}
                    quietness={quietness ?? undefined}
                    size="sm"
                  />
                )}
              </div>
            </div>

            {state.phase === 'loading' && (
              <p className="text-hint m-0 text-[13px]">소개를 불러오는 중…</p>
            )}

            {state.phase === 'error' && (
              <p className="text-hint m-0 text-[13px]">소개를 불러오지 못했어요.</p>
            )}

            {state.phase === 'loaded' && (
              <>
                {/*
                  whitespace-pre-line으로 원문의 문단 나눔을 살린다.
                  뭉개면 500자가 한 덩어리가 되어 읽히지 않는다.
                */}
                {state.overview ? (
                  <p className="text-fg m-0 text-[13.5px] leading-[1.75] whitespace-pre-line text-pretty">
                    {toPlainText(state.overview)}
                  </p>
                ) : (
                  /* 없다는 것도 답이다. 아무 말이 없으면 덜 불러온 줄 알고 다시 연다 */
                  <p className="text-hint m-0 text-[13px]">아직 소개글이 없는 곳이에요.</p>
                )}

                {state.address && (
                  <p className="border-line text-muted m-0 border-t pt-3 text-[12.5px]">
                    {state.address}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
