import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, fetchAlternatives, fetchNearby } from '../services/api'
import { alternativesFor, forgetAlternatives } from '../services/alternativeCache'
import type { Alternative, CongestionLevel, NearbyPlace } from '../types/api'
import { CongestionBadge } from './CongestionBadge'

interface Props {
  /** 교체 대상 장소 */
  originName: string
  originPlaceId: string
  /**
   * 지금 이 자리의 한적도와 등급. <b>둘 다 null이면 시트가 다른 모드로 열린다.</b>
   *
   * 후보를 절대 점수로만 보여주면 "이게 지금보다 나은가"를 사용자가 암산해야 한다.
   * 특히 원래 자리가 이미 한적한 경우, 후보 중에 더 붐비는 곳이 섞여 있을 수 있다.
   *
   * <b>null인 경우</b>: 음식점·숙박처럼 공사가 예측하지 않는 장소다. 한적도를 모르면
   * 추천도를 매길 수 없으므로(추천도는 한적도를 가장 크게 품는 값이다) 추천 대신
   * <b>가까운 같은 분류 장소</b>를 거리만 붙여 보여준다.
   */
  originQuietness: number | null
  originLevel: CongestionLevel | null
  /** 그 자리를 방문하는 날짜. 같은 후보라도 날짜에 따라 한적도가 다르다 */
  visitDate: string
  /** 이미 그 날에 담겨 있는 장소들. 후보에서 빼야 같은 곳이 두 번 들어가지 않는다 */
  excludePlaceIds: string[]
  /**
   * 여행 조건(지역·시작일·기간) 열쇠.
   *
   * 서버가 대안을 <b>가중 무작위</b>로 뽑기 때문에, 같은 자리를 다시 물으면 다른 답이 온다.
   * 시트를 닫았다 열 때마다 목록이 바뀌면 되돌아갈 후보를 찾지 못하므로 화면이 결과를
   * 들고 있는다. 이 값이 바뀌면(날짜를 옮기는 등) 들고 있던 것을 버린다.
   */
  planKey: string
  onClose: () => void
  onSelect: (placeId: string) => void
}

/**
 * 불러온 결과.
 *
 * 대안과 근처 장소를 <b>한 배열로 합치지 않는다.</b> 대안에는 점수와 근거가 있고
 * 근처 장소에는 거리뿐이라, 합치면 어느 쪽이든 절반이 빈 항목이 된다.
 * 화면은 그 빈 자리를 "아직 안 온 값"으로 읽는다.
 */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; alternatives: Alternative[]; emptyMessage: string | null }
  | { phase: 'nearby'; nearby: NearbyPlace[] }
  | { phase: 'error'; message: string }

/**
 * 거리 표기.
 *
 * 1km 미만은 미터로 적는다 — "0.4km"보다 "420m"가 걸어갈 만한 거리인지 판단하기 쉽다.
 * 10m 단위로 끊는 것은 직선거리라 그보다 정밀하게 말할 근거가 없어서다.
 */
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round((km * 1000) / 10) * 10}m`
  }
  return `${km.toFixed(1)}km`
}

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
  originQuietness,
  originLevel,
  visitDate,
  excludePlaceIds,
  planKey,
  onClose,
  onSelect,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const panelRef = useRef<HTMLDivElement>(null)

  /**
   * 점수를 매길 수 없는 자리인가.
   *
   * 진단 화면이 한적도를 넘겨주지 못했다는 뜻이고, 그런 장소는 음식점·숙박처럼
   * 공사 예측 대상이 아니다. 추천 대신 <b>가까운 같은 분류 장소</b>를 보여준다.
   */
  const nearbyMode = originQuietness === null || originLevel === null

  /**
   * 다시 뽑아 달라고 요청한 횟수.
   *
   * 이 값이 바뀔 때만 새로 뽑는다. 화면이 다시 그려지는 것과 사용자가 새 추천을 원하는 것은
   * 다른 일이라, 둘을 구분하지 않으면 목록이 제멋대로 바뀐다.
   */
  const [redrawCount, setRedrawCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    /*
     * 근처 장소는 <b>캐시하지 않는다.</b> 대안 캐시(alternativesFor)는 서버가 매번 다르게
     * 뽑는 것을 붙잡아 두려고 있는 장치인데, 여기에는 무작위가 없어 같은 요청이면 늘 같은 답이다.
     */
    const request = nearbyMode
      ? fetchNearby(originPlaceId, 8, controller.signal).then((result) => {
          const selectable = result.filter(
            (item) => !excludePlaceIds.includes(item.place.id),
          )
          setLoad({ phase: 'nearby', nearby: selectable })
        })
      : alternativesFor(planKey, originPlaceId, visitDate, () =>
          fetchAlternatives(
            originPlaceId,
            visitDate,
            8,
            excludePlaceIds,
            controller.signal,
          ),
        ).then((result) => {
          // 이미 그 날에 담긴 곳은 고를 수 없으므로 아예 보여주지 않는다.
          const selectable = result.alternatives.filter(
            (item) => !excludePlaceIds.includes(item.place.id),
          )
          /*
           * 목록이 왜 비었는지는 서버가 말한다. 원래 자리가 이미 한적해서 비는 것과
           * 대신할 곳을 못 찾아서 비는 것은 정반대의 소식이라, 한 문장으로 뭉개면
           * 잘 고른 사용자에게 서비스가 못했다고 사과하는 꼴이 된다.
           *
           * 다만 걸러낸 것이 우리 쪽 사정(이미 코스에 담긴 곳)일 때는 서버 문구가 맞지 않는다.
           * 서버는 후보를 줬는데 화면이 뺀 것이라, "못 찾았다"고 말하면 거짓말이 된다.
           */
          const emptyMessage =
            selectable.length > 0
              ? null
              : result.alternatives.length > 0
                ? '남은 후보가 이미 이 날 코스에 담겨 있어요.'
                : result.statusMessage
          setLoad({ phase: 'loaded', alternatives: selectable, emptyMessage })
        })

    request
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoad({
          phase: 'error',
          message:
            error instanceof ApiRequestError
              ? error.message
              : nearbyMode
                ? '가까운 장소를 불러오지 못했습니다.'
                : '대안을 불러오지 못했습니다.',
        })
      })

    return () => controller.abort()
    // excludePlaceIds는 배열이라 매 렌더 새 참조가 될 수 있어 의존성에서 뺀다.
    // 시트는 열릴 때 한 번만 받으면 되고, 여는 동안 담긴 목록은 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPlaceId, visitDate, planKey, redrawCount, nearbyMode])

  /** 사용자가 명시적으로 새 추천을 요청했을 때만 다시 뽑는다. */
  function handleRedraw() {
    forgetAlternatives(originPlaceId, visitDate)
    setLoad({ phase: 'loading' })
    setRedrawCount((count) => count + 1)
  }

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

    /*
     * 시트가 떠 있는 동안 뒤 페이지가 움직이지 않게 잠근다.
     *
     * 이 시트는 화면을 다 덮지 않아서(max-h-84svh) 아래로 뒤 화면이 비친다.
     * 잠그지 않으면 그 부분을 밀 때 배경이 시트 밑에서 따로 스크롤되어,
     * 시트가 화면에서 떨어져 나온 것처럼 보인다.
     *
     * 다른 시트들(SaveCourseSheet·ConfirmSheet·CourseDetailOverlay)과 같은 처리다.
     */
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="sheet-dim fixed inset-0 z-100 flex items-end justify-center bg-[rgb(42_62_84/0.42)] lg:items-center lg:p-6"
      onClick={onClose}
    >
      {/*
        내용 영역 클릭이 배경까지 올라가면 시트가 닫힌다.
        키보드 사용자는 Escape로 닫으므로 이 div에는 역할을 주지 않는다.

        화면을 다 덮지 않는다 — 뒤에 있는 코스가 조금 보여야 맥락을 잃지 않는다.

        overflow-hidden: 안쪽 내용을 둥근 모서리에 맞춰 자른다.
        없으면 헤더(bg-surface)의 각진 위 모서리가 패널의 둥근 윤곽 밖으로 삐져나온다.
        넓은 화면에서는 헤더에도 lg:rounded-t가 걸려 가려졌지만, 그 아래에서는
        손잡이 표시 바로 다음에 각진 흰 면이 시작돼 그대로 드러났다.
        모서리를 자식마다 맞추는 대신 부모가 한 번 자르게 한다 — 자식이 늘어도 따라온다.
      */}
      <div
        ref={panelRef}
        className="sheet-panel dialog-panel bg-bg flex max-h-[84svh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] focus-visible:outline-none lg:max-h-[76svh] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
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
                {nearbyMode ? `${originName} 대신 갈 만한 곳` : `${originName} 대신 어디요?`}
              </h2>
            </div>
            <button
              type="button"
              className="press touch-hitbox text-muted hover:bg-line/60 rounded-chip grid h-8.5 w-8.5 flex-none cursor-pointer place-items-center bg-transparent text-base"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          {/* 지금 점수를 함께 띄운다. 후보 옆의 증감이 무엇을 기준으로 한 것인지 알려면 필요하다. */}
          {originLevel !== null && originQuietness !== null && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-hint text-[12.5px]">지금</span>
              <CongestionBadge level={originLevel} quietness={originQuietness} size="sm" />
            </div>
          )}
          {/*
            무엇을 기준으로 줄 세웠는지 첫 줄에서 밝힌다.

            근처 모드에서는 <b>추천이라고 말하지 않는다.</b> 예상 혼잡을 모르는 곳이라
            "여기가 더 낫다"고 할 근거가 없다. 우리가 아는 것(분류·거리)만 말하고
            <b>고르는 판단은 사용자에게 남긴다</b> — 계산하지 않은 것을 근거로 말하지 않는다.
          */}
          <p className="m-0 text-[13px] leading-[1.6] text-pretty whitespace-pre-line">
            {nearbyMode
              ? '예상 혼잡을 알 수 없는 곳이라 추천 순서를 매기지 못해요.\n같은 분류에서 가까운 순으로 보여드릴게요.'
              : originLevel === 'CROWDED'
                ? '추천도가 높은 순이에요.\n추천도에는 한적도가 가장 크게 반영됩니다.'
                : '지금도 크게 붐비지는 않는 곳이에요.\n추천도가 높은 순으로 비교해 보세요.'}
          </p>
        </header>

        {/* overscroll-contain: 목록을 끝까지 내려도 스크롤이 뒤 페이지로 넘어가지 않는다 */}
        <div className="overscroll-contain flex-1 overflow-y-auto px-4 py-4 lg:px-5">
          {load.phase === 'loading' && (
            <p className="py-6 text-center text-sm">후보를 찾는 중…</p>
          )}
          {load.phase === 'error' && (
            <p className="text-crowded-deep py-6 text-center text-sm whitespace-pre-line">{load.message}</p>
          )}

          {/*
            빈 목록에도 이유가 붙는다. 서버가 원래 장소보다 뚜렷하게 한적한 곳만 담기 때문에
            비는 일이 흔한데, "이미 한적해서"와 "못 찾아서"는 사용자에게 정반대의 말이다.
            문구를 서버가 들고 있는 이유는 임계값을 서버에 두는 것과 같다 —
            판단의 근거와 그것을 설명하는 말이 갈라지면 한쪽만 바뀐다.
          */}
          {load.phase === 'loaded' && load.alternatives.length === 0 && (
            <p className="py-6 text-center text-sm whitespace-pre-line">
              {load.emptyMessage ?? '추천할 만한 다른 곳을 찾지 못했어요.'}
            </p>
          )}

          {/*
            반경 밖이거나 같은 분류가 없을 때. 억지로 먼 곳을 채우지 않는다 —
            5km 밖의 밥집은 같은 코스의 같은 칸을 대신할 수 없다.
          */}
          {load.phase === 'nearby' && load.nearby.length === 0 && (
            <p className="py-6 text-center text-sm">
              근처에 같은 분류의 다른 장소를 찾지 못했어요.
            </p>
          )}

          {load.phase === 'nearby' && load.nearby.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {load.nearby.map((item) => (
                <li
                  key={item.place.id}
                  className="bg-surface shadow-rest flex flex-col gap-3 rounded-[18px] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-fg text-base font-semibold tracking-[-0.01em]">
                        {item.place.name}
                      </span>
                      {/*
                        배지가 없다. 등급을 붙이려면 한적도가 있어야 하고, 없는 값에
                        아무 등급이나 얹으면 그 자체가 거짓말이 된다.
                      */}
                      <span className="text-hint text-[12.5px]">
                        {item.place.categoryName}
                      </span>
                    </div>

                    {/* 목록을 줄 세운 값이 곧 이 숫자다. 추천도 자리에 거리가 선다. */}
                    <div className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-hint text-[11px]">직선거리</span>
                      <span className="text-fg font-mono text-[22px] leading-none font-semibold">
                        {formatDistance(item.distanceKm)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="press rounded-ui border-line bg-surface text-fg hover:border-brand hover:text-brand-deep h-11 w-full cursor-pointer border text-sm font-semibold"
                    onClick={() => onSelect(item.place.id)}
                  >
                    이곳으로 바꾸기
                  </button>
                </li>
              ))}
            </ul>
          )}

          {load.phase === 'nearby' && load.nearby.length > 0 && (
            <button
              type="button"
              className="text-hint mt-2.5 h-11 w-full cursor-pointer bg-transparent text-[13.5px] font-medium"
              onClick={onClose}
            >
              그대로 둘게요
            </button>
          )}


          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {load.alternatives.map((alternative, index) => (
                <li
                  key={alternative.place.id}
                  className="bg-surface shadow-rest flex flex-col gap-3 rounded-[18px] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-fg text-base font-semibold tracking-[-0.01em]">
                          {alternative.place.name}
                        </span>
                        {/*
                          서버가 추천도 순으로 내려주므로 맨 위가 최선의 후보다.
                          다만 지금보다 더 붐비는 곳에 "추천"을 붙이면 안 된다 —
                          한적도가 추천도의 대부분을 차지하지만 전부는 아니라서,
                          훨씬 가까운 후보가 1등으로 올라오는 경우가 남는다.
                        */}
                        {index === 0 &&
                          originQuietness !== null &&
                          alternative.quietness > originQuietness && (
                          <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            추천
                          </span>
                        )}
                      </div>
                      {/* 한적도는 코스 편집 화면과 같은 배지로 담담하게 둔다. 판단의 원본 수치다. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-hint text-[12.5px]">
                          {alternative.place.categoryName}
                        </span>
                        <CongestionBadge
                          level={alternative.level}
                          label={alternative.levelLabel}
                          quietness={alternative.quietness}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* 목록을 줄 세운 값이 곧 이 숫자다. 그래서 카드에서 가장 크게 둔다. */}
                    <div className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-hint text-[11px]">추천도</span>
                      <span className="text-brand-deep font-mono text-[26px] leading-none font-semibold">
                        {alternative.recommendation}
                      </span>
                    </div>
                  </div>

                  {/*
                    추천 근거. 데이터를 어떻게 썼는지 보여주는 자리다.
                    문장 하나로는 "왜 82점인지"를 설명하지 못해서, 항목별 내역을 함께 편다.
                    반영 비율은 서버가 준 값을 그대로 쓴다 — 화면에 숫자를 적어두면
                    가중치가 바뀔 때 한쪽만 고쳐진다.
                  */}
                  <div className="bg-bg rounded-ui flex flex-col gap-2.5 px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="bg-quiet-soft/50 text-quiet-deep mt-px grid h-4 w-4 flex-none place-items-center rounded-full text-[10px] font-bold"
                        aria-hidden="true"
                      >
                        i
                      </span>
                      <p className="m-0 text-[12.5px] leading-[1.6] text-pretty">
                        {alternative.reason}
                      </p>
                    </div>

                    {/*
                      내역이 없어도 카드는 그려야 한다.

                      서버와 화면이 따로 배포되는 순간이 있고(구버전 서버가 아직 떠 있는 등),
                      그때 필드 하나가 비었다고 화면 전체가 하얘지면 안 된다.
                      근거 문장은 그대로 남으므로 추천 이유는 여전히 보인다.
                    */}
                    {alternative.factors?.length ? (
                    <ul className="border-line flex flex-col gap-2 border-t pt-2.5">
                      {alternative.factors.map((factor) => (
                        <li
                          key={factor.label}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        >
                          <span className="text-fg text-[12.5px] font-semibold">
                            {factor.label}
                          </span>
                          <span className="text-fg font-mono text-[12.5px] font-semibold">
                            {factor.score}
                          </span>
                          <span className="text-hint text-[11px]">
                            반영 {factor.weightPercent}%
                          </span>
                          {/* 근거는 줄을 바꿔 통째로 내린다. 좁은 화면에서 옆에 붙이면 넘친다. */}
                          <span className="text-hint basis-full text-[11.5px]">
                            {factor.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="press bg-brand hover:bg-brand-hover rounded-ui h-11 cursor-pointer text-[14.5px] font-semibold text-fg"
                    onClick={() => onSelect(alternative.place.id)}
                  >
                    이 장소로 교체
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/*
            다시 뽑기.

            서버가 상위 후보군에서 무작위로 고르므로 누를 때마다 다른 조합이 나온다.
            <b>버튼을 눌렀을 때만</b> 다시 뽑는다 — 시트를 여닫는 것만으로 목록이 바뀌면
            방금 봤던 후보를 다시 찾지 못한다.

            목록 아래에 둔다. 위에 두면 후보를 읽기도 전에 눈에 걸리고,
            "이 목록은 믿을 게 못 된다"는 인상을 먼저 준다.
          */}
          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                className="press text-muted hover:text-brand-deep rounded-chip cursor-pointer bg-transparent px-3 py-2 text-[13px] font-semibold"
                onClick={handleRedraw}
              >
                다른 곳도 볼래요
              </button>
            </div>
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
