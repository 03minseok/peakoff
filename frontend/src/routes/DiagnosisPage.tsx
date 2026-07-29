import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { ApiRequestError, diagnoseCourse, fetchDateAlternatives } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { CourseDiagnosis, CourseSlotRequest, DateAlternatives } from '../types/api'
import { formatKoreanDate } from '../utils/date'
import './DiagnosisPage.css'

/** 며칠 앞까지 더 한적한 날짜를 찾아볼지 */
const DATE_SEARCH_RANGE = 14

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded' }
  | { phase: 'error'; message: string }

/** days[일차][순서] 구조를 서버가 받는 평평한 슬롯 목록으로 편다. */
function toSlots(days: string[][]): CourseSlotRequest[] {
  return days.flatMap((placeIds, dayIndex) =>
    placeIds.map((placeId, orderIndex) => ({
      day: dayIndex + 1,
      order: orderIndex + 1,
      placeId,
    })),
  )
}

interface SheetTarget {
  day: number
  index: number
  placeId: string
  placeName: string
  visitDate: string
}

export function DiagnosisPage() {
  const { state, replacePlace } = useTrip()
  const plan = state.plan

  const [diagnosis, setDiagnosis] = useState<CourseDiagnosis | null>(null)
  const [dates, setDates] = useState<DateAlternatives | null>(null)
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  /*
   * 원안 총점. 이 화면에 처음 들어왔을 때의 점수를 기억해 두고,
   * 교체로 얼마나 나아졌는지 비교한다.
   *
   * 코스를 다시 편집하고 돌아오면 그 코스가 새 기준이 된다. 그게 맞다 —
   * "원안"은 사용자가 진단에 들고 온 코스를 뜻한다.
   */
  const baselineRef = useRef<number | null>(null)

  const slots = useMemo(() => toSlots(state.days), [state.days])
  const uniquePlaceIds = useMemo(
    () => Array.from(new Set(slots.map((slot) => slot.placeId))),
    [slots],
  )

  useEffect(() => {
    if (!plan || slots.length === 0) {
      return
    }
    const controller = new AbortController()
    setLoad({ phase: 'loading' })

    Promise.all([
      diagnoseCourse(
        {
          region: plan.region,
          startDate: plan.startDate,
          nights: plan.nights,
          slots,
        },
        controller.signal,
      ),
      // 날짜 제안은 곁들이는 정보다. 실패해도 진단 결과까지 막지 않는다.
      fetchDateAlternatives(
        uniquePlaceIds,
        plan.startDate,
        DATE_SEARCH_RANGE,
        controller.signal,
      ).catch(() => null),
    ])
      .then(([result, dateResult]) => {
        setDiagnosis(result)
        setDates(dateResult)
        if (baselineRef.current === null) {
          baselineRef.current = result.totalQuietness
        }
        setLoad({ phase: 'loaded' })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoad({
          phase: 'error',
          message:
            error instanceof ApiRequestError ? error.message : '진단하지 못했습니다.',
        })
      })

    return () => controller.abort()
  }, [plan, slots, uniquePlaceIds])

  if (!plan) {
    return <Navigate to="/" replace />
  }
  if (slots.length === 0) {
    return <Navigate to="/course" replace />
  }

  const baseline = baselineRef.current
  const improvement =
    diagnosis && baseline !== null ? diagnosis.totalQuietness - baseline : 0

  function handleSelectAlternative(placeId: string) {
    if (!sheet) {
      return
    }
    replacePlace(sheet.day, sheet.index, placeId)
    setSheet(null)
    // days가 바뀌면 위 effect가 다시 돌아 자동으로 재진단된다.
  }

  return (
    <div className="diag">
      <header className="diag-head">
        <h1 className="diag-title">코스 진단</h1>
        <Link to="/course" className="diag-edit">
          코스 고치기
        </Link>
      </header>

      {load.phase === 'error' && <p className="diag-error">{load.message}</p>}

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

            {improvement !== 0 && baseline !== null && (
              <p className={`score-delta ${improvement > 0 ? 'score-delta--up' : ''}`}>
                원안 {baseline} → 지금 {diagnosis.totalQuietness}
                <strong>
                  {improvement > 0 ? ` (+${improvement} 더 한적)` : ` (${improvement})`}
                </strong>
              </p>
            )}
            {load.phase === 'loading' && <p className="score-updating">다시 계산 중…</p>}
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
            )}
            {dates && !dates.alreadyQuietest && (
              <p className="muted date-note">
                날짜를 바꾸려면 <Link to="/">여행 조건</Link>에서 다시 골라주세요.
              </p>
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
        </>
      )}

      {!diagnosis && load.phase === 'loading' && <p className="muted">진단하는 중…</p>}

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
