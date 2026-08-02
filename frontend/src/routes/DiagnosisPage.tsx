import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { LEVEL_COLOR_VAR, LEVEL_EDGE, LEVEL_SOLID } from '../components/levelStyles'
import { CARD, CARD_RAISED, NOTICE, PRIMARY_BUTTON, READ_COLUMN } from '../components/styles'
import { useDiagnosis } from '../hooks/useDiagnosis'
import { fetchDateAlternatives } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { CongestionLevel, DateAlternatives } from '../types/api'
import { formatCompactDate, formatKoreanDate, formatWeekday } from '../utils/date'

/** 며칠 앞까지 더 한적한 날짜를 찾아볼지 */
const DATE_SEARCH_RANGE = 14

interface SheetTarget {
  day: number
  index: number
  placeId: string
  placeName: string
  visitDate: string
}

/** 날짜 목록의 한 줄. 현재 날짜와 대안을 같은 모양으로 다루기 위한 형태 */
interface DateRow {
  date: string
  quietness: number
  level: CongestionLevel
  levelLabel: string
  improvement: number
  current: boolean
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

  /*
    현재 날짜도 대안과 같은 줄로 그린다. 따로 떼어놓으면 "지금이 몇 점인지"를
    비교 대상 없이 봐야 해서, 제안된 날짜가 얼마나 나은지 가늠이 안 된다.
  */
  const dateRows: DateRow[] = dates
    ? [
        {
          date: dates.selectedDate,
          quietness: dates.selectedQuietness,
          level: dates.selectedLevel,
          levelLabel: dates.selectedLevelLabel,
          improvement: 0,
          current: true,
        },
        ...dates.options.map((option) => ({ ...option, current: false })),
      ]
    : []

  // 원안과 같은 자리(일차·순서)에 다른 장소가 들어갔으면 교체된 것이다.
  function isSwapped(day: number, order: number, placeId: string) {
    const before = state.baseline?.days[day - 1]?.[order - 1]
    return before !== undefined && before !== placeId
  }

  function handleSelectAlternative(placeId: string) {
    if (!sheet) {
      return
    }
    replacePlace(sheet.day, sheet.index, placeId)
    setSheet(null)
    // days가 바뀌면 useDiagnosis가 다시 돌아 자동으로 재진단된다.
  }

  const crowdedCount = diagnosis
    ? diagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0
  const quietCount = diagnosis
    ? diagnosis.slots.filter((slot) => slot.level === 'QUIET').length
    : 0

  return (
    <div className={`${READ_COLUMN} flex flex-col gap-4.5`}>
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-fg text-xl font-bold tracking-tight">진단 결과</h1>
        <Link to="/course" className="text-muted text-[13px] font-medium">
          코스 수정
        </Link>
      </header>

      {current.phase === 'error' && (
        <p className={`${NOTICE} text-crowded-deep text-sm`}>{current.message}</p>
      )}

      {diagnosis && (
        <>
          {/*
            종합 지수. 숫자를 원형 게이지 안에 두면 "100점 만점 중 얼마"라는
            비율이 숫자를 읽기 전에 먼저 보인다.
          */}
          <section
            className={`${CARD_RAISED} flex flex-col items-center gap-4.5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-6.5`}
            aria-live="polite"
          >
            <div
              className="grid h-27 w-27 flex-none place-items-center rounded-full lg:h-34 lg:w-34"
              style={{
                background: `conic-gradient(${LEVEL_COLOR_VAR[diagnosis.totalLevel]} ${diagnosis.totalQuietness}%, var(--c-line) 0)`,
              }}
            >
              <div className="bg-surface grid h-22 w-22 place-items-center rounded-full lg:h-28 lg:w-28">
                <span className="text-fg font-mono text-[34px] leading-none font-semibold tracking-[-0.02em]">
                  {diagnosis.totalQuietness}
                </span>
                <span className="text-hint text-[11.5px]">한적 지수</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 sm:items-start">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <CongestionBadge
                  level={diagnosis.totalLevel}
                  label={diagnosis.totalLevelLabel}
                />
                <span className="text-hint text-[13px]">
                  {formatKoreanDate(plan.startDate)} 기준
                </span>
              </div>

              <p className="text-fg m-0 text-center text-base leading-[1.5] font-semibold text-pretty sm:text-left">
                {crowdedCount > 0
                  ? `${crowdedCount}곳이 붐빌 것으로 보여요`
                  : '전체적으로 여유로운 코스예요'}
              </p>

              {improvement !== 0 && baselineTotal !== null && (
                <p className="m-0 text-center text-[13px] sm:text-left">
                  원안 {baselineTotal} → 지금{' '}
                  <strong className={improvement > 0 ? 'text-quiet-deep' : ''}>
                    {diagnosis.totalQuietness}
                    {improvement > 0 ? ` (+${improvement})` : ` (${improvement})`}
                  </strong>
                </p>
              )}
              {dateMoved && state.baseline && (
                <p className="m-0 text-center text-[13px] sm:text-left">
                  날짜 {formatKoreanDate(state.baseline.plan.startDate)} →{' '}
                  <strong className="text-brand-deep">
                    {formatKoreanDate(plan.startDate)}
                  </strong>
                </p>
              )}

              {/* 숫자 요약. 총점 하나만으로는 "어디를 손봐야 하는지"가 안 보인다. */}
              <div className="mt-0.5 flex w-full gap-2">
                {[
                  { label: '전체 장소', value: `${diagnosis.slots.length}곳`, tone: 'text-fg' },
                  { label: '한적한 곳', value: `${quietCount}곳`, tone: 'text-quiet-deep' },
                  {
                    label: '붐비는 곳',
                    value: `${crowdedCount}곳`,
                    tone: crowdedCount > 0 ? 'text-crowded-deep' : 'text-hint',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-bg rounded-ui flex flex-1 flex-col gap-0.5 px-3 py-2.5"
                  >
                    <span className="text-hint text-[11.5px]">{stat.label}</span>
                    <span className={`font-mono text-base font-semibold ${stat.tone}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {current.phase === 'loading' && (
              <p className="text-hint text-xs">다시 계산 중…</p>
            )}
          </section>

          {/* 회피 경로 ①: 장소는 그대로 두고 날짜를 옮긴다 */}
          <section className={`${CARD_RAISED} flex flex-col gap-3.5 p-4.5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-fg text-[15px] font-semibold">더 한적한 날짜</h2>
              <span className="text-hint text-[12.5px]">
                같은 코스를 다른 날짜로 계산했어요
              </span>
            </div>

            {!dates && <p className="text-[13px]">날짜 정보를 불러오지 못했어요.</p>}
            {dates?.alreadyQuietest && (
              <p className="text-[13px]">
                고르신 {formatKoreanDate(dates.selectedDate)}이 이 코스에서 가장 한적한 날이에요.
              </p>
            )}

            {dates && !dates.alreadyQuietest && (
              <>
                <ul className="flex flex-col gap-2">
                  {dateRows.map((row) => (
                    <li
                      key={row.date}
                      className={`rounded-ui flex items-center gap-3 border px-3.5 py-3 ${
                        row.current
                          ? 'border-quiet-soft bg-quiet-tint/50'
                          : 'border-line bg-bg'
                      }`}
                    >
                      {/*
                        날짜·증감·막대를 <b>줄어들 수 있는 한 칸</b>에 묶는다.

                        이 셋을 각각 고정폭으로 늘어놓았더니 390px에서 가로로 넘쳤다.
                        고정폭 칸만 늘어선 줄에는 남는 공간을 흡수할 곳이 없어서,
                        화면이 좁아지면 넘치는 것 말고 갈 데가 없다.
                      */}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-fg font-mono text-[13.5px] font-medium">
                            {formatCompactDate(row.date)}
                          </span>
                          <span className="text-hint text-[11.5px]">
                            {formatWeekday(row.date)}
                          </span>
                          <span
                            className={`text-[11.5px] font-semibold ${
                              row.current ? 'text-hint' : 'text-quiet-deep'
                            }`}
                          >
                            {row.current ? '현재 날짜' : `+${row.improvement}`}
                          </span>
                        </div>

                        {/* 막대는 점수를 눈으로 비교하는 장치다. 숫자만 있으면 줄마다 다시 읽어야 한다. */}
                        <div className="bg-line h-2 overflow-hidden rounded-full">
                          <div
                            className={`h-full rounded-full ${LEVEL_SOLID[row.level]}`}
                            style={{ width: `${row.quietness}%` }}
                          />
                        </div>
                      </div>

                      <span
                        className={`w-8 flex-none text-right font-mono text-[14.5px] font-semibold ${
                          row.current ? 'text-fg' : ''
                        }`}
                      >
                        {row.quietness}
                      </span>

                      {row.current ? (
                        <span className="text-hint rounded-chip bg-line/70 h-9 flex-none px-3 text-center text-[12.5px] leading-9 font-semibold whitespace-nowrap">
                          적용됨
                        </span>
                      ) : (
                        /* 누르면 코스 전체가 그 날짜로 옮겨진다. 장소는 그대로 둔다. */
                        <button
                          type="button"
                          className="bg-fg rounded-chip hover:bg-fg/85 h-9 flex-none cursor-pointer px-3.5 text-[12.5px] font-semibold whitespace-nowrap text-white transition-colors"
                          onClick={() => changeStartDate(row.date)}
                        >
                          이 날짜로
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-hint m-0 text-[12.5px]">
                  날짜를 누르면 장소는 그대로 두고 코스 전체가 그 날로 옮겨져요.
                </p>
              </>
            )}
          </section>

          {/* 회피 경로 ②: 날짜는 그대로 두고 붐비는 장소를 바꾼다 */}
          {Array.from({ length: diagnosis.days }, (_, index) => index + 1).map((day) => {
            const daySlots = diagnosis.slots.filter((slot) => slot.day === day)
            if (daySlots.length === 0) {
              return null
            }
            /*
              하루 평균은 숫자만 보여주고 등급 색을 입히지 않는다.

              색을 넣으려면 "몇 점부터 한적인가"를 여기서 판단해야 하는데,
              그 임계값은 서버(CongestionLevel)에만 있어야 한다. 화면에도 적어두면
              분석 결과로 기준이 바뀔 때 한쪽만 고쳐져 두 값이 어긋난다.
            */
            const dayAverage = Math.round(
              daySlots.reduce((sum, slot) => sum + slot.quietness, 0) / daySlots.length,
            )

            return (
              <section key={day} className="flex flex-col gap-2.5">
                <div className="flex items-baseline gap-2.5 px-0.5">
                  <h2 className="text-fg text-[15px] font-bold tracking-tight">Day {day}</h2>
                  <span className="text-hint text-[12.5px]">
                    {formatKoreanDate(daySlots[0].visitDate)} · {daySlots.length}곳
                  </span>
                  <span className="bg-line h-px flex-1" aria-hidden="true" />
                  <span className="bg-bg text-fg rounded-full px-2.5 py-1 font-mono text-xs font-semibold">
                    평균 {dayAverage}
                  </span>
                </div>

                <ol className="flex flex-col gap-2">
                  {daySlots.map((slot) => (
                    <li
                      key={`${slot.day}-${slot.order}`}
                      className={`${CARD} ${LEVEL_EDGE[slot.level]} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-3.5`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`grid h-7 w-7 flex-none place-items-center rounded-full font-mono text-[13px] font-semibold text-white ${LEVEL_SOLID[slot.level]}`}
                        >
                          {slot.order}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-fg m-0 text-base font-semibold tracking-[-0.01em]">
                              {slot.place.name}
                            </p>
                            {isSwapped(slot.day, slot.order, slot.place.id) && (
                              <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                                교체함
                              </span>
                            )}
                          </div>
                          <p className="text-hint m-0 text-[12.5px]">
                            {slot.place.categoryName}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-none items-center gap-3 sm:ml-auto">
                        <CongestionBadge
                          level={slot.level}
                          label={slot.levelLabel}
                          quietness={slot.quietness}
                          size="sm"
                        />
                        {slot.level === 'CROWDED' && (
                          <button
                            type="button"
                            className="bg-crowded hover:bg-crowded-deep rounded-chip ml-auto h-10 cursor-pointer px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_4px_12px_rgb(206_81_56/0.22)] transition-colors sm:ml-0"
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

          <div className="from-bg/0 to-bg sticky bottom-0 mt-1 bg-gradient-to-b to-[30%] pt-3.5 pb-5">
            <button type="button" className={PRIMARY_BUTTON} onClick={() => navigate('/result')}>
              최종 코스 확인하기
            </button>
          </div>
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
