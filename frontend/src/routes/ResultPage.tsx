import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { CARD, NOTICE, PRIMARY_BUTTON } from '../components/styles'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchPlaces } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { CourseDiagnosis, DiagnosedSlot, Place } from '../types/api'
import { formatKoreanDate } from '../utils/date'

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

export function ResultPage() {
  const { state } = useTrip()
  const plan = state.plan

  const original = useDiagnosis(plan, state.baselineDays)
  const improved = useDiagnosis(plan, state.days)

  const [places, setPlaces] = useState<Place[]>([])
  const [showSavePrompt, setShowSavePrompt] = useState(false)

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

  const coursePlaces = useMemo(() => {
    const ids = new Set(state.days.flat())
    return places.filter((place) => ids.has(place.id))
  }, [places, state.days])

  if (!plan) {
    return <Navigate to="/" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const beforeDiagnosis = original.phase === 'loaded' ? original.diagnosis : null
  const afterDiagnosis = improved.phase === 'loaded' ? improved.diagnosis : null
  const ready = beforeDiagnosis !== null && afterDiagnosis !== null

  const changes = ready ? diffCourses(beforeDiagnosis, afterDiagnosis) : []
  const gain = ready ? afterDiagnosis.totalQuietness - beforeDiagnosis.totalQuietness : 0

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-fg text-xl font-semibold tracking-tight">최종 코스</h1>
        <p className="mt-1 text-[13px]">
          {formatKoreanDate(plan.startDate)}부터 {plan.nights}박 {plan.nights + 1}일 ·{' '}
          {afterDiagnosis?.regionName ?? ''}
        </p>
      </header>

      {(original.phase === 'error' || improved.phase === 'error') && (
        <p className={`${NOTICE} text-danger text-sm`}>
          결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {!ready && <p className="text-[13px]">결과를 계산하는 중…</p>}

      {ready && (
        <>
          {/*
            발표에서 가장 오래 머무를 영역이다. 두 점수를 같은 크기로 나란히 놓고
            색으로만 방향을 알린다. 크기를 다르게 하면 비교가 아니라 주장이 된다.
          */}
          <section className="bg-surface rounded-card grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold">원안</p>
              <p className="text-muted text-[44px] leading-none font-extrabold tracking-[-2px]">
                {beforeDiagnosis.totalQuietness}
              </p>
              <CongestionBadge
                level={beforeDiagnosis.totalLevel}
                label={beforeDiagnosis.totalLevelLabel}
                size="sm"
              />
            </div>

            <div className="text-muted text-[22px]" aria-hidden="true">
              →
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold">개선안</p>
              <p className="text-quiet text-[44px] leading-none font-extrabold tracking-[-2px]">
                {afterDiagnosis.totalQuietness}
              </p>
              <CongestionBadge
                level={afterDiagnosis.totalLevel}
                label={afterDiagnosis.totalLevelLabel}
                size="sm"
              />
            </div>
          </section>

          <p className="text-center text-[15px]">
            {gain > 0 && (
              <>
                한적도 <strong className="text-quiet text-lg">{gain} 상승</strong> · 장소{' '}
                {changes.length}곳 교체
              </>
            )}
            {gain === 0 && changes.length === 0 && '원안 그대로입니다. 바꾼 곳이 없어요.'}
            {gain === 0 &&
              changes.length > 0 &&
              `장소 ${changes.length}곳을 바꿨지만 총점은 같아요.`}
            {gain < 0 && `한적도 ${Math.abs(gain)} 하락 · 장소 ${changes.length}곳 교체`}
          </p>

          {changes.length > 0 && (
            <section>
              <h2 className="text-fg mb-2 text-[15px] font-semibold">바뀐 곳</h2>
              <ul className="flex flex-col gap-2">
                {changes.map((change) => (
                  <li key={`${change.day}-${change.order}`} className={`${CARD} p-3`}>
                    <p className="text-brand-strong mb-2 text-xs font-semibold">
                      Day {change.day} · {change.order}번째
                    </p>
                    <div className="flex items-center gap-2 py-1">
                      {/* 바뀌기 전 장소는 취소선으로 흐리게 — 무엇이 빠졌는지 한눈에 보이게 */}
                      <span className="text-muted flex-1 text-[15px] line-through">
                        {change.before.place.name}
                      </span>
                      <CongestionBadge
                        level={change.before.level}
                        label={change.before.levelLabel}
                        quietness={change.before.quietness}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-muted text-[13px]" aria-hidden="true">
                        ↓
                      </span>
                      <span className="text-fg flex-1 text-[15px]">
                        {change.after.place.name}
                      </span>
                      <CongestionBadge
                        level={change.after.level}
                        label={change.after.levelLabel}
                        quietness={change.after.quietness}
                        size="sm"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-fg mb-2 text-[15px] font-semibold">최종 동선</h2>
            {/* 읽기 전용. onSelect를 넘기지 않으면 마커를 누를 수 없다. */}
            <CourseMap places={coursePlaces} routes={state.days} />
            {state.days.length > 1 && (
              <p className="mt-2 text-[13px]">마커의 번호는 “일차-순서”예요.</p>
            )}
          </section>

          {Array.from({ length: afterDiagnosis.days }, (_, index) => index + 1).map((day) => {
            const daySlots = afterDiagnosis.slots.filter((slot) => slot.day === day)
            if (daySlots.length === 0) {
              return null
            }
            return (
              <section key={day}>
                <h2 className="text-fg mb-2 flex items-baseline gap-2 text-[15px] font-semibold">
                  Day {day}
                  <span className="text-muted text-xs font-normal">
                    {formatKoreanDate(daySlots[0].visitDate)}
                  </span>
                </h2>
                <ol className="flex flex-col gap-2">
                  {daySlots.map((slot) => (
                    <li
                      key={`${slot.day}-${slot.order}`}
                      className={`${CARD} flex items-center gap-3 p-3`}
                    >
                      <span className="bg-brand-strong grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-bold text-white">
                        {slot.order}
                      </span>
                      <span className="text-fg flex-1 text-[15px]">{slot.place.name}</span>
                      <CongestionBadge
                        level={slot.level}
                        label={slot.levelLabel}
                        quietness={slot.quietness}
                        size="sm"
                      />
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}

          <section className="flex flex-col items-center gap-3">
            {!showSavePrompt ? (
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={() => setShowSavePrompt(true)}
              >
                코스 저장하기
              </button>
            ) : (
              <div className="bg-surface rounded-card w-full p-4">
                <p className="mb-3 text-sm leading-relaxed">
                  코스를 저장하면 나중에 다시 열어보고, 다른 코스와 비교할 수 있어요. 저장에는
                  로그인이 필요합니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/login"
                    className="bg-brand-strong rounded-card grid min-h-11 flex-auto place-items-center text-sm font-semibold text-white no-underline"
                  >
                    로그인하고 저장하기
                  </Link>
                  <button
                    type="button"
                    className="border-line bg-bg text-muted rounded-card min-h-11 flex-auto cursor-pointer border text-sm"
                    onClick={() => setShowSavePrompt(false)}
                  >
                    나중에 하기
                  </button>
                </div>
              </div>
            )}

            <Link to="/diagnosis" className="text-muted text-[13px]">
              진단 화면으로 돌아가기
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
