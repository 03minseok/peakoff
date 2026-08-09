import { Link, useNavigate } from 'react-router'
import { ChevronRight } from '../components/icons'
import { BottomNav, HeaderNav } from '../components/BottomNav'
import { CongestionBadge } from '../components/CongestionBadge'
import { LEVEL_COLOR_VAR, LEVEL_SOLID, LEVEL_TINT } from '../components/levelStyles'
import { CARD, SECONDARY_BUTTON } from '../components/styles'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'
import { useHomeData } from '../hooks/useHomeData'
import type { ForecastDay, HeadlineSpot, QuietSpot } from '../hooks/useHomeData'
import { useAuth } from '../state/authContext'
import { formatCompactDate, formatKoreanDate, formatWeekday, today } from '../utils/date'

/**
 * 화면 폭.
 *
 * 모바일은 한 줄로 읽고, lg부터 대시보드처럼 좌우로 편다.
 * 680px에서 멈춰 두면 1440px 화면에서 양옆 380px씩이 그냥 빈다.
 */
const SHELL = 'mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-app'

const SECTION_TITLE = 'text-fg m-0 text-[17px] font-bold tracking-[-0.015em]'

/**
 * 벤토 칸 하나.
 *
 * <p>{@code min-w-0}이 핵심이다. 그리드 칸의 기본값은 {@code min-width:auto}라
 * <b>안쪽 내용보다 좁아지지 않는다.</b> 이번 주 섹션의 가로 스크롤 상자가 이 칸에 들어가는데,
 * 그대로 두면 카드 7장(≈820px)만큼 칸이 벌어지고 그만큼이 페이지 가로 스크롤이 된다.
 * 좁은 화면에서 같은 사고를 이미 한 번 겪은 자리다.
 */
const CELL = 'flex min-w-0 flex-col gap-5 lg:gap-4'

/**
 * 사진 자리.
 *
 * 목업 데이터에는 이미지가 없고, 실제 API도 사진이 없는 관광지가 많다.
 * 깨진 이미지 아이콘 대신 이름 첫 글자를 얹은 면을 둔다 — 자리와 크기가 유지돼
 * 사진이 있는 카드와 없는 카드가 같은 리듬으로 늘어선다.
 */
function PlaceThumbnail({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="h-21 w-21 flex-none rounded-[14px] object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <span
      className="bg-brand-tint text-brand-deep grid h-21 w-21 flex-none place-items-center rounded-[14px] text-[22px] font-bold"
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}

function HeadlineRow({ spot, last }: { spot: HeadlineSpot; last: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 py-2.75 ${last ? '' : 'border-bg border-b'}`}
    >
      <span
        className={`h-2.25 w-2.25 flex-none rounded-full ${LEVEL_SOLID[spot.level]}`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-fg truncate text-[15px] font-semibold tracking-[-0.01em]">
          {spot.place.name}
        </span>
        <span className="text-hint text-xs">{spot.place.categoryName}</span>
      </div>
      <span
        className={`flex-none rounded-full px-2.75 py-1.25 text-center font-mono text-xs font-semibold ${LEVEL_TINT[spot.level]}`}
      >
        {spot.levelLabel} {spot.quietness}
      </span>
    </div>
  )
}

function QuietCard({ spot }: { spot: QuietSpot }) {
  return (
    <div className={`${CARD} flex gap-3.25 p-3`}>
      <PlaceThumbnail name={spot.place.name} imageUrl={spot.place.imageUrl} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.75">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.75">
            <span className="text-fg truncate text-base font-semibold tracking-[-0.01em]">
              {spot.place.name}
            </span>
            <span className="text-hint text-[12.5px]">{spot.place.categoryName}</span>
          </div>
          <CongestionBadge level={spot.level} label={spot.levelLabel} size="sm" />
        </div>

        <div className="flex items-center gap-2.25">
          <div className="bg-line/60 h-1.5 flex-1 overflow-hidden rounded-[3px]">
            <div
              className="h-full rounded-[3px]"
              style={{
                width: `${spot.quietness}%`,
                background: LEVEL_COLOR_VAR[spot.level],
              }}
            />
          </div>
          <span className="text-brand-deep flex-none font-mono text-xs font-semibold">
            {spot.quietness}
          </span>
        </div>

        {/* 근거. 계산한 비교만 적는다 — 방문객 수 같은 없는 수치를 지어내지 않는다. */}
        <span className="text-hint text-xs leading-[1.5]">{spot.reason}</span>
      </div>
    </div>
  )
}

function ForecastCard({ day, best }: { day: ForecastDay; best: boolean }) {
  const weekday = formatWeekday(day.date).charAt(0)
  const weekend = weekday === '토' || weekday === '일'

  return (
    <div
      className={`box-border flex w-26 flex-none flex-col rounded-[18px] bg-surface p-3.5 ${
        best ? 'border-quiet-soft shadow-raised border-[1.5px]' : 'shadow-rest'
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-xs font-semibold ${
            weekday === '일' ? 'text-crowded' : weekday === '토' ? 'text-quiet' : 'text-hint'
          }`}
        >
          {weekday}
        </span>
        <span className="text-fg font-mono text-[15px] font-semibold tracking-[-0.01em]">
          {formatCompactDate(day.date)}
        </span>
      </div>

      {/* 막대는 위가 아니라 아래에서 자란다. 값이 클수록(한적할수록) 높이 찬다. */}
      <div className="flex flex-1 items-end py-2">
        <div className="bg-bg flex h-14 w-full items-end overflow-hidden rounded-[8px]">
          <div
            className="w-full rounded-[8px]"
            style={{
              // 0점인 날도 막대가 보여야 "값이 없다"로 오해되지 않는다.
              height: `${Math.max(10, day.quietness)}%`,
              background: LEVEL_COLOR_VAR[day.level],
            }}
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1.25">
        <span
          className={`font-mono text-[17px] font-semibold tracking-[-0.02em] ${
            day.level === 'QUIET'
              ? 'text-quiet-deep'
              : day.level === 'MODERATE'
                ? 'text-moderate-deep'
                : 'text-crowded-deep'
          }`}
        >
          {day.quietness}
        </span>
        <span
          className={`rounded-full px-2.25 py-0.75 text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
        >
          {day.levelLabel}
        </span>
      </div>
      {weekend && <span className="sr-only">주말</span>}
    </div>
  )
}

/**
 * 넓은 화면의 하루 한 줄.
 *
 * <p>같은 7일을 <b>가로 막대</b>로 눕힌다. 세로 막대 카드({@link ForecastCard})를 그대로
 * 넓은 칸에 늘리면 카드 하나가 지나치게 커지고, 막대 높이는 그대로라 날짜별 차이가
 * 오히려 안 보인다. 가로로 눕히면 길이 차이가 한눈에 읽히고, 세로로 쌓아도
 * 7일이 한 화면에 들어간다.
 *
 * <p>모바일과 나눠 그리는 이유: 하나의 마크업으로 두 방향을 다 만들려면 막대의
 * 축(height ↔ width)이 반대라 스타일이 조건문 범벅이 된다. 읽을 수 있는 쪽을 택했다.
 */
function ForecastRow({ day, best }: { day: ForecastDay; best: boolean }) {
  const weekday = formatWeekday(day.date).charAt(0)

  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] px-2.5 py-2 ${
        best ? 'bg-quiet-tint' : ''
      }`}
    >
      <div className="flex w-13 flex-none items-baseline gap-1.25">
        <span className="text-fg font-mono text-[13px] font-semibold">
          {formatCompactDate(day.date)}
        </span>
        <span
          className={`text-[11px] font-semibold ${
            weekday === '일' ? 'text-crowded' : weekday === '토' ? 'text-quiet' : 'text-hint'
          }`}
        >
          {weekday}
        </span>
      </div>

      {/* 막대는 왼쪽에서 자란다. 길수록(한적할수록) 멀리 뻗는다 */}
      <div className="bg-bg h-6 min-w-0 flex-1 overflow-hidden rounded-[7px]">
        <div
          className="flex h-full items-center justify-end rounded-[7px] pr-2"
          style={{
            // 0점인 날도 막대가 보여야 "값이 없다"로 오해되지 않는다.
            width: `${Math.max(14, day.quietness)}%`,
            background: LEVEL_COLOR_VAR[day.level],
          }}
        >
          <span className="font-mono text-[11.5px] font-semibold text-white">
            {day.quietness}
          </span>
        </div>
      </div>

      <span
        className={`w-11 flex-none rounded-full py-0.75 text-center text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
      >
        {day.levelLabel}
      </span>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  const state = useHomeData(DEFAULT_REGION)


  const regionName = REGIONS.find((option) => option.slug === DEFAULT_REGION)?.name ?? ''
  const data = state.phase === 'loaded' ? state.data : null

  return (
    // pb-26: 아래 고정된 BottomNav가 마지막 버튼을 가리지 않게 한다. md부터는 막대가 사라진다.
    <div className="flex min-h-svh flex-col pb-26 md:pb-10">
      {/* 1. 상단 — 서비스가 무엇인지 한 줄로 말하고, 로그인은 구석에 작게 둔다. */}
      <header className={`${SHELL} flex items-start justify-between gap-4 px-5 pt-4.5 lg:px-8 lg:pt-6`}>
        <div className="flex flex-col gap-1.75">
          <div className="flex items-center gap-2">
            <span className="bg-brand relative h-5.5 w-5.5 rounded-[8px]" aria-hidden="true">
              <span className="bg-fg absolute top-1.75 left-1.75 h-2 w-2 rounded-full" />
            </span>
            <span className="text-fg text-[13px] font-bold tracking-[0.16em]">PEAKOFF</span>
          </div>
          <p className="m-0 text-[13.5px] leading-[1.5]">
            붐비는 곳은 피해요, 한적한 곳들로 떠나는 {regionName}
          </p>
        </div>
        {/*
          홈은 Layout을 쓰지 않아 헤더를 직접 그린다. 그래서 HeaderNav도 여기 직접 넣어야 한다 —
          빠뜨리면 넓은 화면에서 이동 수단이 통째로 사라진다(BottomNav는 md에서 숨으므로).
        */}
        <div className="flex flex-none items-center gap-5">
          <HeaderNav />

          {/*
            로그인한 뒤에는 이 자리를 비운다. 마이페이지로 가는 길은 이미 나란히 서 있는
            HeaderNav에 있어서, 닉네임까지 링크로 두면 같은 곳으로 가는 문이 두 개가 된다.

            확인이 끝나기 전에도 비워 둔다. "로그인"이 떴다가 사라지면 눈에 거슬린다.
          */}
          {authLoading ? (
            <span className="h-4 w-12 flex-none" aria-hidden="true" />
          ) : member ? null : (
            <Link
              to="/login"
              className="text-hint hover:text-fg flex-none px-0.5 py-1.5 text-[13px] font-medium whitespace-nowrap"
            >
              로그인
            </Link>
          )}
        </div>
      </header>
      <BottomNav />

      {/*
        벤토 그리드.

        모바일은 지금까지처럼 한 줄로 쌓이고(flex-col), lg부터 12칸 그리드로 편다.
        칸을 같은 크기로 나누지 않는 것이 요점이다 — 주 진입점은 크게, 날짜 예보는
        좁고 길게. 전부 같은 크기면 무엇을 먼저 보라는 것인지가 사라진다.

        배치는 자동이다. 이번 주 칸만 두 줄을 차지하고(row-span-2), 나머지는
        DOM 순서대로 흘러 들어간다. 칸마다 좌표를 박아두면 저장된 코스처럼
        <b>있을 때도 없을 때도 있는 카드</b> 하나에 배치 전체가 어긋난다.

          ┌─────────────┬───────────┬────────┐
          │ 주 진입점    │ 오늘의 경주 │ 이번 주 │
          │ + 저장한 코스│           │ 한적한 │
          ├─────────────┴───────────┤ 날     │
          │ 지금 한적한 곳            │        │
          └─────────────────────────┴────────┘
      */}
      <div className={`${SHELL} px-4 pt-5.5 lg:px-8 lg:pt-6`}>
        <div className="flex flex-col gap-7.5 lg:grid lg:grid-cols-12 lg:gap-4">
          {/* 2. 주 진입점 — 화면에서 가장 큰 덩어리. 여기부터 서비스가 시작된다. */}
          <div className={`${CELL} lg:col-span-5`}>
            {/*
              lg:flex-1 — 그리드 칸은 줄 높이만큼 늘어나므로, 버튼이 남는 높이를 채워
              옆 칸과 아랫변이 맞는다. 이게 없으면 큰 칸 아래에만 빈 공간이 남는다.
            */}
            <button
              type="button"
              onClick={() => navigate('/plan')}
              className="bg-fg relative w-full cursor-pointer overflow-hidden rounded-[24px] px-6 pt-6.5 pb-6 text-left text-white shadow-[0_8px_26px_rgb(22_33_31/0.18)] lg:flex-1 lg:px-8 lg:pt-9"
            >
          {/*
            장식 원을 잘라내는 층.

            버튼에도 overflow-hidden이 걸려 있지만 그것만으로는 잘리지 않는다.
            <button>은 폼 컨트롤이라 브라우저가 자체 렌더링 규칙을 얹어, 절대 위치 자식이
            기대대로 잘리지 않는다. 그래서 잘라내는 일은 평범한 span에 맡긴다.

            안 하면 이렇게 된다 — 원이 버튼 오른쪽으로 항상 40px 삐져나가는데,
            열(max-w-430)이 가운데 정렬이라 화면이 510px보다 넓으면 양옆 여백에 묻힌다.
            그보다 좁아지는 순간 화면 밖으로 나가 페이지 전체에 가로 스크롤이 생긴다.

            같은 장식이 결과 화면(section)과 로그인 화면(aside)에도 있는데 거기는 멀쩡하다.
            일반 요소에서는 overflow-hidden이 그대로 먹기 때문이다.

            모서리는 버튼과 같은 값으로 깎아야 둥근 부분 밖으로 색이 비치지 않는다.
          */}
          <span
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
            aria-hidden="true"
          >
            <span className="absolute -top-14.5 -right-14 h-50 w-50 rounded-full bg-[rgb(14_124_134/0.3)]" />
            <span className="absolute -bottom-23 right-6 h-37.5 w-37.5 rounded-full bg-[rgb(14_124_134/0.16)]" />
          </span>
          <span className="relative flex flex-col gap-3">
            <span className="text-quiet-soft text-[11.5px] font-semibold tracking-[0.1em]">
              START PLANNING
            </span>
            <span className="text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
              여행 코스 짜기
            </span>
            <span className="max-w-62.5 text-sm leading-[1.6] text-white/60">
              날짜를 정하면 각 장소가 그날 얼마나 붐빌지 미리 계산해 드려요.
            </span>
            <span className="bg-brand text-fg rounded-ui mt-1.5 inline-flex h-11.5 items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold">
              시작하기 <ChevronRight />
            </span>
          </span>
        </button>

          {/*
            "이 기기에 저장한 코스"는 뺐다. 기기 저장(localStorage) 자체를 없앴기 때문이다 —
            저장된 코스는 이제 계정에만 있고, 그건 마이페이지가 보여준다.
          */}
        </div>

        {state.phase === 'error' && (
          /* 남은 7칸을 그대로 채운다. 5칸짜리 진입점 옆이 통째로 비면 오류보다 그 빈칸이 먼저 보인다 */
          <div className={`${CELL} lg:col-span-7`}>
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              오늘의 혼잡 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
          </div>
        )}

        {state.phase !== 'error' && (
        <>
          {/* 3. 오늘의 경주 — 오늘 가장 붐빌 것으로 보이는 명소들 */}
          <section className={`${CELL} gap-3 lg:col-span-4 lg:gap-3`}>
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className={SECTION_TITLE}>오늘의 {regionName}</h2>
              {/* toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다. */}
              <span className="text-hint font-mono text-xs">{formatKoreanDate(today())} 기준</span>
            </div>
            
            {/* 예측·통계값이라 "실시간"이라고 쓰지 않는다. 화면 어디서도 마찬가지다. */}
            <p className="text-hint m-0 px-1 text-[11.5px] leading-[1.5]">
              오늘 가장 붐빌 것으로 예상되는 곳들이에요. 예측값이라 실제와 다를 수 있어요.
            </p>

            {/* lg:flex-1 + justify-center — 옆의 진입점 칸이 더 길 때 목록이 위에 붙어 뜨지 않게 한다 */}
            <div className={`${CARD} px-4 py-1.5 lg:flex lg:flex-1 lg:flex-col lg:justify-center`}>
              {data
                ? data.headline.map((spot, index) => (
                    <HeadlineRow
                      key={spot.place.id}
                      spot={spot}
                      last={index === data.headline.length - 1}
                    />
                  ))
                : Array.from({ length: 5 }, (_, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 py-2.75 ${
                        index === 4 ? '' : 'border-bg border-b'
                      }`}
                    >
                      <span className="skeleton h-2.25 w-2.25 flex-none rounded-full" />
                      <span className="skeleton h-3.25 w-23" />
                      <span className="flex-1" />
                      <span className="skeleton h-6 w-15.5 rounded-full" />
                    </div>
                  ))}
            </div>

          </section>

          {/* 4. 이번 주 한적한 날 — 장소가 아니라 날짜로 혼잡을 피하는 경로 */}
          {/*
            오른쪽 좁고 긴 칸. 두 줄을 차지해(row-span-2) 왼쪽 두 칸이 쌓인 높이와 아랫변이 맞는다.

            <b>DOM에서 "지금 한적한 곳"보다 앞에 있어야 한다.</b> 그리드 자동 배치는 앞으로만
            움직여서, 9칸짜리가 먼저 놓이면 두 줄짜리가 들어갈 자리를 지나쳐 버리고
            첫 줄 오른쪽 3칸이 통째로 빈 채 셋째 줄이 생긴다.

            그래서 좁은 화면에서는 순서를 되돌린다(max-lg:order-last). 모바일에서 읽는 차례는
            "장소 → 장소 → 날짜"가 맞다 — 날짜 대안은 장소를 다 본 뒤에 꺼내는 두 번째 경로다.
          */}
          <section className={`${CELL} max-lg:order-last gap-3 lg:col-span-3 lg:row-span-2 lg:gap-3`}>
            <div className="flex items-baseline justify-between gap-3 px-1 lg:flex-col lg:items-start lg:gap-1.5">
              {/* 옆의 칩이 flex-none이라 줄어들지 않는다. min-w-0이 없으면 이쪽이 밀려 넘칠 수 있다. */}
              <div className="flex min-w-0 flex-col gap-0.75">
                <h2 className={SECTION_TITLE}>이번 주 한적한 날</h2>
                <span className="text-hint text-[12.5px]">앞으로 7일 예상 혼잡</span>
              </div>
              {data && (
                <span className="bg-brand-tint text-brand-deep flex-none rounded-full px-2.75 py-1.25 text-[12.5px] font-semibold whitespace-nowrap">
                  {formatCompactDate(data.bestDay.date)} {formatWeekday(data.bestDay.date)}이 가장
                  한적
                </span>
              )}
            </div>

            {/*
              좁은 화면: 가로 스크롤.
              7일을 세로로 쌓으면 화면을 다 잡아먹고, 억지로 줄이면 막대가 짧아져 차이가 안 보인다.

              스크롤 상자는 폭이 확정된 칸 안의 평범한 블록이라 칸 폭을 그대로 받는다
              (칸에 min-w-0이 걸려 있는 이유가 이것이다). 안쪽 트랙만 w-max로 내용만큼 넓어진다.

              트랙에 mx-auto를 걸지 않는다. 내용이 상자보다 넓을 때 auto 여백이 음수가 되어
              왼쪽으로도 삐져나간다 — 그쪽은 스크롤로 닿지도 않는다.
            */}
            <div className="no-scrollbar overflow-x-auto lg:hidden">
              <div className="flex w-max gap-2.5 pb-3">
                {data
                  ? data.forecast.map((day) => (
                      <ForecastCard
                        key={day.date}
                        day={day}
                        best={day.date === data.bestDay.date}
                      />
                    ))
                  : Array.from({ length: 7 }, (_, index) => (
                      <div
                        key={index}
                        className="bg-surface shadow-rest box-border flex h-39.5 w-26 flex-none flex-col gap-2.5 rounded-[18px] p-3.5"
                      >
                        <span className="skeleton h-3 w-10" />
                        <span className="skeleton w-full flex-1 rounded-[8px]" />
                      </div>
                    ))}
              </div>
            </div>

            {/* 넓은 화면: 같은 7일을 가로 막대로 눕혀 세로로 쌓는다 */}
            <div className={`${CARD} hidden flex-1 flex-col justify-center gap-0.5 p-2.5 lg:flex`}>
              {data
                ? data.forecast.map((day) => (
                    <ForecastRow
                      key={day.date}
                      day={day}
                      best={day.date === data.bestDay.date}
                    />
                  ))
                : Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 px-2.5 py-2">
                      <span className="skeleton h-3 w-13 flex-none" />
                      <span className="skeleton h-6 flex-1 rounded-[7px]" />
                      <span className="skeleton h-4 w-11 flex-none rounded-full" />
                    </div>
                  ))}
            </div>

            <div className="px-1">
              <button
                type="button"
                className={`${SECONDARY_BUTTON} w-full`}
                onClick={() =>
                  navigate('/plan', data ? { state: { startDate: data.bestDay.date } } : undefined)
                }
              >
                {data
                  ? `${formatCompactDate(data.bestDay.date)}로 코스 짜기`
                  : '한적한 날로 코스 짜기'}
              </button>
            </div>
          </section>

          {/* 5. 지금 한적한 곳 — 위 목록의 대안이 되는 자리. 아래 줄을 넓게 쓴다 */}
          <section className={`${CELL} gap-3 lg:col-span-9 lg:gap-3`}>
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>지금 한적한 곳</h2>
              <span className="text-hint text-[12.5px]">
                오늘 {regionName}에서 가장 덜 붐빌 것으로 보이는 곳
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {data
                ? data.quiet.map((spot) => <QuietCard key={spot.place.id} spot={spot} />)
                : Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className={`${CARD} flex gap-3.25 p-3`}>
                      <span className="skeleton h-21 w-21 flex-none rounded-[14px]" />
                      <div className="flex flex-1 flex-col gap-2.5 pt-1.5">
                        <span className="skeleton h-4 w-32.5" />
                        <span className="skeleton h-3 w-22.5" />
                        <span className="skeleton h-1.5 w-full rounded-[3px]" />
                      </div>
                    </div>
                  ))}
            </div>
          </section>
        </>
        )}
        </div>
      </div>
    </div>
  )
}
