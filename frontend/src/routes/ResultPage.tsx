import { useMemo, useState } from 'react'
import { ArrowRight } from '../components/icons'
import { Link, Navigate, useLocation } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { SaveCourseSheet } from '../components/SaveCourseSheet'
import { LEVEL_SOLID } from '../components/levelStyles'
import {
  CARD_RAISED,
  NOTICE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from '../components/styles'
import { regionNameOf } from '../constants/regions'
import { currentDiagnosis, toSlots, useDiagnosis } from '../hooks/useDiagnosis'
import { saveCourse } from '../services/api'
import { recallPlaces } from '../services/placeCache'
import { useTrip } from '../state/tripContext'
import type { CongestionLevel, CourseDiagnosis, DiagnosedSlot, Place } from '../types/api'
import { formatCompactDate, formatKoreanDate } from '../utils/date'

/**
 * 한적도가 실제로 매겨진 슬롯.
 *
 * 교체 비교는 <b>두 점수를 빼는 화면</b>이라 점수 없는 칸을 다룰 수 없다.
 * 진단되지 않은 자리에는 애초에 대안 버튼이 서지 않으므로 교체도 일어나지 않는다.
 */
type ScoredSlot = DiagnosedSlot & {
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

interface Change {
  day: number
  order: number
  before: ScoredSlot
  after: ScoredSlot
}

function isScored(slot: DiagnosedSlot): slot is ScoredSlot {
  return slot.quietness !== null && slot.level !== null && slot.levelLabel !== null
}

/**
 * 원안과 개선안에서 <b>같은 자리</b>(일차·순서)를 맞대어 바뀐 곳을 찾는다.
 *
 * 교체는 자리를 유지한 채 장소만 바꾸므로 자리 기준 비교가 성립한다.
 */
function diffCourses(before: CourseDiagnosis, after: CourseDiagnosis): Change[] {
  return after.slots
    .map((afterSlot) => {
      const beforeSlot = before.slots.find(
        (slot) => slot.day === afterSlot.day && slot.order === afterSlot.order,
      )
      if (!beforeSlot || beforeSlot.place.id === afterSlot.place.id) {
        return null
      }
      // 점수가 없으면 "얼마나 나아졌는지"를 뺄 수 없다. 0으로 채우면 없는 개선을 지어내게 된다.
      if (!isScored(beforeSlot) || !isScored(afterSlot)) {
        return null
      }
      return { day: afterSlot.day, order: afterSlot.order, before: beforeSlot, after: afterSlot }
    })
    .filter((change): change is Change => change !== null)
}

/**
 * 코스 한 벌을 일자별로 늘어놓는 열. 원안과 개선안이 같은 모양이어야
 * 두 열을 눈으로 맞대어 볼 수 있다.
 */
function CourseColumn({
  title,
  subtitle,
  score,
  diagnosis,
  changedPlaceIds,
  highlighted,
}: {
  title: string
  subtitle: string
  /** 총점. 진단된 칸이 하나도 없으면 null이다 */
  score: number | null
  diagnosis: CourseDiagnosis
  /** 교체된 장소 ID. 개선안 열에서만 표시한다 */
  changedPlaceIds?: string[]
  /** 추천하는 쪽. 테두리와 배경으로 한 겹 띄운다 */
  highlighted?: boolean
}) {
  return (
    <div
      className={`overflow-hidden rounded-card bg-surface ${
        highlighted
          ? 'border-quiet-soft shadow-raised border-[1.5px]'
          : 'shadow-rest opacity-85'
      }`}
    >
      <div
        className={`border-line flex items-center justify-between gap-3 border-b px-4.5 py-3.5 ${
          highlighted ? 'bg-quiet-tint/60' : ''
        }`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-fg flex items-center gap-2 text-[15px] font-bold">
            {title}
            {highlighted && (
              <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                추천
              </span>
            )}
          </span>
          <span className="text-hint text-[12.5px]">{subtitle}</span>
        </div>
        <span
          className={`flex-none font-mono text-[26px] leading-none font-semibold ${
            score === null ? 'text-hint' : highlighted ? 'text-quiet-deep' : 'text-crowded-deep'
          }`}
        >
          {/* 점수를 못 매긴 코스는 가운뎃점. 0을 쓰면 "최악"으로 읽힌다 */}
          {score ?? '·'}
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-3.5 py-3.5">
        {Array.from({ length: diagnosis.days }, (_, index) => index + 1).map((day) => {
          const daySlots = diagnosis.slots.filter((slot) => slot.day === day)
          if (daySlots.length === 0) {
            return null
          }
          return (
            <div key={day} className="flex flex-col gap-1.5">
              <span className="text-hint pl-0.5 text-xs font-semibold">
                Day {day} · {formatCompactDate(daySlots[0].visitDate)}
              </span>
              {daySlots.map((slot) => {
                const changed = changedPlaceIds?.includes(slot.place.id) ?? false
                return (
                  <div
                    key={`${slot.day}-${slot.order}`}
                    className={`rounded-ui flex items-center gap-2.5 px-3 py-2.25 ${
                      changed ? 'bg-quiet-tint/60' : 'bg-bg'
                    }`}
                  >
                    {/* 등급이 없으면 색을 고를 수 없다. 뜻 없는 옅은 채움으로 자리만 지킨다 */}
                    <span
                      className={`h-2 w-2 flex-none rounded-full ${
                        slot.level ? LEVEL_SOLID[slot.level] : 'bg-fill'
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-fg truncate text-sm ${
                        changed ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {slot.place.name}
                    </span>
                    {changed && (
                      <span className="bg-brand-tint text-brand-deep flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                        교체
                      </span>
                    )}
                    <span className="ml-auto flex-none">
                      {/* 진단되지 않은 칸은 배지 대신 사유. 빈자리로 두면 불러오는 중으로 읽힌다 */}
                      {slot.level !== null && slot.levelLabel !== null ? (
                        <CongestionBadge
                          level={slot.level}
                          label={slot.levelLabel}
                          quietness={slot.quietness ?? undefined}
                          size="sm"
                        />
                      ) : (
                        <span className="text-hint text-[11.5px]">{slot.gapMessage}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResultPage() {
  const { state } = useTrip()
  const plan = state.plan

  // 원안은 그때의 날짜로 진단해야 한다. 지금 날짜로 계산하면 날짜를 옮겨 얻은 개선이
  // 원안에도 반영돼, 두 경로 중 하나가 통째로 안 보이게 된다.
  const original = useDiagnosis(state.baseline?.plan ?? null, state.baseline?.days ?? null)
  const improved = useDiagnosis(plan, state.days)

  /*
   * 로그인·가입을 마치고 돌아온 경우 시트를 연 채로 시작한다.
   * 그 화면들이 "돌아와 바로 저장할 수 있어요"라고 약속하고 보냈다.
   */
  const location = useLocation()
  const [showSavePrompt, setShowSavePrompt] = useState(
    () => (location.state as { resumeSave?: boolean } | null)?.resumeSave === true,
  )
  /** 지도에 어느 일차를 그릴지. 'all'이면 전체 일정을 한 번에 */
  const [mapDay, setMapDay] = useState<number | 'all'>('all')

  /*
    지도에 그릴 경로. 일차를 고르면 그 하루만 넘긴다.

    CourseMap은 경로가 하나뿐이면 마커 번호를 "1, 2, 3"으로,
    여럿이면 "2-1"처럼 일차를 붙여 매긴다. 그래서 여기서 걸러 넘기는 것만으로
    번호 표기가 알아서 그 날 기준으로 바뀐다.
  */
  const visibleRoutes = useMemo(
    () => (mapDay === 'all' ? state.days : [state.days[mapDay - 1] ?? []]),
    [state.days, mapDay],
  )

  /**
   * 그 날 담긴 곳만 지도에 올린다. 다른 날 장소까지 두면 회색 점이 흩뿌려져
   * "오늘 어디를 도는지"가 오히려 안 보인다.
   *
   * <p>예전에는 대표 관광지 100곳을 따로 받아와 그중에서 골랐다. 그런데
   * <b>검색해서 담은 음식점은 애초에 그 100곳에 없다</b> — 코스에 넣은 피자집이
   * 최종 동선 지도에서 통째로 빠졌다. 담은 장소는 담을 때 이미 알고 있었으므로
   * 기억해 둔 것에서 찾는다. 요청도 하나 줄었다.
   */
  const visiblePlaces = useMemo(() => {
    const known = new Map<string, Place>()
    // 담을 때 기억해 둔 것이 먼저, 진단 응답이 나중이다 — 방금 서버가 준 쪽이 이긴다.
    for (const place of recallPlaces(visibleRoutes.flat())) {
      known.set(place.id, place)
    }
    /*
      진단을 여기서도 보는 것은 <b>의존성 때문이기도 하다.</b> 새로고침 직후에는
      기억해 둔 것이 비어 있고 진단이 도착하면서 채워지는데, 이 계산이 경로에만
      기대고 있으면 그때 다시 돌지 않아 지도가 빈 채로 남는다.
    */
    for (const slot of currentDiagnosis(improved)?.slots ?? []) {
      known.set(slot.place.id, slot.place)
    }
    const ids = new Set(visibleRoutes.flat())
    return [...known.values()].filter((place) => ids.has(place.id))
  }, [visibleRoutes, improved])

  if (!plan) {
    return <Navigate to="/plan" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const beforeDiagnosis = currentDiagnosis(original)
  const afterDiagnosis = currentDiagnosis(improved)
  const ready = beforeDiagnosis !== null && afterDiagnosis !== null

  const changes = ready ? diffCourses(beforeDiagnosis, afterDiagnosis) : []
  /*
    개선폭은 <b>양쪽 총점이 다 있어야</b> 성립한다. 진단된 칸이 하나도 없는 코스는
    총점이 null이라, 한쪽이라도 비면 0으로 두고 아래에서 비교 문구를 그리지 않는다.
  */
  const beforeTotal = ready ? beforeDiagnosis.totalQuietness : null
  const afterTotal = ready ? afterDiagnosis.totalQuietness : null

  /*
    총점을 <b>숫자로 말해도 되는지는 서버가 정한다.</b> 진단된 칸이 둘 미만이거나
    예측 대상 관광지의 절반에 못 미치면 거짓으로 온다.

    ⚠️ 그때도 총점 값 자체는 있다 — <b>저장에 쓰라고 남긴 것</b>이다.
    그래서 아래 저장 버튼은 잠기지 않는다. 잠그는 것은 총점이 아예 없을 때(null)뿐이다.
  */
  const showBefore = ready && beforeDiagnosis.totalPresentable
  const showAfter = ready && afterDiagnosis.totalPresentable

  /*
    <b>양쪽 다 보여줄 수 있을 때만 견준다.</b> 한쪽이라도 근거가 얇으면 그 차이가
    코스가 나아진 것인지 진단된 칸 수가 달라진 것인지 가릴 수 없다 —
    이 화면은 발표에서 가리킬 자리라, 설명할 수 없는 숫자를 세워 둘 수 없다.
  */
  const comparable = showBefore && showAfter && beforeTotal !== null && afterTotal !== null
  const gain = comparable ? afterTotal - beforeTotal : 0

  // 날짜 이동과 장소 교체는 서로 다른 회피 경로다. 무엇을 해서 나아졌는지
  // 구분해 보여줘야 "왜 좋아졌는지"가 화면에 남는다.
  const movedDate =
    state.baseline !== null && state.baseline.plan.startDate !== plan.startDate
      ? { from: state.baseline.plan.startDate, to: plan.startDate }
      : null

  /*
   * 저장 시트의 이름 기본값.
   *
   * 빈칸으로 두면 "이름 짓기"가 저장을 막는 관문이 된다. 지역과 기간으로 무난한 이름을
   * 미리 채워두고, 고치고 싶은 사람만 고치게 한다.
   */
  const defaultCourseName = `${
    regionNameOf(plan.region)
  } ${plan.nights === 0 ? '당일치기' : `${plan.nights}박 ${plan.nights + 1}일`}`.trim()

  const crowdedBefore = beforeDiagnosis
    ? beforeDiagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0
  const crowdedAfter = afterDiagnosis
    ? afterDiagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0

  const summary = [
    movedDate ? '날짜 이동' : null,
    changes.length > 0 ? `장소 ${changes.length}곳 교체` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-fg text-xl font-bold tracking-tight">최종 비교</h1>
        <Link to="/diagnosis" className="text-muted text-[13px] font-medium">
          진단 결과로
        </Link>
      </header>

      {(original.phase === 'error' || improved.phase === 'error') && (
        <p className={`${NOTICE} text-crowded-deep text-sm`}>
          결과를 불러오지 못했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
      )}

      {!ready && <p className="text-[13px]">결과를 계산하는 중…</p>}

      {ready && (
        <>
          {/*
            발표에서 가장 오래 머무를 영역이다. 어두운 면 위에 두 점수만 올려
            주변 정보를 걷어냈다. 개선안 숫자를 더 크게 두는 것은 강조가 아니라
            "이쪽이 결론"이라는 방향 표시다.
          */}
          <section className="bg-fg rounded-card relative flex flex-col gap-5 overflow-hidden px-5 py-7 text-white lg:flex-row lg:items-center lg:gap-11 lg:px-10 lg:py-9">
            {/*
              글로우가 틸 하나뿐인 것은 장식이 아니라 결론이다 — 이 카드가 말하는 것이
              "한적한 쪽으로 옮겨왔다"이고, 틸이 그 방향(브랜드이자 한적)의 색이다.
              홈 갈림길 카드에는 핑크(붐빔)가 함께 있지만, 여기는 이미 도착한 자리라 핑크가 없다.
            */}
            <div
              className="absolute -top-20 -right-22 h-85 w-85 rounded-full bg-[rgb(63_193_201/0.13)]"
              aria-hidden="true"
            />

            <div className="relative flex items-center justify-center gap-6 lg:gap-7">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12.5px] font-medium text-white/50">원안</span>
                <span className="text-crowded-soft font-mono text-[44px] leading-[0.9] font-semibold tracking-[-0.03em] lg:text-[68px]">
                  {showBefore ? beforeDiagnosis.totalQuietness : '·'}
                </span>
                {showBefore && beforeDiagnosis.totalLevel !== null && beforeDiagnosis.totalLevelLabel !== null && (
                  <CongestionBadge
                    level={beforeDiagnosis.totalLevel}
                    label={beforeDiagnosis.totalLevelLabel}
                    size="sm"
                  />
                )}
              </div>

              <ArrowRight size={26} className="mt-3.5 text-white/30" />

              <div className="flex flex-col items-center gap-2">
                <span className="text-[12.5px] font-medium text-white/60">개선안</span>
                <span className="text-quiet-soft font-mono text-[54px] leading-[0.9] font-semibold tracking-[-0.03em] lg:text-[88px]">
                  {showAfter ? afterDiagnosis.totalQuietness : '·'}
                </span>
                {showAfter && afterDiagnosis.totalLevel !== null && afterDiagnosis.totalLevelLabel !== null && (
                  <CongestionBadge
                    level={afterDiagnosis.totalLevel}
                    label={afterDiagnosis.totalLevelLabel}
                    size="sm"
                  />
                )}
              </div>
            </div>

            <div className="relative flex flex-1 flex-col gap-3.5">
              <h2 className="m-0 text-[22px] leading-[1.3] font-bold tracking-[-0.025em] text-pretty lg:text-[28px]">
                {summary.length === 0
                  ? '원안 그대로입니다'
                  : gain > 0
                    ? `${summary.join(' · ')}로 한적 지수가 ${gain} 올랐어요`
                    : `${summary.join(' · ')} · 총점은 ${gain === 0 ? '같아요' : `${Math.abs(gain)} 내려갔어요`}`}
              </h2>
              <p className="m-0 max-w-[440px] text-[14px] leading-[1.7] whitespace-pre-line text-white/60 text-pretty lg:text-[14.5px]">
                {summary.length === 0
                  ? '바꾼 곳이 없어요.\n진단 화면에서 붐비는 장소의 대안을 확인해 보세요.'
                  : `원안대로면 ${crowdedBefore}곳에서 인파와 대기를 만날 가능성이 높았어요.
개선안은 동선과 테마를 유지하면서 붐비는 곳을 ${crowdedAfter}곳으로 줄였습니다.`}
              </p>
              <div className="flex gap-2.5 pt-1">
                {[
                  { label: '지수 변화', value: gain > 0 ? `+${gain}` : `${gain}`, accent: true },
                  { label: '교체한 장소', value: `${changes.length}곳`, accent: false },
                  {
                    label: '붐비는 곳',
                    value: `${crowdedBefore} → ${crowdedAfter}`,
                    accent: false,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-ui flex min-w-0 flex-1 flex-col gap-0.5 bg-white/7 px-3.5 py-3 lg:flex-none lg:min-w-26"
                  >
                    <span className="text-[11.5px] text-white/50">{stat.label}</span>
                    <span
                      className={`font-mono text-[17px] font-semibold lg:text-[19px] ${
                        stat.accent ? 'text-quiet-soft' : 'text-white'
                      }`}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/*
            두 코스를 나란히 놓는다. 폭이 좁으면 위아래로 쌓이는데, 그때도
            원안이 먼저 오도록 순서를 유지해야 "무엇이 어떻게 바뀌었는지"가 읽힌다.
          */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <CourseColumn
              title="원안"
              subtitle="내가 처음 짠 코스"
              score={showBefore ? beforeDiagnosis.totalQuietness : null}
              diagnosis={beforeDiagnosis}
            />
            <CourseColumn
              title="개선안"
              subtitle={
                changes.length > 0 ? `장소 ${changes.length}곳 교체` : '더 한적한 코스'
              }
              score={showAfter ? afterDiagnosis.totalQuietness : null}
              diagnosis={afterDiagnosis}
              changedPlaceIds={changes.map((change) => change.after.place.id)}
              highlighted
            />
          </div>

          {/*
            "무엇을 바꿨나(변경 내역)"와 "그래서 어디를 도나(최종 동선)"를 나란히 놓는다.
            세로로 쌓으면 지도를 보는 동안 바꾼 목록이 화면 밖으로 나가, 둘을 번갈아
            확인하려면 계속 스크롤해야 한다. 발표에서 함께 가리키게 되는 두 장이다.

            변경 내역은 아무것도 안 바꾸면 통째로 사라진다. 그때 지도가 5칸 자리에
            그대로 서 있으면 오른쪽 절반이 빈다 — 지도 폭을 그 유무에 맞춰 정한다.
          */}
          <div className="flex flex-col gap-4.5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4">
          {(movedDate || changes.length > 0) && (
            <section className={`${CARD_RAISED} flex min-w-0 flex-col gap-3.5 p-4.5 lg:col-span-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-fg text-[15px] font-semibold">변경 내역</h2>
                <span className="text-hint text-[12.5px]">
                  더 한적한 쪽으로 바꾼 것들이에요
                </span>
              </div>

              <ul className="flex flex-col gap-2.5">
                {movedDate && (
                  <li className="border-line rounded-[18px] border bg-bg px-4 py-3.5">
                    <p className="text-brand-deep m-0 mb-2 text-xs font-semibold">여행 날짜</p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-muted text-[15px] line-through">
                        {formatKoreanDate(movedDate.from)}
                      </span>
                      <ArrowRight size={15} className="text-line" />
                      <span className="text-fg text-[15px] font-semibold">
                        {formatKoreanDate(movedDate.to)}
                      </span>
                    </div>
                  </li>
                )}

                {changes.map((change) => (
                  <li
                    key={`${change.day}-${change.order}`}
                    className="border-line rounded-[18px] border bg-bg px-4 py-3.5"
                  >
                    {/*
                      자리 표시와 상승폭을 윗줄로 올리고, 장소 이름은 아랫줄에서
                      감싸이게 둔다. 한 줄에 다 넣으면 이름이 긴 관광지 두 개가
                      만났을 때 좁은 화면에서 가로로 넘친다.
                    */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-hint font-mono text-[11.5px] font-semibold">
                        Day {change.day} · {change.order}번째
                      </span>
                      <span className="bg-brand-tint text-brand-deep flex-none rounded-full px-2.5 py-1 text-[12.5px] font-semibold">
                        +{change.after.quietness - change.before.quietness}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.25 w-2.25 flex-none rounded-full ${LEVEL_SOLID[change.before.level]}`}
                          aria-hidden="true"
                        />
                        {/* 바뀌기 전 장소는 취소선으로 흐리게 — 무엇이 빠졌는지 한눈에 보이게 */}
                        <span className="text-muted text-[15px] line-through">
                          {change.before.place.name}
                        </span>
                        <span className="text-crowded-deep flex-none font-mono text-xs">
                          {change.before.quietness}
                        </span>
                      </span>

                      <ArrowRight size={15} className="text-line flex-none" />

                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.25 w-2.25 flex-none rounded-full ${LEVEL_SOLID[change.after.level]}`}
                          aria-hidden="true"
                        />
                        <span className="text-fg text-[15px] font-semibold">
                          {change.after.place.name}
                        </span>
                        <span className="text-brand-deep flex-none font-mono text-xs font-semibold">
                          {change.after.quietness}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className={`${CARD_RAISED} min-w-0 ${
              movedDate || changes.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4.5 pt-4 pb-3">
              <h2 className="text-fg text-[15px] font-semibold">최종 동선</h2>

              {/*
                하루짜리 일정에는 고를 것이 없다. 탭이 하나뿐이면 누를 수 있다는
                신호만 주고 아무것도 바뀌지 않아 오히려 헷갈린다.
              */}
              {state.days.length > 1 && (
                <div className="flex gap-1.5" role="group" aria-label="지도에 표시할 일차">
                  {(['all', ...state.days.map((_, index) => index + 1)] as const).map(
                    (tab) => {
                      const active = tab === mapDay
                      return (
                        <button
                          key={tab}
                          type="button"
                          className={`rounded-chip h-8 cursor-pointer px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                            active ? 'bg-fg text-white' : 'bg-bg text-hint hover:text-fg'
                          }`}
                          aria-pressed={active}
                          onClick={() => setMapDay(tab)}
                        >
                          {tab === 'all' ? '전체' : `Day ${tab}`}
                        </button>
                      )
                    },
                  )}
                </div>
              )}
            </div>

            {/*
              지도는 자기 모서리와 테두리를 그대로 들고 카드 안에 들어앉는다.
              카드 모서리에 맞춰 깎으려면 지도 쪽 클래스를 덮어써야 하는데,
              같은 속성(border-radius)을 두 클래스가 다투게 되어 순서에 따라 결과가 갈린다.
            */}
            <div className="px-4.5 pb-4">
              {/* 읽기 전용. onSelect를 넘기지 않으면 마커를 누를 수 없다. */}
              <CourseMap
                places={visiblePlaces}
                routes={visibleRoutes}
                className="lg:h-[380px]"
              />
            </div>

            {state.days.length > 1 && (
              <p className="text-hint m-0 px-4.5 pb-4 text-[12.5px] whitespace-pre-line">
                {mapDay === 'all'
                  ? '마커 번호는 “일차-순서”예요.\n일차를 고르면 그 날만 볼 수 있어요.'
                  : `Day ${mapDay}에 담은 ${visibleRoutes[0].length}곳만 순서대로 보여주고 있어요.`}
              </p>
            )}
          </section>
          </div>

          {/*
            버튼 문구는 그 버튼이 실제로 하는 일만 말한다.

            앞서 쓰던 "원안 유지"는 되돌리는 동작을 약속하는 이름인데, 실제로는 진단 화면으로
            돌아가기만 했다. 교체한 장소가 그대로 남아 있으니 이름이 거짓말을 한 셈이다.
            "개선안으로 저장하기"도 마찬가지로, 아무것도 안 바꾼 코스까지 개선안이라고 불렀다.

            두 버튼 다 무엇을 바꿨는지와 무관하게 뜻이 같으므로 문구를 고정한다.
          */}
          {/*
            나가는 길이 셋이다. 무게를 다르게 준다.

            돌아가기·저장하기는 한 줄에 두고, "홈으로"는 그 아래 조용한 버튼으로 둔다.
            셋을 같은 굵기로 늘어놓으면 어느 것이 이 화면의 결론인지가 사라진다.

            홈으로가 필요한 이유: 진단만 보고 <b>저장도 수정도 하지 않을</b> 사람이 있다.
            그때 이 화면에서 나갈 길이 "진단으로 되돌아가기"뿐이면 막다른 길이 된다.
            게스트가 로그인 없이 서비스 전체를 한 바퀴 도는 흐름의 마지막 문이다.
          */}
          <section className="flex flex-col items-center gap-2.5 pb-2">
            {/* 넓은 화면에서 버튼을 1180px까지 늘리지 않는다. 누르는 자리가 넓다고 잘 눌리지 않는다 */}
            <div className="flex w-full gap-2.5 lg:mx-auto lg:max-w-read">
              {/*
                DOM 순서가 곧 화면 순서다(왼쪽 돌아가기, 오른쪽 저장하기).
                앞서 쓰던 flex-row-reverse는 좁은 화면에서 세로로 쌓을 때 저장하기를
                위로 올리려던 장치인데, 이제 항상 한 줄이라 순서를 뒤집을 이유가 없다.
                뒤집힌 채로 두면 키보드로 훑는 차례와 눈에 보이는 차례가 어긋난다.
              */}
              <Link
                to="/diagnosis"
                className={`${SECONDARY_BUTTON} grid flex-none place-items-center px-5.5 no-underline`}
              >
                돌아가기
              </Link>
              {/*
                이 화면의 결론. 남는 폭을 다 가져가 가장 크게 선다.

                <b>총점이 없으면 저장할 수 없다.</b> 저장은 그때의 점수를 스냅샷으로 함께
                남기는 일인데, 남길 점수가 없으면 나중에 열어도 비교할 것이 없다.
                버튼을 눌러 보고 실패하게 두는 대신 미리 잠그고 <b>이유를 옆에 적는다</b> —
                잠긴 채 아무 말 없는 버튼은 고장으로 읽힌다.

                ⚠️ <b>잠그는 것은 점수가 아예 없을 때(null)뿐이다.</b> 근거가 얇아 화면에
                숫자를 안 띄우는 코스(totalPresentable=false)는 저장할 수 있다 —
                그때는 점수와 함께 <b>모수</b>를 남겨서, 나중에 열었을 때
                "관광지 5곳 중 2곳 기준"이라고 정직하게 말한다. 숫자를 감추는 것과
                저장을 막는 것은 다른 일이고, 묶어 두면 경주 코스의 41.7%가 저장 불가가 된다.
              */}
              <button
                type="button"
                className={`${PRIMARY_BUTTON} flex-1 disabled:cursor-not-allowed disabled:opacity-45`}
                onClick={() => setShowSavePrompt(true)}
              >
                저장하기
              </button>
            </div>

            {/*
              <b>점수가 없어도 저장을 막지 않는다.</b> 예전에는 버튼을 잠갔는데, 그러면
              여행일이 예측 창 밖이라 <b>아직</b> 진단되지 않은 코스를 짜 둘 수가 없었다 —
              미리 계획해 두고 여행이 가까워지면 다시 진단하는 흐름이 통째로 막힌다.

              저장은 <b>재료</b>(지역·날짜·장소·순서)를 남기는 일이고, 점수 스냅샷은 있으면
              함께 남기는 것이다. 없는 채로 저장된 코스는 마이페이지에서 "아직 진단 전"으로 선다.

              대신 무엇이 빠진 채 저장되는지는 말해 준다. 아무 말 없이 저장하면
              나중에 열었을 때 점수가 왜 비어 있는지 알 수 없다.
            */}
            {afterTotal === null && (
              <p className="text-hint m-0 text-center text-[12.5px] leading-[1.6]">
                아직 예상 혼잡을 매기지 못한 코스예요.
                <br />
                저장은 되고, 나중에 열어 다시 진단할 수 있어요.
              </p>
            )}

            {/*
              테두리도 배경도 없는 조용한 버튼. 그래도 높이는 넉넉히 준다 —
              눈에 덜 띄어야 하는 것과 누르기 어려워야 하는 것은 다른 이야기다.
            */}
            <Link
              to="/"
              className="text-hint hover:bg-surface hover:text-fg rounded-ui grid min-h-11 w-full place-items-center text-[14px] font-medium no-underline transition-colors lg:mx-auto lg:max-w-read"
            >
              홈으로
            </Link>
          </section>

          {/*
            저장은 화면을 옮기지 않고 시트로 묻는다. 결과를 보다가 곁들이는 행동이라,
            뒤에 비교 결과가 비쳐 보이는 편이 맥락을 유지해준다.
          */}
          {showSavePrompt && (
            <SaveCourseSheet
              defaultName={defaultCourseName}
              onClose={() => setShowSavePrompt(false)}
              onSave={async (name) => {
                await saveCourse({
                  name,
                  region: plan.region,
                  startDate: plan.startDate,
                  nights: plan.nights,
                  /*
                    방금 진단에서 받은 총점을 그대로 싣는다. 서버가 다시 계산하지 않는다.
                    총점이 없으면 저장 버튼이 잠겨 있어 여기까지 오지 않는다.

                    <b>모수를 함께 남긴다.</b> 점수만 남기면 나중에 열었을 때 관광지 다섯 곳 중
                    하나만 진단된 코스인지 다섯이 다 진단된 코스인지 구분할 수 없다.
                  */
                  /*
                    <b>0으로 채우지 않는다.</b> 0은 화면에서 "매우 붐빔"으로 읽혀,
                    재보지도 않은 코스를 최악이라고 말하게 된다. 서버도 null을 받는다.
                  */
                  totalQuietness: afterTotal,
                  diagnosedCount: afterDiagnosis.diagnosedCount,
                  forecastTargetCount: afterDiagnosis.forecastTargetCount,
                  slots: toSlots(state.days),
                })
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
