import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Close, Heart } from './icons'
import { CongestionBadge } from './CongestionBadge'
import { fetchPlaceDescription } from '../services/api'
import type { CongestionLevel } from '../types/api'
import { useAuth } from '../state/authContext'
import { useFavorites } from '../state/favoriteContext'
import { useScrollLock } from '../hooks/useScrollLock'

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
  /**
   * ⚠️ <b>null일 수 있다.</b> 찜 목록에서 여는 경우가 그렇다 — 분류 칸이 서버에 생기기 전에
   * 찜한 곳은 값이 없다. 없으면 그 줄을 세우지 않는다(빈 자리는 "안 불러온 값"으로 읽힌다).
   */
  categoryName: string | null
  imageUrl: string | null
  /** 그 날의 한적도. 예측이 닿지 않는 장소는 null이라 배지를 그리지 않는다 */
  quietness?: number | null
  level?: CongestionLevel | null
  levelLabel?: string | null
  /**
   * "이 장소로 여행가기". <b>주는 쪽이 있을 때만 선다.</b>
   *
   * <p>홈의 "이번 주 한적한 곳"에서 연 시트에만 있다. 진단 화면에서 연 장소는
   * <b>이미 코스에 담겨 있어</b> 다시 담을 일이 없고, 거기서 이 버튼을 누르면
   * 짜던 코스를 버리고 새로 시작하게 된다 — 같은 시트인데 자리에 따라
   * 정반대의 일이 일어나는 셈이다.
   *
   * <p>그래서 문패가 아니라 <b>넘겨받는 일감</b>으로 둔다. 시트는 이 값이 있으면
   * 버튼을 세우고, 없으면 세우지 않는다.
   */
  onPlanTrip?: () => void
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
  onPlanTrip,
  onClose,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  const { member } = useAuth()
  const { isFavorite, toggle } = useFavorites()
  const favorite = isFavorite(placeId)

  /**
   * 게스트가 하트를 눌렀는가.
   *
   * <p><b>하트를 감추지 않는다.</b> 감추면 게스트는 이 기능이 있는 줄도 모르고,
   * 로그인할 이유도 하나 줄어든다. 대신 누르면 <b>왜 안 되는지</b>를 그 자리에서 말한다 —
   * 로그인 화면으로 튕겨내지 않는 이유는 지금 읽던 장소를 잃기 때문이다.
   */
  const [needsLogin, setNeedsLogin] = useState(false)

  function handleHeart() {
    if (!member) {
      setNeedsLogin(true)
      return
    }
    toggle({ id: placeId, name: placeName, categoryName, imageUrl })
  }

  // 닫았을 때 보던 자리로 돌아와야 한다.
  // ⚠️ body가 아니라 html에 건다 — 그래야 sticky가 얼지 않는다(useScrollLock 주석).
  useScrollLock()
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
    return () => {
      document.removeEventListener('keydown', handleKey)
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
              {/*
                ■ 하트는 <b>제목 옆</b>이다

                사진 위(닫기 버튼 옆)에 얹을 수도 있지만, 거기는 사진 밝기에 따라 아이콘이
                묻힌다 — 공사 사진은 밝은 하늘이 많다. 흰 면 위에 두면 켜짐·꺼짐이 늘 또렷하다.

                <p>제목과 <b>같은 줄</b>에 둔 이유: 찜은 "이 장소"에 거는 표시라 이름 옆이
                가장 짧게 이어진다. 아래 버튼 자리로 내리면 "이 장소로 여행가기"와 나란히 서서
                <b>둘 다 다음 단계</b>로 읽히는데, 하트는 다음 단계가 아니라 표시다.
              */}
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="place-detail-title"
                  className="text-fg m-0 text-[20px] leading-[1.35] font-bold tracking-[-0.015em] text-pretty"
                >
                  {placeName}
                </h2>
                <button
                  type="button"
                  onClick={handleHeart}
                  aria-pressed={favorite}
                  aria-label={favorite ? `${placeName} 찜 취소` : `${placeName} 찜하기`}
                  /*
                    켜지면 <b>빨강</b>이다({@code --c-like}). 하트는 어느 문화에서나 빨강이라
                    이 자리에서만큼은 색이 곧 뜻이다.

                    <p>⚠️ 그 빨강은 <b>붐빔과 다른 색</b>이어야 한다. 붐빔(#e82c6e)은 자홍 기운이고
                    이쪽은 주황 기운이라 나란히 두어도 갈린다 — 같은 색을 쓰면 한적한 곳을
                    찜했는데 "붐빔"과 같은 색으로 켜져 신호가 엇갈린다. 자세한 것은 index.css.
                  */
                  className={`press touch-hitbox grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-chip bg-transparent transition-colors ${
                    favorite ? 'text-like' : 'text-hint hover:text-fg'
                  }`}
                >
                  <Heart size={20} filled={favorite} />
                </button>
              </div>
              {/*
                게스트가 하트를 눌렀을 때만 선다. 자리를 미리 비워두지 않는 이유는,
                누르기 전에는 아무 문제도 없는데 안내가 서 있으면 <b>못 쓰는 기능</b>처럼
                보이기 때문이다.
              */}
              {needsLogin && (
                <p className="bg-bg text-muted rounded-ui m-0 px-3 py-2 text-[12.5px] leading-[1.6]">
                  로그인하면 찜할 수 있어요.{' '}
                  <Link to="/login" className="text-brand-deep font-semibold">
                    로그인하기
                  </Link>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {categoryName && <span className="text-hint text-[12.5px]">{categoryName}</span>}
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

            {/*
              ■ 문을 <b>맨 아래</b>에 둔다

              소개글을 읽고 나서 정하는 자리다. 위에 두면 아직 어떤 곳인지 모르는 채
              눌러야 하고, 소개글이 길 때는 다 읽고 나서 되돌아 올라가야 한다.

              <p>글이 아직 안 왔어도 버튼은 선다. 소개글은 <b>곁들이는 정보</b>이고
              이 사람이 여기 온 이유는 홈에서 이 곳이 한적하다고 읽었기 때문이다 —
              소개 조회가 느리다고 갈 길을 막을 이유가 없다.
            */}
            {onPlanTrip && (
              <button
                type="button"
                onClick={onPlanTrip}
                className="press bg-brand hover:bg-brand-hover text-fg rounded-ui mt-1 h-12 w-full cursor-pointer text-[15px] font-semibold transition-colors"
              >
                이 장소로 여행가기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
