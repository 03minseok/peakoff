import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { CARD, NOTICE, PRIMARY_BUTTON } from '../components/styles'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchDateAlternatives } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { DateAlternatives } from '../types/api'
import { formatKoreanDate } from '../utils/date'

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
  const { state, replacePlace, markBaseline, changeStartDate } = useTrip()
  const plan = state.plan

  const [dates, setDates] = useState<DateAlternatives | null>(null)
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  // 주소로 바로 들어온 경우 원안이 비어 있다. 지금 코스를 원안으로 삼는다.
  useEffect(() => {
    if (plan && state.days.length > 0 && state.baseline === null) {
      markBaseline()
    }
  }, [plan, state.days, state.baseline, markBaseline])

  const current = useDiagnosis(plan, state.days)
  // 원안은 그때의 날짜(baseline.plan)로 진단한다. 지금 날짜로 계산하면
  // 날짜를 옮겨 얻은 개선이 원안에도 반영돼 차이가 사라진다.
  const baseline = useDiagnosis(state.baseline?.plan ?? null, state.baseline?.days ?? null)

  const uniquePlaceIds = useMemo(() => Array.from(new Set(state.days.flat())), [state.days])

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
  const baselineTotal = baseline.phase === 'loaded' ? baseline.diagnosis.totalQuietness : null
  const improvement =
    diagnosis && baselineTotal !== null ? diagnosis.totalQuietness - baselineTotal : 0
  const dateMoved =
    state.baseline !== null && state.baseline.plan.startDate !== plan.startDate

  function handleSelectAlternative(placeId: string) {
    if (!sheet) {
      return
    }
    replacePlace(sheet.day, sheet.index, placeId)
    setSheet(null)
    // days가 바뀌면 useDiagnosis가 다시 돌아 자동으로 재진단된다.
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-fg text-xl font-semibold tracking-tight">코스 진단</h1>
        <Link to="/course" className="text-muted text-[13px]">
          코스 고치기
        </Link>
      </header>

      {current.phase === 'error' && (
        <p className={`${NOTICE} text-danger text-sm`}>{current.message}</p>
      )}

      {diagnosis && (
        <>
          <section
            className="bg-surface rounded-card flex flex-col items-center gap-2 px-4 py-6"
            aria-live="polite"
          >
            <p className="text-[13px]">코스 총점</p>
            <p className="text-fg text-[40px] leading-none font-extrabold tracking-[-1.5px]">
              {diagnosis.totalQuietness}
              <span className="text-muted text-[15px] font-medium tracking-normal">/100</span>
            </p>
            <CongestionBadge level={diagnosis.totalLevel} label={diagnosis.totalLevelLabel} />

            {improvement !== 0 && baselineTotal !== null && (
              <p className="mt-1 text-center text-[13px]">
                원안 {baselineTotal} → 지금 {diagnosis.totalQuietness}
                <strong className={improvement > 0 ? 'text-quiet' : ''}>
                  {improvement > 0 ? ` (+${improvement} 더 한적)` : ` (${improvement})`}
                </strong>
              </p>
            )}
            {dateMoved && state.baseline && (
              <p className="text-[13px]">
                날짜 {formatKoreanDate(state.baseline.plan.startDate)} →{' '}
                <strong className="text-brand-strong">{formatKoreanDate(plan.startDate)}</strong>
              </p>
            )}
            {current.phase === 'loading' && <p className="text-xs">다시 계산 중…</p>}
          </section>

          <section>
            <h2 className="text-fg mb-2 text-[15px] font-semibold">더 한적한 날짜</h2>
            {!dates && <p className="text-[13px]">날짜 정보를 불러오지 못했어요.</p>}
            {dates?.alreadyQuietest && (
              <p className="text-[13px]">
                고르신 {formatKoreanDate(dates.selectedDate)}이 이 코스에서 가장 한적한 날이에요.
              </p>
            )}
            {dates && !dates.alreadyQuietest && (
              <>
                <ul className="flex flex-col gap-2">
                  {dates.options.map((option) => (
                    <li key={option.date}>
                      {/* 누르면 코스 전체가 그 날짜로 옮겨진다. 장소는 그대로 둔다. */}
                      <button
                        type="button"
                        className={`${CARD} hover:border-brand hover:bg-quiet-bg grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-3 p-3 text-left`}
                        onClick={() => changeStartDate(option.date)}
                      >
                        <span className="text-fg text-sm">{formatKoreanDate(option.date)}</span>
                        <CongestionBadge
                          level={option.level}
                          label={option.levelLabel}
                          quietness={option.quietness}
                          size="sm"
                        />
                        <span className="text-quiet font-mono text-[13px] font-bold">
                          +{option.improvement}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[13px]">
                  날짜를 누르면 장소는 그대로 두고 코스 전체가 그 날로 옮겨져요.
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
                      className={`${CARD} grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3`}
                    >
                      <span className="bg-brand-strong grid h-6.5 w-6.5 place-items-center rounded-full text-[13px] font-bold text-white">
                        {slot.order}
                      </span>
                      <div className="min-w-0">
                        <p className="text-fg text-[15px]">{slot.place.name}</p>
                        <p className="mt-0.5 text-xs">{slot.place.categoryName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <CongestionBadge
                          level={slot.level}
                          label={slot.levelLabel}
                          quietness={slot.quietness}
                          size="sm"
                        />
                        {slot.level === 'CROWDED' && (
                          <button
                            type="button"
                            className="border-brand text-brand-strong hover:bg-brand-strong min-h-8 cursor-pointer rounded-md border bg-transparent px-3 text-[13px] font-semibold whitespace-nowrap hover:text-white"
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

          <button type="button" className={PRIMARY_BUTTON} onClick={() => navigate('/result')}>
            최종 코스 확인하기
          </button>
        </>
      )}

      {!diagnosis && current.phase === 'loading' && <p className="text-[13px]">진단하는 중…</p>}

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
