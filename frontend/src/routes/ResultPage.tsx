import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { GuestSaveSheet } from '../components/GuestSaveSheet'
import { LEVEL_SOLID } from '../components/levelStyles'
import {
  CARD_RAISED,
  NOTICE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from '../components/styles'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchPlaces } from '../services/api'
import { saveCourseToDevice } from '../state/savedCourse'
import { useTrip } from '../state/tripContext'
import type { CourseDiagnosis, DiagnosedSlot, Place } from '../types/api'
import { formatCompactDate, formatKoreanDate } from '../utils/date'

interface Change {
  day: number
  order: number
  before: DiagnosedSlot
  after: DiagnosedSlot
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
  score: number
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
            highlighted ? 'text-quiet-deep' : 'text-crowded-deep'
          }`}
        >
          {score}
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
                    <span
                      className={`h-2 w-2 flex-none rounded-full ${LEVEL_SOLID[slot.level]}`}
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
                      <CongestionBadge
                        level={slot.level}
                        label={slot.levelLabel}
                        quietness={slot.quietness}
                        size="sm"
                      />
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

  const [places, setPlaces] = useState<Place[]>([])
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  /** 지도에 어느 일차를 그릴지. 'all'이면 전체 일정을 한 번에 */
  const [mapDay, setMapDay] = useState<number | 'all'>('all')

  const region = plan?.region

  useEffect(() => {
    if (!region) {
      return
    }
    const controller = new AbortController()
    // 지도에 좌표가 필요하다. 실패해도 비교 내용은 그대로 보여준다.
    fetchPlaces(region, controller.signal)
      .then(setPlaces)
      .catch(() => setPlaces([]))
    return () => controller.abort()
  }, [region])

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

  // 그 날 담긴 곳만 지도에 올린다. 다른 날 장소까지 두면 회색 점이 흩뿌려져
  // "오늘 어디를 도는지"가 오히려 안 보인다.
  const visiblePlaces = useMemo(() => {
    const ids = new Set(visibleRoutes.flat())
    return places.filter((place) => ids.has(place.id))
  }, [places, visibleRoutes])

  if (!plan) {
    return <Navigate to="/plan" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const beforeDiagnosis = original.phase === 'loaded' ? original.diagnosis : null
  const afterDiagnosis = improved.phase === 'loaded' ? improved.diagnosis : null
  const ready = beforeDiagnosis !== null && afterDiagnosis !== null

  const changes = ready ? diffCourses(beforeDiagnosis, afterDiagnosis) : []
  const gain = ready ? afterDiagnosis.totalQuietness - beforeDiagnosis.totalQuietness : 0

  // 날짜 이동과 장소 교체는 서로 다른 회피 경로다. 무엇을 해서 나아졌는지
  // 구분해 보여줘야 "왜 좋아졌는지"가 화면에 남는다.
  const movedDate =
    state.baseline !== null && state.baseline.plan.startDate !== plan.startDate
      ? { from: state.baseline.plan.startDate, to: plan.startDate }
      : null

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
          결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
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
            <div
              className="absolute -top-20 -right-22 h-85 w-85 rounded-full bg-[rgb(14_124_134/0.28)]"
              aria-hidden="true"
            />

            <div className="relative flex items-center justify-center gap-6 lg:gap-7">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[12.5px] font-medium text-white/50">원안</span>
                <span className="text-crowded-soft font-mono text-[44px] leading-[0.9] font-semibold tracking-[-0.03em] lg:text-[68px]">
                  {beforeDiagnosis.totalQuietness}
                </span>
                <CongestionBadge
                  level={beforeDiagnosis.totalLevel}
                  label={beforeDiagnosis.totalLevelLabel}
                  size="sm"
                />
              </div>

              <span className="mt-3.5 text-[26px] leading-none text-white/30" aria-hidden="true">
                →
              </span>

              <div className="flex flex-col items-center gap-2">
                <span className="text-[12.5px] font-medium text-white/60">개선안</span>
                <span className="text-quiet-soft font-mono text-[54px] leading-[0.9] font-semibold tracking-[-0.03em] lg:text-[88px]">
                  {afterDiagnosis.totalQuietness}
                </span>
                <CongestionBadge
                  level={afterDiagnosis.totalLevel}
                  label={afterDiagnosis.totalLevelLabel}
                  size="sm"
                />
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
              <p className="m-0 max-w-[440px] text-[14px] leading-[1.7] text-white/60 text-pretty lg:text-[14.5px]">
                {summary.length === 0
                  ? '바꾼 곳이 없어요. 진단 화면에서 붐비는 장소의 대안을 확인해 보세요.'
                  : `원안대로면 ${crowdedBefore}곳에서 인파와 대기를 만날 가능성이 높았어요. 개선안은 동선과 테마를 유지하면서 붐비는 곳을 ${crowdedAfter}곳으로 줄였습니다.`}
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
              score={beforeDiagnosis.totalQuietness}
              diagnosis={beforeDiagnosis}
            />
            <CourseColumn
              title="개선안"
              subtitle={
                changes.length > 0 ? `장소 ${changes.length}곳 교체` : '더 한적한 코스'
              }
              score={afterDiagnosis.totalQuietness}
              diagnosis={afterDiagnosis}
              changedPlaceIds={changes.map((change) => change.after.place.id)}
              highlighted
            />
          </div>

          {(movedDate || changes.length > 0) && (
            <section className={`${CARD_RAISED} flex flex-col gap-3.5 p-4.5`}>
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
                      <span className="text-line text-[15px]" aria-hidden="true">
                        →
                      </span>
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

                      <span className="text-line flex-none text-[15px]" aria-hidden="true">
                        →
                      </span>

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

          <section className={CARD_RAISED}>
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
              <p className="text-hint m-0 px-4.5 pb-4 text-[12.5px]">
                {mapDay === 'all'
                  ? '마커 번호는 “일차-순서”예요. 일차를 고르면 그 날만 볼 수 있어요.'
                  : `Day ${mapDay}에 담은 ${visibleRoutes[0].length}곳만 순서대로 보여주고 있어요.`}
              </p>
            )}
          </section>

          <section className="flex flex-col items-center gap-3 pb-2">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row-reverse">
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={() => setShowSavePrompt(true)}
              >
                개선안으로 코스 저장하기
              </button>
              <Link
                to="/diagnosis"
                className={`${SECONDARY_BUTTON} grid flex-none place-items-center px-5.5 no-underline sm:w-auto`}
              >
                원안 유지
              </Link>
            </div>
          </section>

          {/*
            저장은 화면을 옮기지 않고 시트로 묻는다. 결과를 보다가 곁들이는 행동이라,
            뒤에 비교 결과가 비쳐 보이는 편이 맥락을 유지해준다.
          */}
          {showSavePrompt && (
            <GuestSaveSheet
              onClose={() => setShowSavePrompt(false)}
              onSaveToDevice={() => saveCourseToDevice(plan, state.days)}
            />
          )}
        </>
      )}
    </div>
  )
}
