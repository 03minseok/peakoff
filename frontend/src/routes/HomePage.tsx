import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight } from '../components/icons'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { BottomNav, HeaderNav } from '../components/BottomNav'
import { CongestionBadge } from '../components/CongestionBadge'
import { LEVEL_COLOR_VAR, LEVEL_SOLID, LEVEL_TINT } from '../components/levelStyles'
import { CARD } from '../components/styles'
import { DEFAULT_REGION, REGIONS, hasMultipleRegions, nextRegion, regionNameOf } from '../constants/regions'
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
 * 고른 날짜로 넘어가는 버튼의 <b>모양</b>. 색은 쓰는 쪽이 붙인다.
 *
 * <p>둘로 나눈 이유: 두 버튼은 크기·높이·비활성 처리가 같아야 하고 <b>면 처리만</b> 다르다
 * (하나는 채움, 하나는 테두리). 각자 전부 적어두면 나중에 한쪽 높이만 고쳐져
 * 나란히 선 두 버튼이 어긋난다.
 *
 * <p>비활성이 되면 <b>둘 다 색이 빠진다</b> — 채움은 회색 면으로, 테두리는 회색 선으로
 * 내려앉는다. 누를 수 없는 상태에서까지 주·보조를 구분해 봐야 고를 것이 없다.
 *
 * <p>{@code disabled:} 값을 여기 함께 둔다. 색을 붙이는 쪽에서 {@code bg-*}를 얹어도
 * 비활성 색이 이기는데, 이는 Tailwind가 변형(disabled:)을 기본 유틸리티보다
 * <b>뒤에</b> 출력하기 때문이다. 순서에 기대는 부분이라 한곳에 모아 둔다.
 */
const DATE_ACTION =
  'min-h-13 w-full cursor-pointer rounded-ui text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:border-line/60 disabled:bg-bg disabled:text-hint'

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

/**
 * "오늘의 OO" 카드 안의 한 덩이. 붐빔 쪽과 한적 쪽이 같은 모양을 쓴다.
 *
 * <p>소제목을 다는 이유: 줄마다 색점과 배지가 이미 등급을 말하지만, 그건 <b>줄 하나의</b>
 * 등급이다. "이 세 곳이 오늘 가장 붐빈다"는 묶음의 뜻은 제목이 있어야 전해진다.
 *
 * <p>제목 색을 등급색으로 칠하지 않는다. 이 카드에서 색은 3단계 신호이고, 제목은
 * 신호가 아니라 이름표다. 색을 쓰면 "붐빌 것으로 예상"이라는 글자 자체가 배지처럼 읽히고,
 * 줄마다 이미 배지가 하나씩 서 있어 배지 위에 배지가 얹힌다.
 *
 * <p>대신 <b>굵기와 진하기로 세운다.</b> 처음에는 11.5px 흐린 회색이었는데, 안에 담긴
 * 장소 이름(15px 진한 글자)보다 약해서 묶음의 제목으로 읽히지 않았다. 제목이 자기 내용보다
 * 작고 흐리면 그냥 주석처럼 보인다. 크기는 이름보다 작게 두되(목록의 주인공은 장소다)
 * 색과 굵기는 이름과 같은 급으로 올린다.
 *
 * <p>앞에 붙이던 색점은 뺐다. 어느 묶음인지는 <b>두 덩이를 가르는 선</b>과 제목 글자가
 * 이미 말하고 있어서, 점은 신호를 하나 더 얹는 대신 줄 시작을 들쭉날쭉하게 만들었다 —
 * 제목만 점 하나만큼 오른쪽으로 밀려 아래 장소 이름들과 왼쪽 끝이 어긋났다.
 */
function HeadlineGroup({
  label,
  spots,
  className = '',
}: {
  label: string
  spots: HeadlineSpot[]
  /** 카드 안에서 이 덩이가 차지할 자리. 넓은 화면에서 절반씩 나눠 갖는 데 쓴다 */
  className?: string
}) {
  if (spots.length === 0) {
    return null
  }
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-fg px-0.5 pb-1.5 text-[13px] font-bold tracking-[-0.01em]">
        {label}
      </span>
      {spots.map((spot, index) => (
        <HeadlineRow key={spot.place.id} spot={spot} last={index === spots.length - 1} />
      ))}
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

function ForecastCard({
  day,
  selected,
  onSelect,
}: {
  day: ForecastDay
  selected: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)
  const weekend = weekday === '토' || weekday === '일'

  return (
    // 넓은 화면의 줄({@link ForecastRow})과 같다 — 카드 하나가 곧 고르는 버튼이다
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`box-border flex w-26 flex-none cursor-pointer flex-col rounded-[18px] p-3.5 text-left transition-all ${
        selected
          ? 'border-quiet-soft bg-quiet-tint shadow-raised border-[1.5px]'
          : 'bg-surface shadow-rest hover:shadow-raised'
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
        {/* 배지는 늘 등급만 말한다. "가장 한적"은 머리글 문구가 맡는다 */}
        <span
          className={`rounded-full px-2.25 py-0.75 text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
        >
          {day.levelLabel}
        </span>
      </div>
      {weekend && <span className="sr-only">주말</span>}
    </button>
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
function ForecastRow({
  day,
  selected,
  onSelect,
}: {
  day: ForecastDay
  /** 사용자가 고른 날. 가장 한적한 날과는 무관하다 */
  selected: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)

  return (
    /*
      줄 하나가 곧 고르는 버튼이다. 누르면 <b>선택될 뿐</b> 화면을 옮기지 않는다.
      이동은 아래 "코스 짜기" 버튼이 맡는다 — 목록에서 날짜를 견줘 보는 동안
      실수로 눌러 화면이 넘어가면 비교하던 것이 사라진다.

      강조는 "선택됨" 하나뿐이다. 가장 한적한 날에도 색을 깔면 "이 줄이 특별하다"는
      신호가 둘이 되어, 어느 것이 내가 고른 것인지 흐려진다. 그건 머리글 문구가 맡는다.
    */
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-quiet-tint ring-quiet-soft ring-1' : 'hover:bg-bg'
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

      {/* 배지는 늘 등급만 말한다. "가장 한적"은 머리글 문구가 맡는다 */}
      <span
        className={`w-11 flex-none rounded-full py-0.75 text-center text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
      >
        {day.levelLabel}
      </span>
    </button>
  )
}

/**
 * 지역을 넘기는 간격.
 *
 * 홈은 훑어보는 화면이라 한 지역을 읽을 만큼은 머물러야 한다. 너무 짧으면 읽는 중에
 * 바뀌어 성가시고, 너무 길면 다른 지역이 있다는 사실 자체가 전해지지 않는다.
 */
const REGION_ROTATE_MS = 8000

export function HomePage() {
  const navigate = useNavigate()
  const { member, loading: authLoading } = useAuth()
  /*
   * 지금 보고 있는 지역.
   *
   * 상수가 아니라 상태로 둔다. 지역이 늘면 이 값만 갈아끼우면 아래 화면 전체가 따라온다 —
   * "오늘의 OO", 붐빔·한적 목록, 주간 예보가 전부 이 값에서 나온다.
   *
   * 일정 시간마다 넘기려면 nextRegion(regionSlug)로 이 값을 바꾸는 타이머만 걸면 된다.
   * 지역이 하나뿐인 지금은 nextRegion이 자기 자신을 돌려주므로 걸어도 아무 일이 없다.
   */
  const [regionSlug, setRegionSlug] = useState(DEFAULT_REGION)

  /*
   * 일정 시간마다 다음 지역으로 넘긴다.
   *
   * 지역이 하나뿐이면 타이머를 아예 걸지 않는다 — nextRegion이 자기 자신을 돌려주므로
   * 걸어도 화면은 그대로지만, 30초마다 의미 없이 다시 그릴 이유가 없다.
   *
   * ⚠️ 지역이 늘면 이 자리에 "멈춤" 수단이 필요하다. 읽는 중에 내용이 저절로 바뀌는 것은
   * 접근성 지침이 막는 동작이다(WCAG 2.2.2). 화살표나 점 표시로 직접 넘길 수 있게 하고,
   * 사용자가 손대면 자동 넘김을 멈추는 편이 맞다.
   */
  /**
   * 사용자가 지역을 <b>직접 골랐는가.</b> 고르면 자동 넘김이 멈춘다.
   *
   * <p>접근성 지침이 요구하는 것이다(WCAG 2.2.2) — 읽는 중에 내용이 저절로 바뀌면
   * 따라 읽기 어렵고, 멈출 방법이 없으면 그 화면을 쓸 수 없는 사람이 생긴다.
   *
   * <p>다시 켜는 수단은 두지 않았다. 자동 넘김은 "다른 지역도 있다"를 알리는 장치이고,
   * 직접 고른 사람은 이미 그것을 알았다. 되돌리려면 새로고침이면 된다.
   */
  const [pinnedRegion, setPinnedRegion] = useState(false)

  useEffect(() => {
    if (!hasMultipleRegions() || pinnedRegion) {
      return
    }
    const timer = setInterval(() => setRegionSlug(nextRegion), REGION_ROTATE_MS)
    return () => clearInterval(timer)
  }, [pinnedRegion])

  const state = useHomeData(regionSlug)
  const regionName = regionNameOf(regionSlug)
  const data = state.phase === 'loaded' ? state.data : null

  /** 사용자가 직접 고른 날짜. 아직 안 골랐으면 null이고, 그때는 가장 한적한 날을 쓴다 */
  const [pickedDate, setPickedDate] = useState<string | null>(null)

  /**
   * 지금 선택된 날짜. <b>가장 한적한 날이 기본값</b>이다.
   *
   * <p>effect로 데이터가 도착할 때 값을 밀어넣지 않고 파생값으로 둔다. 그러면 상태가
   * 하나뿐이라 "사용자가 골랐는가"만 기억하면 되고, 데이터가 늦게 와도 순서 문제가 없다.
   * effect로 채우면 첫 렌더에 빈 상태가 한 번 그려졌다가 값이 들어오며 화면이 튄다.
   *
   * <p>널이 되는 때는 아직 불러오는 중일 때뿐이다. 그때만 버튼이 잠긴다 —
   * 고를 날짜 자체가 없는데 눌리면 갈 곳 없는 화면으로 넘어간다.
   */
  const activeDate = pickedDate ?? data?.bestDay.date ?? null

  return (
    // pb-26: 아래 고정된 BottomNav가 마지막 버튼을 가리지 않게 한다. md부터는 막대가 사라진다.
    <div className="flex min-h-svh flex-col pb-26 md:pb-10">
      {/*
        1. 상단 — 공용 헤더(Layout)와 <b>같은 모양의 고정 막대</b>다.

        원래 홈만 배경 위에 뜬 자기 머리글을 썼는데, 흰 막대·경계선·sticky가 없어
        "헤더가 없는 화면"으로 읽혔고 스크롤하면 이동 수단이 사라졌다.
        제품형 서비스는 어느 화면이든 같은 헤더 하나가 따라다니는 것이 표준이다 —
        홈만 다른 문법을 쓰면 화면을 오가는 사람이 매번 다시 배운다.

        Layout 안으로 넣지 않고 모양만 맞춘 이유: 홈 본문은 자기 폭 체계(SHELL)와
        가장자리 여백을 쓰고 있어, Layout의 본문 패딩이 겹으로 얹히면 전부 다시 만져야 한다.
        대신 이 막대의 클래스는 Layout 헤더와 같은 값을 쓴다 — 다르게 보이면 고친 의미가 없다.
      */}
      <header className="bg-surface border-line sticky top-0 z-10 h-14 border-b">
        {/*
          안쪽 폭은 SHELL(본문용 단계 폭)이 아니라 Layout 헤더와 <b>같은 max-w-app</b>이다.
          SHELL을 쓰면 중간 폭 화면에서 로고·메뉴가 본문 폭에 맞춰 안쪽으로 몰렸다가,
          다른 화면으로 넘어가는 순간 Layout 헤더 자리로 퍼진다 — 헤더는 화면이 바뀌어도
          픽셀 하나 안 움직여야 같은 헤더로 읽힌다.
        */}
        <div className="max-w-app mx-auto flex h-full items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {/*
              홈에서도 로고를 링크로 둔다. 이미 홈이라 눌러도 화면은 그대로지만,
              <b>다른 화면과 같은 것으로 보여야</b> 한다 — 어떤 화면에서는 손가락 커서가 뜨고
              어떤 화면에서는 안 뜨면, 사용자는 로고가 링크인지 아닌지를 매번 시험하게 된다.
              누를 수 있게 생긴 것은 어디서나 누를 수 있어야 한다.
            */}
            <Link
              to="/"
              className="flex flex-none items-center gap-2 no-underline"
              aria-label="PEAKOFF 처음으로"
            >
              <span className="bg-brand relative h-5 w-5 rounded-[7px]" aria-hidden="true">
                <span className="bg-fg absolute top-1.5 left-1.5 h-2 w-2 rounded-full" />
              </span>
              <span className="text-fg text-xs font-bold tracking-[0.16em]">PEAKOFF</span>
            </Link>
            <HeaderNav />
          </div>

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
              className="text-hint hover:text-fg -mr-2 flex-none rounded-chip p-2 text-[13px] font-medium no-underline"
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

        <b>첫 줄은 들어가는 문 둘이 반씩 나눠 갖는다(6+6).</b> 직접 짜기와 추천받기는
        같은 비중의 주요 기능이라 크기도 같아야 한다. 한쪽을 작게 두면 사용자가
        "이건 곁다리"라고 배우고, 나중에 크기를 키울 때 그 학습을 되돌려야 한다.

        둘째 줄은 데이터다. 넓이를 다르게 준다 — 전부 같으면 무엇을 먼저 보라는 것인지가
        사라진다. 목록 길이에 맞춰 오늘(4) · 한적한 곳(5) · 이번 주(3)로 나눴다.

        배치는 전부 자동이다. row-span을 쓰지 않아 DOM 순서가 곧 화면 순서이고,
        좁은 화면에서 순서를 되돌리는 장치(order)도 필요 없어졌다.

          ┌───────────────┬───────────────┐
          │ 코스 직접 짜기 │ 코스 추천받기  │
          ├───────┬───────┴──────┬────────┤
          │ 오늘의 │ 지금 한적한 곳 │ 이번 주 │
          │ 경주   │              │ 한적한날│
          └───────┴──────────────┴────────┘
      */}
      {/*
        위·좌우 여백은 Layout 본문(pt-6/lg:pt-8, px-4.5/md:px-6/lg:px-8)과 같은 값이다.
        홈만 다르면 코스짜기 등 다른 화면으로 넘어갈 때마다 내용 시작점이 위아래로 튄다.
      */}
      <div className={`${SHELL} px-4.5 pt-6 md:px-6 lg:px-8 lg:pt-8`}>
        <div className="flex flex-col gap-7.5 lg:grid lg:grid-cols-12 lg:gap-4">
          {/* 2. 진입점 ① 직접 짜기 — 이 서비스의 원래 흐름 */}
          <div className={`${CELL} lg:col-span-6`}>
            {/*
              lg:flex-1 — 그리드 칸은 줄 높이만큼 늘어나므로, 버튼이 남는 높이를 채워
              옆 칸과 아랫변이 맞는다. 이게 없으면 큰 칸 아래에만 빈 공간이 남는다.
            */}
            {/*
              카드는 <b>누르는 것이 아니다.</b> 예전에는 카드 전체가 button이라 어디를 눌러도
              넘어갔는데, 그러면 안에 든 "시작하기"가 장식으로 전락한다 — 사용자는 무엇이
              버튼인지 배우지 못하고, 카드 안에 다른 링크를 하나라도 넣는 순간 중첩이 된다.
              들어가는 문은 아래 링크 하나다.

              hover는 카드를 살짝 띄우되 <b>커서는 바꾸지 않는다.</b> 카드가 손가락 커서를
              달고 있으면 "여기도 눌리는데?"가 되어 방금 없앤 혼란이 되돌아온다.
              대신 같은 hover에서 CTA가 함께 반응해 눌러야 할 곳을 가리킨다.
            */}
            <div className="group bg-fg relative w-full overflow-hidden rounded-[24px] px-6 pt-6.5 pb-6 text-left text-white shadow-[0_8px_26px_rgb(42_62_84/0.18)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgb(42_62_84/0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
          {/*
            장식 원을 잘라내는 층.

            원이 카드 오른쪽으로 40px 삐져나가는데, 열(max-w-430)이 가운데 정렬이라
            화면이 510px보다 넓으면 양옆 여백에 묻힌다. 그보다 좁아지는 순간 화면 밖으로
            나가 페이지 전체에 가로 스크롤이 생긴다.

            모서리는 카드와 같은 값으로 깎아야 둥근 부분 밖으로 색이 비치지 않는다.
          */}
          <span
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
            aria-hidden="true"
          >
            {/*
              글로우 두 개가 서비스의 서사다 — 위는 틸(브랜드·행동이자 한적한 방향), 아래는 핑크(붐빔).
              어두운 네이비 면마다 이 두 기운을 마주 놓아 "붐빔에서 한적으로"라는 방향을
              장식에도 배게 한다. 로그인 패널·결과 히어로와 같은 문법이다.
              알파를 낮게 두는 이유: 진하게 깔면 어두운 면 위에서 탁해진다.
            */}
            <span className="absolute -top-14.5 -right-14 h-50 w-50 rounded-full bg-[rgb(63_193_201/0.14)]" />
            <span className="absolute -bottom-23 right-6 h-37.5 w-37.5 rounded-full bg-[rgb(252_81_133/0.09)]" />
          </span>
          <span className="relative flex flex-col gap-3">
            {/*
              킥커는 브랜드 틸이다. 다른 색을 쓰면 카드의 색 기운이 둘로 갈린다.
              "brand는 배경 전용" 규칙은 흰 카드 위의 2.2:1 때문인데, 여기는 어두운 잉크 위라
              5.1:1로 넉넉하다 — 규칙의 이유가 사라지는 유일한 자리다.
            */}
            <span className="text-brand text-[11.5px] font-semibold tracking-[0.1em]">
              START PLANNING
            </span>
            <span className="text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
              여행 코스 짜기
            </span>
            <span className="max-w-62.5 text-sm leading-[1.6] text-white/60">
              날짜를 정하면 각 장소가 그날 얼마나 붐빌지 미리 계산해 드려요.
            </span>
            {/* 이 링크가 유일한 문이다. button+navigate 대신 Link라 새 탭으로도 열린다 */}
            <Link
              to="/plan"
              className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
            >
              시작하기
              {/* 카드에 손을 올리면 화살표가 함께 나아가 "여기를 누르세요"를 가리킨다 */}
              <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </Link>
          </span>
        </div>

          {/*
            "이 기기에 저장한 코스"는 뺐다. 기기 저장(localStorage) 자체를 없앴기 때문이다 —
            저장된 코스는 이제 계정에만 있고, 그건 마이페이지가 보여준다.
          */}
        </div>

        {/*
          3. 진입점 ② 추천받기 — 왼쪽 진입점과 <b>같은 칸 수(6)</b>다.

          갈 곳을 이미 정한 사람과 빈손으로 온 사람은 다른 문으로 들어온다. 지금까지는
          앞의 문 하나뿐이라, 뒤쪽 사람은 30개 목록에서 장소를 담는 일이 첫 관문이 되어
          진단까지 가보지도 못하고 나갔다.

          크기는 왼쪽과 같다. 두 문 다 실제로 동작하므로 어느 쪽이 곁다리가 아니다.

          <b>점선을 실선으로 바꿨다.</b> 점선은 "준비 중"이라는 상태 신호였는데 기능이
          생겼으므로 남길 이유가 없다 — 미완성으로 읽히는 테두리를 그대로 두면
          동작하는 기능을 사용자가 눌러보지 않는다.

          색은 여전히 다르다. 왼쪽은 어두운 면, 이쪽은 흰 면에 노란 테두리다.
          노란 면을 통째로 깔면 로고와 주요 버튼에만 남겨야 할 강조색이 화면 절반을 차지한다.
        */}
        <div className={`${CELL} lg:col-span-6`}>
          {/* 왼쪽 카드와 같은 규칙 — 카드는 누르는 것이 아니고, hover는 CTA를 가리킨다 */}
          <div className="group border-brand bg-surface shadow-rest relative w-full overflow-hidden rounded-[24px] border-[1.5px] px-6 pt-6.5 pb-6 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
            <span className="relative flex flex-col gap-3">
              <span className="text-brand-deep text-[11.5px] font-semibold tracking-[0.1em]">
                GET A COURSE
              </span>
              <span className="text-fg text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
                여행 코스 추천받기
              </span>
              <span className="text-muted max-w-62.5 text-sm leading-[1.6]">
                몇 가지만 답하면 취향에 맞으면서 덜 붐비는 코스를 만들어 드려요.
              </span>
              {/*
                왼쪽 카드와 같은 노란 알약이다. 회색 테두리 알약은 "준비 중"의 표현이었다 —
                눌러도 되는 버튼을 비활성처럼 그려두면 사용자는 없는 기능으로 읽는다.
                두 문이 같은 모양의 버튼을 갖는 것이 맞다. 둘 다 실제로 열리니까.
              */}
              <Link
                to="/recommend"
                className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
              >
                시작하기
                <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
              </Link>
            </span>
          </div>
        </div>

        {state.phase === 'error' && (
          /* 데이터 줄 전체를 채운다. 한 칸만 쓰면 나머지가 통째로 비어 오류보다 빈칸이 먼저 보인다 */
          <div className={`${CELL} lg:col-span-12`}>
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              오늘의 혼잡 정보를 불러오지 못했어요.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          </div>
        )}

        {state.phase !== 'error' && (
        <>
          {/* 3. 오늘의 경주 — 오늘 가장 붐빌 것으로 보이는 명소들 */}
          <section className={`${CELL} gap-3 lg:col-span-4 lg:gap-3`}>
            {/*
              제목과 설명을 <b>한 묶음</b>으로 싼다. 설명을 섹션의 별도 항목으로 두면
              칸 사이 간격(gap-3)을 받아 제목에서 멀어지는데, 옆의 "지금 한적한 곳"은
              둘을 한 묶음(gap-0.75)으로 두고 있었다. 같은 층위의 두 섹션이 서로 다른
              간격을 쓰면 나란히 놓였을 때 머리글 높이가 어긋나 보인다.
            */}
            <div className="flex flex-col gap-0.75 px-1">
              {/*
                지역 탭. <b>자동 넘김을 멈추는 수단이기도 하다.</b>

                화살표나 점 표시 대신 이름을 그대로 세운 이유: 점은 "몇 번째인지"만 알려주고
                어디로 가는지는 눌러 봐야 안다. 지역이 셋뿐이라 이름을 다 적을 수 있다.

                하나뿐이면 그리지 않는다. 고를 것이 없는 탭은 누를 수 있다는 신호만 주고
                아무 일도 하지 않아 오히려 헷갈린다.
              */}
              {hasMultipleRegions() && (
                <div className="mb-1.5 flex flex-wrap gap-1.5" role="group" aria-label="지역 고르기">
                  {REGIONS.map((option) => {
                    const active = option.slug === regionSlug
                    return (
                      <button
                        key={option.slug}
                        type="button"
                        className={`rounded-chip h-8 cursor-pointer px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                          active ? 'bg-fg text-white' : 'bg-surface text-muted hover:text-fg'
                        }`}
                        aria-pressed={active}
                        onClick={() => {
                          setRegionSlug(option.slug)
                          setPinnedRegion(true)
                        }}
                      >
                        {option.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={SECTION_TITLE}>오늘의 {regionName}</h2>
                {/* toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다. */}
                <span className="text-hint font-mono text-xs">
                  {formatKoreanDate(today())} 기준
                </span>
              </div>
              {/* 예측·통계값이라 "실시간"이라고 쓰지 않는다. 화면 어디서도 마찬가지다. */}
              <span className="text-hint text-[12.5px]">
                오늘 예상되는 혼잡이에요.
                <br />
                예측값이라 실제와 다를 수 있어요.
              </span>
            </div>

            {/*
              한 카드 안에 붐빔과 한적을 <b>같은 수로</b> 나란히 둔다.

              붐비는 곳만 늘어놓으면 "그래서 어쩌라고"가 된다. 피할 곳 옆에 갈 곳이
              같은 무게로 서 있어야 이 서비스가 하려는 말이 카드 하나에서 끝난다.
              두 덩이를 가르는 것은 소제목과 얇은 선뿐이다 — 카드를 둘로 쪼개면
              "같은 날, 같은 계산의 양 끝"이라는 관계가 끊긴다.

              lg:flex-1 — 옆의 진입점 칸이 더 길 때 목록이 위에 붙어 뜨지 않게 한다.

              <b>카드 전체를 가운데 정렬하지 않는다.</b> 그러면 두 덩이가 함께 중앙으로
              몰려 위아래만 비고, 정작 선을 기준으로 보면 양쪽 다 가운데 쪽으로 치우친다.
              대신 각 덩이가 절반씩 나눠 갖고(lg:flex-1) 자기 절반 안에서 가운데에 선다.
              그래야 선이 카드의 실제 한가운데에 놓이고 위아래 여백이 같아진다.
            */}
            <div className={`${CARD} flex flex-col px-4 py-3 lg:flex-1`}>
              {data ? (
                <>
                  <HeadlineGroup
                    label="붐빌 것으로 예상"
                    spots={data.headline.crowded}
                    className="lg:flex-1 lg:justify-center"
                  />
                  {/*
                    두 덩이를 가르는 선.

                    -mx-4로 카드 안쪽 여백을 거슬러 <b>카드 폭 끝까지</b> 긋는다. 안쪽에서
                    끊기면 줄 사이의 얇은 구분선(각 장소 사이)과 같은 것으로 보여, 묶음이
                    갈린다는 신호가 되지 않는다. 끝까지 닿아야 "여기서 다른 이야기가 시작된다"가 된다.

                    색도 줄 사이 선(border-bg)보다 진한 border-line이다. 같은 색이면
                    굵기와 길이만으로는 층위가 구분되지 않는다.
                  */}
                  <span className="bg-line -mx-4 my-3 h-px" aria-hidden="true" />
                  <HeadlineGroup
                    label="한적할 것으로 예상"
                    spots={data.headline.quiet}
                    className="lg:flex-1 lg:justify-center"
                  />
                </>
              ) : (
                Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 py-2.75">
                    <span className="skeleton h-2.25 w-2.25 flex-none rounded-full" />
                    <span className="skeleton h-3.25 w-23" />
                    <span className="flex-1" />
                    <span className="skeleton h-6 w-15.5 rounded-full" />
                  </div>
                ))
              )}
            </div>

          </section>

          {/* 4. 지금 한적한 곳 — 바로 왼쪽 "오늘의 경주"의 대안이다. 붙어 있어야 짝으로 읽힌다 */}
          <section className={`${CELL} gap-3 lg:col-span-5 lg:gap-3`}>
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>지금 한적한 곳</h2>
              <span className="text-hint text-[12.5px]">
                오늘 {regionName}에서 가장 덜 붐빌 것으로 보이는 곳
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-1">
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
          {/* 5. 이번 주 한적한 날 — 장소가 아니라 날짜로 혼잡을 피하는 경로 */}
          {/*
            오른쪽 좁고 긴 칸. 두 줄을 차지해(row-span-2) 왼쪽 두 칸이 쌓인 높이와 아랫변이 맞는다.

            데이터 줄의 마지막 칸이다. 예전에는 두 줄을 차지하느라(row-span-2) DOM에서
            "지금 한적한 곳"보다 앞에 있어야 했고, 그 탓에 좁은 화면에서는 순서를 되돌리는
            장치(order)까지 필요했다. 첫 줄을 진입점 둘이 가져가면서 이 칸도 한 줄이 되어
            <b>그 두 가지가 모두 사라졌다</b> — 이제 DOM 순서가 곧 화면 순서다.
          */}
          <section className={`${CELL} gap-3 lg:col-span-3 lg:gap-3`}>
            {/*
              가장 한적한 날은 <b>문구로</b> 말한다. 목록에서 그 줄만 색을 깔면
              "선택됨"과 신호가 부딪혀, 어느 것이 내가 고른 것인지 흐려진다.
              색은 선택에만 쓰고, 최적일은 글로 짚는다.
            */}
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>이번 주 한적한 날</h2>
              {data ? (
                <span className="text-hint text-[12.5px]">
                  <strong className="text-brand-deep font-semibold">
                    {formatCompactDate(data.bestDay.date)} {formatWeekday(data.bestDay.date)}
                  </strong>
                  이 가장 한적해요
                </span>
              ) : (
                <span className="text-hint text-[12.5px]">앞으로 7일 예상 혼잡</span>
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
                        selected={day.date === activeDate}
                        onSelect={() => setPickedDate(day.date)}
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
                      selected={day.date === activeDate}
                      onSelect={() => setPickedDate(day.date)}
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

            {/*
              고르는 일과 넘어가는 일을 나눈다.

              목록은 <b>고르기만</b> 하고, 화면을 옮기는 것은 이 버튼 하나다. 줄을 누를 때마다
              바로 넘어가면 날짜를 견줘 보다가 실수로 스쳐도 비교하던 것이 사라진다.

              고르기 전에는 비활성이다. 가장 한적한 날을 미리 골라두면 사용자는 화면이 정한
              값을 <b>자기가 고른 것</b>으로 착각한 채 넘어가, 어느 날로 짜는지 모르게 된다.
              문구도 상태를 그대로 말한다 — 비활성일 때 "코스 짜기"라고만 적혀 있으면
              왜 안 눌리는지 알 수 없다.
            */}
            {/*
              고른 날짜로 갈 수 있는 문 둘. 위쪽 진입점 두 개와 같은 짝이다 —
              날짜를 정한 사람도 <b>직접 짤지 추천받을지</b>는 아직 안 정했을 수 있다.
              한쪽만 두면 날짜를 고른 순간 나머지 길이 닫힌다.

              <b>채움 하나 + 테두리 하나로 짝을 짓는다.</b> 전에는 둘 다 흰 면에 테두리만
              달랐는데(회색 1px / 틸 1.5px), 그러면 같은 종류의 버튼 둘이 굵기와 색만
              어긋난 채 서 있어 틸 테두리 하나가 홀로 떠 보인다. 게다가 흰 카드 위의
              흰 버튼이라 <b>누르는 것으로 보이지 않았다</b> — 예보를 다 본 다음 시선이
              닿아야 할 자리인데 가장 조용했다.

              같은 틸의 채움과 테두리는 서로를 설명한다. 주·보조가 한눈에 갈리면서도
              두 문이 같은 기운으로 묶여, 마이페이지 빈 화면의 두 문과도 같은 모양이 된다.
              채움이 직접 짜기인 것은 서비스의 원래 흐름이기 때문이고, 그 순서는
              위쪽 진입점 두 카드에서도 같다.

              shadow-cta는 얹지 않는다. 위쪽 카드의 CTA도 그림자 없이 색으로만 서 있어,
              여기만 그림자를 두면 같은 버튼이 화면 안에서 두 무게를 갖는다.
            */}
            <div className="flex flex-col gap-2 px-1">
              <button
                type="button"
                disabled={activeDate === null}
                className={`${DATE_ACTION} bg-brand hover:bg-brand-hover text-fg`}
                onClick={() =>
                  activeDate && navigate('/plan', { state: { startDate: activeDate } })
                }
              >
                {activeDate ? `${formatCompactDate(activeDate)}로 코스 짜기` : '코스 짜기'}
              </button>
              <button
                type="button"
                disabled={activeDate === null}
                className={`${DATE_ACTION} border-brand bg-surface text-fg hover:bg-bg border-[1.5px]`}
                onClick={() =>
                  activeDate && navigate('/recommend', { state: { startDate: activeDate } })
                }
              >
                {activeDate ? `${formatCompactDate(activeDate)}로 추천받기` : '추천받기'}
              </button>
            </div>

          </section>

        </>
        )}
        </div>

        {/*
          출처 표기. 절대 규칙 4 — 공사 이름·로고는 못 쓰고 "공공데이터 기반" 같은
          중립 표현만 허용된다. 화면의 모든 숫자가 어디서 왔는지 말하는 유일한 줄이라,
          심사위원이 어느 화면에서 시작하든 닿는 홈에 둔다.
        */}
        <p className="text-hint m-0 pt-5 pb-2 text-center text-[11.5px]">
          혼잡 예측은 공공데이터 기반 통계·예측값으로, 실제와 다를 수 있어요.
        </p>
      </div>
    </div>
  )
}
