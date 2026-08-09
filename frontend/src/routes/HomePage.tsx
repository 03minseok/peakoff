import { Link, useNavigate } from 'react-router'
import { ChevronRight } from '../components/icons'
import { BottomNav, HeaderNav } from '../components/BottomNav'
import { CongestionBadge } from '../components/CongestionBadge'
import { LEVEL_COLOR_VAR, LEVEL_SOLID, LEVEL_TINT } from '../components/levelStyles'
import { CARD } from '../components/styles'
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
  best,
  onSelect,
}: {
  day: ForecastDay
  best: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)
  const weekend = weekday === '토' || weekday === '일'

  return (
    // 넓은 화면의 줄({@link ForecastRow})과 같다 — 카드 하나가 곧 버튼이다
    <button
      type="button"
      onClick={onSelect}
      className={`box-border flex w-26 flex-none cursor-pointer flex-col rounded-[18px] bg-surface p-3.5 text-left transition-shadow ${
        best ? 'border-quiet-soft shadow-raised border-[1.5px]' : 'shadow-rest hover:shadow-raised'
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
        {best ? (
          <span className="bg-quiet rounded-full px-2.25 py-0.75 text-[10.5px] font-semibold text-white">
            가장 한적
          </span>
        ) : (
          <span
            className={`rounded-full px-2.25 py-0.75 text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
          >
            {day.levelLabel}
          </span>
        )}
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
  best,
  onSelect,
}: {
  day: ForecastDay
  best: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)

  return (
    /*
      줄 하나가 곧 버튼이다. 날짜를 누르면 그 날로 코스를 짜러 간다.

      예전에는 목록 아래에 "OO로 코스 짜기" 버튼이 따로 있어 <b>가장 한적한 날 하나만</b>
      고를 수 있었다. 나머지 여섯 날은 보여주기만 하고 누를 수 없었는데, 사용자가 주말밖에
      시간이 없다면 2등 날짜를 고를 방법이 없었다.
    */
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${
        best ? 'bg-quiet-tint hover:bg-quiet-soft/40' : 'hover:bg-bg'
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

      {/*
        가장 한적한 날이면 등급 배지 대신 <b>"가장 한적"</b>을 세운다.
        머리글에 따로 적어두던 것을 이 자리로 옮겼다 — 어느 날인지 말로 다시 설명하는 것보다
        그 줄에 붙여두는 편이 짧고, 목록을 훑는 눈이 한 번에 찾는다.
      */}
      {best ? (
        <span className="bg-quiet text-[10.5px] w-11 flex-none rounded-full py-0.75 text-center font-semibold text-white">
          가장 한적
        </span>
      ) : (
        <span
          className={`w-11 flex-none rounded-full py-0.75 text-center text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
        >
          {day.levelLabel}
        </span>
      )}
    </button>
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
      <div className={`${SHELL} px-4 pt-5.5 lg:px-8 lg:pt-6`}>
        <div className="flex flex-col gap-7.5 lg:grid lg:grid-cols-12 lg:gap-4">
          {/* 2. 진입점 ① 직접 짜기 — 이 서비스의 원래 흐름 */}
          <div className={`${CELL} lg:col-span-6`}>
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

        {/*
          3. 진입점 ② 추천받기 — 왼쪽 진입점과 <b>같은 칸 수(6)</b>다.

          갈 곳을 이미 정한 사람과 빈손으로 온 사람은 다른 문으로 들어온다. 지금까지는
          앞의 문 하나뿐이라, 뒤쪽 사람은 30개 목록에서 장소를 담는 일이 첫 관문이 되어
          진단까지 가보지도 못하고 나갔다.

          아직 만들지 않았지만 크기는 처음부터 같게 둔다. 작게 뒀다가 나중에 키우면
          그동안 사용자가 배운 위계("이건 곁다리")를 되돌려야 한다.

          색은 다르다. 왼쪽은 어두운 면(동작하는 기능), 이쪽은 옅은 브랜드 면에 점선이다 —
          크기로 비중을 말하고, 색과 배지로 상태를 말한다.
        */}
        <div className={`${CELL} lg:col-span-6`}>
          <button
            type="button"
            onClick={() => navigate('/recommend')}
            className="border-brand-deep/25 bg-brand-tint hover:bg-brand/50 relative w-full cursor-pointer overflow-hidden rounded-[24px] border border-dashed px-6 pt-6.5 pb-6 text-left transition-colors lg:flex-1 lg:px-8 lg:pt-9"
          >
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
              <span className="bg-surface/80 text-brand-deep rounded-ui mt-1.5 inline-flex h-11.5 items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold">
                준비 중 <ChevronRight />
              </span>
            </span>
          </button>
        </div>

        {state.phase === 'error' && (
          /* 데이터 줄 전체를 채운다. 한 칸만 쓰면 나머지가 통째로 비어 오류보다 빈칸이 먼저 보인다 */
          <div className={`${CELL} lg:col-span-12`}>
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              오늘의 혼잡 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
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
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={SECTION_TITLE}>오늘의 {regionName}</h2>
                {/* toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다. */}
                <span className="text-hint font-mono text-xs">
                  {formatKoreanDate(today())} 기준
                </span>
              </div>
              {/* 예측·통계값이라 "실시간"이라고 쓰지 않는다. 화면 어디서도 마찬가지다. */}
              <span className="text-hint text-[12.5px]">
                오늘 예상되는 혼잡이에요. 예측값이라 실제와 다를 수 있어요.
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
              "OO이 가장 한적"이라 적던 칩은 머리글에서 뺐다. 어느 날인지 말로 다시
              설명하는 대신 <b>그 줄에 직접</b> 붙였다 — 목록에 답이 있는데 머리글이
              같은 말을 미리 하면, 읽는 사람은 같은 것을 두 번 확인하게 된다.

              다른 두 섹션과 같은 머리글 구조(gap-0.75 한 묶음)로 맞췄다.
            */}
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>이번 주 한적한 날</h2>
              <span className="text-hint text-[12.5px]">
                날짜를 누르면 그 날로 코스를 짜요
              </span>
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
                        onSelect={() => navigate("/plan", { state: { startDate: day.date } })}
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
                      onSelect={() => navigate("/plan", { state: { startDate: day.date } })}
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
              "OO로 코스 짜기" 버튼은 뺐다. 이제 목록의 모든 줄이 같은 일을 한다.

              그 버튼은 <b>가장 한적한 날 하나만</b> 고를 수 있었다. 나머지 여섯 날은
              보여주기만 하고 누를 수 없어서, 주말밖에 시간이 없는 사람에게는 2등 날짜를
              고를 방법이 없었다. 남겨두면 "줄을 눌러야 하나 버튼을 눌러야 하나"가 갈린다.
            */}

          </section>

        </>
        )}
        </div>
      </div>
    </div>
  )
}
