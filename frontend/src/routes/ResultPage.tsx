import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchPlaces } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { CourseDiagnosis, DiagnosedSlot, Place } from '../types/api'
import { formatKoreanDate } from '../utils/date'
import './ResultPage.css'

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
      return {
        day: afterSlot.day,
        order: afterSlot.order,
        before: beforeSlot,
        after: afterSlot,
      }
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
    <div className="result">
      <header className="result-head">
        <h1 className="result-title">최종 코스</h1>
        <p className="result-sub">
          {formatKoreanDate(plan.startDate)}부터 {plan.nights}박 {plan.nights + 1}일 ·{' '}
          {afterDiagnosis?.regionName ?? ''}
        </p>
      </header>

      {(original.phase === 'error' || improved.phase === 'error') && (
        <p className="result-error">결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      )}

      {!ready && <p className="muted">결과를 계산하는 중…</p>}

      {ready && (
        <>
          {/* --- 원안 vs 개선안 -------------------------------------- */}
          <section className="compare">
            <div className="compare-side">
              <p className="compare-label">원안</p>
              <p className="compare-score compare-score--before">
                {beforeDiagnosis.totalQuietness}
              </p>
              <CongestionBadge
                level={beforeDiagnosis.totalLevel}
                label={beforeDiagnosis.totalLevelLabel}
                size="sm"
              />
            </div>

            <div className="compare-arrow" aria-hidden="true">
              →
            </div>

            <div className="compare-side">
              <p className="compare-label">개선안</p>
              <p className="compare-score compare-score--after">
                {afterDiagnosis.totalQuietness}
              </p>
              <CongestionBadge
                level={afterDiagnosis.totalLevel}
                label={afterDiagnosis.totalLevelLabel}
                size="sm"
              />
            </div>
          </section>

          <p className={`gain ${gain > 0 ? 'gain--up' : ''}`}>
            {gain > 0 && (
              <>
                한적도 <strong>{gain} 상승</strong> · 장소 {changes.length}곳 교체
              </>
            )}
            {gain === 0 && changes.length === 0 && '원안 그대로입니다. 바꾼 곳이 없어요.'}
            {gain === 0 && changes.length > 0 && `장소 ${changes.length}곳을 바꿨지만 총점은 같아요.`}
            {gain < 0 && `한적도 ${Math.abs(gain)} 하락 · 장소 ${changes.length}곳 교체`}
          </p>

          {/* --- 변경 내역 --------------------------------------------- */}
          {changes.length > 0 && (
            <section>
              <h2 className="section-title">바뀐 곳</h2>
              <ul className="change-list">
                {changes.map((change) => (
                  <li key={`${change.day}-${change.order}`} className="change">
                    <p className="change-where">
                      Day {change.day} · {change.order}번째
                    </p>
                    <div className="change-row">
                      <span className="change-name change-name--before">
                        {change.before.place.name}
                      </span>
                      <CongestionBadge
                        level={change.before.level}
                        label={change.before.levelLabel}
                        quietness={change.before.quietness}
                        size="sm"
                      />
                    </div>
                    <div className="change-row">
                      <span className="change-arrow" aria-hidden="true">
                        ↓
                      </span>
                      <span className="change-name">{change.after.place.name}</span>
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

          {/* --- 최종 지도 --------------------------------------------- */}
          <section>
            <h2 className="section-title">최종 동선</h2>
            {/* 읽기 전용. onSelect를 넘기지 않으면 마커를 누를 수 없다. */}
            <CourseMap places={coursePlaces} routes={state.days} />
            {state.days.length > 1 && (
              <p className="muted map-note">마커의 번호는 “일차-순서”예요.</p>
            )}
          </section>

          {/* --- 일정 --------------------------------------------------- */}
          {Array.from({ length: afterDiagnosis.days }, (_, index) => index + 1).map((day) => {
            const daySlots = afterDiagnosis.slots.filter((slot) => slot.day === day)
            if (daySlots.length === 0) {
              return null
            }
            return (
              <section key={day}>
                <h2 className="section-title">
                  Day {day}
                  <span className="day-date">{formatKoreanDate(daySlots[0].visitDate)}</span>
                </h2>
                <ol className="final-list">
                  {daySlots.map((slot) => (
                    <li key={`${slot.day}-${slot.order}`} className="final-item">
                      <span className="final-order">{slot.order}</span>
                      <span className="final-name">{slot.place.name}</span>
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

          {/* --- 저장 --------------------------------------------------- */}
          <section className="save">
            {!showSavePrompt ? (
              <button
                type="button"
                className="submit"
                onClick={() => setShowSavePrompt(true)}
              >
                코스 저장하기
              </button>
            ) : (
              <div className="save-prompt">
                <p className="save-text">
                  코스를 저장하면 나중에 다시 열어보고, 다른 코스와 비교할 수 있어요.
                  저장에는 로그인이 필요합니다.
                </p>
                <div className="save-actions">
                  <Link to="/login" className="save-login">
                    로그인하고 저장하기
                  </Link>
                  <button
                    type="button"
                    className="save-dismiss"
                    onClick={() => setShowSavePrompt(false)}
                  >
                    나중에 하기
                  </button>
                </div>
              </div>
            )}

            <Link to="/diagnosis" className="back-link">
              진단 화면으로 돌아가기
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
