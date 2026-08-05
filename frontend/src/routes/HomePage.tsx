import { Link, useNavigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { LEVEL_COLOR_VAR, LEVEL_SOLID, LEVEL_TINT } from '../components/levelStyles'
import { CARD, CARD_RAISED, SECONDARY_BUTTON } from '../components/styles'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'
import { useHomeData } from '../hooks/useHomeData'
import type { ForecastDay, HeadlineSpot, QuietSpot } from '../hooks/useHomeData'
import { useAuth } from '../state/authContext'
import { clearSavedCourse, loadSavedCourse } from '../state/savedCourse'
import { useTrip } from '../state/tripContext'
import { formatCompactDate, formatDateRange, formatKoreanDate, formatWeekday, today } from '../utils/date'
import { useState } from 'react'

/** 홈은 모바일 한 줄로 읽는 화면이다. 넓은 화면에서는 카드만 두 칸으로 편다. */
const COLUMN = 'mx-auto w-full max-w-[430px] md:max-w-[680px]'

const SECTION_TITLE = 'text-fg m-0 text-[17px] font-bold tracking-[-0.015em]'

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

export function HomePage() {
  const navigate = useNavigate()
  const { restore } = useTrip()
  const { member, loading: authLoading } = useAuth()
  const state = useHomeData(DEFAULT_REGION)

  const [savedCourse, setSavedCourse] = useState(loadSavedCourse)

  const regionName = REGIONS.find((option) => option.slug === DEFAULT_REGION)?.name ?? ''
  const data = state.phase === 'loaded' ? state.data : null

  return (
    <div className="flex min-h-svh flex-col pb-10">
      {/* 1. 상단 — 서비스가 무엇인지 한 줄로 말하고, 로그인은 구석에 작게 둔다. */}
      <header className={`${COLUMN} flex items-start justify-between gap-4 px-5 pt-4.5`}>
        <div className="flex flex-col gap-1.75">
          <div className="flex items-center gap-2">
            <span className="bg-brand relative h-5.5 w-5.5 rounded-[8px]" aria-hidden="true">
              <span className="bg-bg absolute top-1.75 left-1.75 h-2 w-2 rounded-full" />
            </span>
            <span className="text-fg text-[13px] font-bold tracking-[0.16em]">PEAKOFF</span>
          </div>
          <p className="m-0 text-[13.5px] leading-[1.5]">
            붐비는 곳은 피해요, 한적한 곳들로 떠나는 {regionName}
          </p>
        </div>
        {/* 확인이 끝나기 전에는 비워 둔다. "로그인"이 떴다가 닉네임으로 바뀌면 눈에 거슬린다. */}
        {authLoading ? (
          <span className="h-4 w-12 flex-none" aria-hidden="true" />
        ) : member ? (
          /* 닉네임이 마이페이지로 가는 문이다. 로그아웃은 그 안에 있다. */
          <Link
            to="/my"
            className="text-fg hover:text-brand flex max-w-32 flex-none items-center gap-1.5 px-0.5 py-1.5 text-[13px] font-semibold whitespace-nowrap"
          >
            <span className="truncate">{member.nickname}</span>
            <span className="text-hint" aria-hidden="true">
              ›
            </span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="text-hint hover:text-fg flex-none px-0.5 py-1.5 text-[13px] font-medium whitespace-nowrap"
          >
            로그인
          </Link>
        )}
      </header>

      {/* 2. 주 진입점 — 화면에서 가장 큰 덩어리. 여기부터 서비스가 시작된다. */}
      <div className={`${COLUMN} px-4 pt-5.5`}>
        <button
          type="button"
          onClick={() => navigate('/plan')}
          className="bg-fg relative w-full cursor-pointer overflow-hidden rounded-[24px] px-6 pt-6.5 pb-6 text-left text-white shadow-[0_8px_26px_rgb(22_33_31/0.18)]"
        >
          <span
            className="absolute -top-14.5 -right-14 h-50 w-50 rounded-full bg-[rgb(14_124_134/0.3)]"
            aria-hidden="true"
          />
          <span
            className="absolute -bottom-23 right-6 h-37.5 w-37.5 rounded-full bg-[rgb(14_124_134/0.16)]"
            aria-hidden="true"
          />
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
            <span className="bg-brand rounded-ui mt-1.5 inline-flex h-11.5 items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold">
              시작하기 <span aria-hidden="true">›</span>
            </span>
          </span>
        </button>
      </div>

      {/* 기기에 저장해둔 코스가 있으면 첫 화면에서 바로 이어갈 수 있어야 한다. */}
      {savedCourse && (
        <div className={`${COLUMN} px-4 pt-3`}>
          <section className={`${CARD_RAISED} flex flex-col gap-3 p-4.5`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-fg text-sm font-semibold">이 기기에 저장한 코스</span>
              <button
                type="button"
                className="text-hint hover:text-muted cursor-pointer bg-transparent text-xs"
                onClick={() => {
                  clearSavedCourse()
                  setSavedCourse(null)
                }}
              >
                지우기
              </button>
            </div>
            <div className="rounded-ui bg-bg flex items-center gap-2.5 px-3.5 py-3">
              <span className="bg-brand h-2 w-2 flex-none rounded-full" aria-hidden="true" />
              <p className="m-0 text-[12.5px] leading-[1.5]">
                {REGIONS.find((option) => option.slug === savedCourse.plan.region)?.name ?? ''} ·{' '}
                {formatDateRange(savedCourse.plan.startDate, savedCourse.plan.nights)} ·{' '}
                {savedCourse.days.flat().length}곳
              </p>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                restore(savedCourse.plan, savedCourse.days)
                navigate('/course')
              }}
            >
              이어서 보기
            </button>
          </section>
        </div>
      )}

      {state.phase === 'error' && (
        <div className={`${COLUMN} px-4 pt-6`}>
          <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
            오늘의 혼잡 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        </div>
      )}

      {state.phase !== 'error' && (
        <>
          {/* 3. 오늘의 경주 — 오늘 가장 붐빌 것으로 보이는 명소들 */}
          <section className={`${COLUMN} flex flex-col gap-3 px-4 pt-7.5`}>
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className={SECTION_TITLE}>오늘의 {regionName}</h2>
              {/* toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다. */}
              <span className="text-hint font-mono text-xs">{formatKoreanDate(today())} 기준</span>
            </div>

            <div className={`${CARD} px-4 py-1.5`}>
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

            {/* 예측·통계값이라 "실시간"이라고 쓰지 않는다. 화면 어디서도 마찬가지다. */}
            <p className="text-hint m-0 px-1 text-[11.5px] leading-[1.5]">
              오늘 가장 붐빌 것으로 예상되는 곳들이에요. 예측값이라 실제와 다를 수 있어요.
            </p>
          </section>

          {/* 4. 지금 한적한 곳 — 위 목록의 대안이 되는 자리 */}
          <section className={`${COLUMN} flex flex-col gap-3 px-4 pt-7.5`}>
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

          {/* 5. 이번 주 한적한 날 — 장소가 아니라 날짜로 혼잡을 피하는 경로 */}
          <section className="flex flex-col gap-3 pt-7.5">
            <div className={`${COLUMN} flex items-baseline justify-between gap-3 px-5`}>
              <div className="flex flex-col gap-0.75">
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
              가로 스크롤. 7일을 세로로 쌓으면 화면을 다 잡아먹고, 억지로 줄이면
              막대가 짧아져 날짜별 차이가 안 보인다. 옆으로 미는 편이 비교하기 좋다.
            */}
            <div className={`${COLUMN} no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-3`}>
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

            <div className={`${COLUMN} px-5`}>
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
        </>
      )}
    </div>
  )
}
