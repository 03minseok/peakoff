import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchDateAlternatives } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { DateAlternatives } from '../types/api'
import { formatKoreanDate } from '../utils/date'
import './DiagnosisPage.css'

/** 며칠 앞까지 더 한적한 날짜를 찾아볼지 */
const DATE_SEARCH_RANGE = 14

interface SheetTarget {
  day: number
  index: number
  placeId: string
  placeName: string
  visitDate: string
}

export function DiagnosisPage() {
  const navigate = useNavigate()
  const { state, replacePlace, markBaseline } = useTrip()
  const plan = state.plan

  const [dates, setDates] = useState<DateAlternatives | null>(null)
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  // 주소로 바로 들어온 경우 원안이 비어 있다. 지금 코스를 원안으로 삼는다.
  useEffect(() => {
    if (plan && state.days.length > 0 && state.baselineDays === null) {
      markBaseline()
    }
  }, [plan, state.days, state.baselineDays, markBaseline])

  const current = useDiagnosis(plan, state.days)
  const baseline = useDiagnosis(plan, state.baselineDays)

  const uniquePlaceIds = useMemo(
    () => Array.from(new Set(state.days.flat())),
    [state.days],
  )

  useEffect(() => {
    if (!plan || uniquePlaceIds.length === 0) {
      return
    }
    const controller = new AbortController()

    fetchDateAlternatives(uniquePlaceIds, plan.startDate, DATE_SEARCH_RANGE, controller.signal)
      .then(setDates)
      // 날짜 제안은 곁들이는 정보다. 실패해도 진단 결과까지 막지 않는다.
      .catch(() => setDates(null))

    return () => controller.abort()
  }, [plan, uniquePlaceIds])

  if (!plan) {
    return <Navigate to="/" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const diagnosis = current.phase === 'loaded' ? current.diagnosis : null
  const baselineTotal =
    baseline.phase === 'loaded' ? baseline.diagnosis.totalQuietness : null
  const improvement =
    diagnosis && baselineTotal !== null ? diagnosis.totalQuietness - baselineTotal : 0

  function handleSelectAlternative(placeId: string) {
    if (!sheet) {
      return
    }
    replacePlace(sheet.day, sheet.index, placeId)
    setSheet(null)
    // days가 바뀌면 useDiagnosis가 다시 돌아 자동으로 재진단된다.
  }

  return (
    <div className="diag">
      <header className="diag-head">
        <h1 className="diag-title">코스 진단</h1>
        <Link to="/course" className="diag-edit">
          코스 고치기
        </Link>
      </header>

      {current.phase === 'error' && <p className="diag-error">{current.message}</p>}

      {diagnosis && (
        <>
          <section className="score" aria-live="polite">
            <p className="score-label">코스 총점</p>
            <p className="score-value">
              {diagnosis.totalQuietness}
              <span className="score-unit">/100</span>
            </p>
            <CongestionBadge
              level={diagnosis.totalLevel}
              label={diagnosis.totalLevelLabel}
            />

            {improvement !== 0 && baselineTotal !== null && (
              <p className={`score-delta ${improvement > 0 ? 'score-delta--up' : ''}`}>
                원안 {baselineTotal} → 지금 {diagnosis.totalQuietness}
                <strong>
                  {improvement > 0 ? ` (+${improvement} 더 한적)` : ` (${improvement})`}
                </strong>
              </p>
            )}
            {current.phase === 'loading' && <p className="score-updating">다시 계산 중…</p>}
          </section>

          <section className="dates">
            <h2 className="section-title">더 한적한 날짜</h2>
            {!dates && <p className="muted">날짜 정보를 불러오지 못했어요.</p>}
            {dates?.alreadyQuietest && (
              <p className="muted">
                고르신 {formatKoreanDate(dates.selectedDate)}이 이 코스에서 가장 한적한 날이에요.
              </p>
            )}
            {dates && !dates.alreadyQuietest && (
              <>
                <ul className="date-list">
                  {dates.options.map((option) => (
                    <li key={option.date} className="date-item">
                      <span className="date-when">{formatKoreanDate(option.date)}</span>
                      <CongestionBadge
                        level={option.level}
                        label={option.levelLabel}
                        quietness={option.quietness}
                        size="sm"
                      />
                      <span className="date-gain">+{option.improvement}</span>
                    </li>
                  ))}
                </ul>
                <p className="muted date-note">
                  날짜를 바꾸려면 <Link to="/">여행 조건</Link>에서 다시 골라주세요.
                </p>
              </>
            )}
          </section>

          {Array.from({ length: diagnosis.days }, (_, index) => index + 1).map((day) => {
            const daySlots = diagnosis.slots.filter((slot) => slot.day === day)
            if (daySlots.length === 0) {
              return null
            }
            return (
              <section key={day} className="day-block">
                <h2 className="section-title">
                  Day {day}
                  <span className="day-date">{formatKoreanDate(daySlots[0].visitDate)}</span>
                </h2>

                <ol className="card-list">
                  {daySlots.map((slot) => (
                    <li key={`${slot.day}-${slot.order}`} className="card">
                      <span className="card-order">{slot.order}</span>
                      <div className="card-body">
                        <p className="card-name">{slot.place.name}</p>
                        <p className="card-category">{slot.place.categoryName}</p>
                      </div>
                      <div className="card-side">
                        <CongestionBadge
                          level={slot.level}
                          label={slot.levelLabel}
                          quietness={slot.quietness}
                          size="sm"
                        />
                        {slot.level === 'CROWDED' && (
                          <button
                            type="button"
                            className="alt-button"
                            onClick={() =>
                              setSheet({
                                day: slot.day,
                                index: slot.order - 1,
                                placeId: slot.place.id,
                                placeName: slot.place.name,
                                visitDate: slot.visitDate,
                              })
                            }
                          >
                            대안 보기
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}

          <div className="diag-footer">
            <button type="button" className="submit" onClick={() => navigate('/result')}>
              최종 코스 확인하기
            </button>
          </div>
        </>
      )}

      {!diagnosis && current.phase === 'loading' && <p className="muted">진단하는 중…</p>}

      {sheet && (
        <AlternativeSheet
          originName={sheet.placeName}
          originPlaceId={sheet.placeId}
          visitDate={sheet.visitDate}
          excludePlaceIds={state.days[sheet.day - 1] ?? []}
          onClose={() => setSheet(null)}
          onSelect={handleSelectAlternative}
        />
      )}
    </div>
  )
}
