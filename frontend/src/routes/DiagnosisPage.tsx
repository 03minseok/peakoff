import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { LEVEL_COLOR_VAR, LEVEL_ON_SOLID, LEVEL_SOLID } from '../components/levelStyles'
import { CARD, CARD_RAISED, NOTICE, PRIMARY_BUTTON } from '../components/styles'
import { currentDiagnosis, useDiagnosis } from '../hooks/useDiagnosis'
import { fetchDateAlternatives } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { CongestionLevel, DateAlternatives, DateOption } from '../types/api'
import { formatCompactDate, formatKoreanDate, formatWeekday, today } from '../utils/date'

/**
 * 기준 날짜 앞뒤로 며칠씩 살펴볼지. 3이면 창은 7일이다.
 *
 * <p>넓게 열면 "두 주 뒤가 가장 한적합니다" 같은, 실행할 수 없는 제안이 위로 올라온다.
 * 여행 날짜를 옮길 수 있는 폭은 보통 주말 하나를 넘지 않는다.
 */
const DATE_SEARCH_RANGE = 3

interface SheetTarget {
  day: number
  index: number
  placeId: string
  placeName: string
  visitDate: string
  /** 지금 이 자리의 한적도. 후보가 더 나은지 비교해 보여주기 위해 함께 넘긴다 */
  quietness: number
  level: CongestionLevel
}

/** 날짜 목록의 한 줄. 원안·적용된 날짜·나머지 후보를 같은 모양으로 다루기 위한 형태 */
interface DateRow {
  date: string
  quietness: number
  level: CongestionLevel
  levelLabel: string
  /** 원안 날짜 대비 한적도 증가폭. 음수면 그날이 더 붐빈다 */
  improvement: number
  /** 지금 코스에 적용된 날짜 */
  current: boolean
  /** 사용자가 처음 고른 날짜 */
  base?: boolean
  /** 여행 날짜로 고를 수 있는가. 지난 날짜는 false */
  selectable?: boolean
}

export function DiagnosisPage() {
  const navigate = useNavigate()
  const { state, replacePlace, markBaseline, changeStartDate } = useTrip()
  const plan = state.plan

  const [dates, setDates] = useState<DateAlternatives | null>(null)
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  /**
   * 좁은 화면에서 날짜 목록을 펼쳤는가. 넓은 화면에서는 이 값을 보지 않는다.
   *
   * <p>기본값이 <b>접힘</b>이다. 펼쳐 두면 이 카드 하나가 좁은 화면을 다 먹어
   * 정작 고쳐야 할 일자별 목록이 한참 아래로 밀린다. 대신 접힌 상태에서도
   * "언제로 옮기면 얼마나 좋아지는지" 한 줄은 남겨 둔다.
   */
  const [datesOpen, setDatesOpen] = useState(false)

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

  /*
   * 아래 훅들은 반드시 조기 반환(Navigate)보다 <b>위</b>에 있어야 한다.
   * 훅은 매 렌더 같은 순서로 불려야 하는데, 반환문 아래에 두면 plan이 없는 렌더에서만
   * 건너뛰어져 순서가 어긋난다. 그래서 diagnosis도 여기서 미리 꺼낸다.
   */
  const diagnosis = currentDiagnosis(current)

  /*
   * 지도에 넘길 것들.
   *
   * useMemo가 필수다. 매 렌더 새 객체를 만들면 CourseMap의 다시 그리기 effect가
   * 값이 그대로인데도 매번 돌아, 마커 수십 개를 지웠다 다시 만든다.
   *
   * 좌표는 진단 응답이 들고 있다(slot.place). 장소 목록을 따로 부르지 않는다 —
   * 코스에 담긴 곳만 그리면 되고, 그건 이미 손에 있다.
   */
  const mapPlaces = useMemo(
    () => (diagnosis ? diagnosis.slots.map((slot) => slot.place) : []),
    [diagnosis],
  )

  /** 일차별 방문 순서. 하나의 배열이 하루치라 밤사이 이동이 선으로 이어지지 않는다 */
  const mapRoutes = useMemo(
    () =>
      diagnosis
        ? Array.from({ length: diagnosis.days }, (_, index) =>
            diagnosis.slots
              .filter((slot) => slot.day === index + 1)
              .sort((a, b) => a.order - b.order)
              .map((slot) => slot.place.id),
          )
        : [],
    [diagnosis],
  )

  /** 마커 색을 정하는 표. 진단 화면에서만 넘긴다 — 편집 화면은 점수를 숨긴다 */
  const mapLevels = useMemo(
    () =>
      diagnosis
        ? Object.fromEntries(diagnosis.slots.map((slot) => [slot.place.id, slot.level]))
        : {},
    [diagnosis],
  )

  /**
   * 날짜 창의 한가운데. <b>원안 날짜</b>이지 지금 적용된 날짜가 아니다.
   *
   * <p>적용된 날짜를 기준으로 삼으면 옮길 때마다 창이 따라 움직인다. 두 번 옮기면
   * 원래 날짜가 창 밖으로 나가 되돌아갈 방법이 사라진다. 원안에 고정하면 후보가 늘 같아서
   * 몇 번을 옮겨도 되돌아갈 수 있고, 개선폭도 "원안 대비"라는 하나의 기준으로 읽힌다.
   */
  const baseDate = state.baseline?.plan.startDate ?? plan?.startDate ?? null

  useEffect(() => {
    if (!baseDate || uniquePlaceIds.length === 0) {
      return
    }
    const controller = new AbortController()

    fetchDateAlternatives(uniquePlaceIds, baseDate, DATE_SEARCH_RANGE, controller.signal)
      .then(setDates)
      // 날짜 제안은 곁들이는 정보다. 실패해도 진단 결과까지 막지 않는다.
      .catch(() => setDates(null))

    return () => controller.abort()
    // 적용 날짜(plan.startDate)는 의존성이 아니다 — 옮겨도 창이 움직이면 안 된다.
  }, [baseDate, uniquePlaceIds])

  if (!plan) {
    return <Navigate to="/plan" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const baselineTotal = baseline.phase === 'loaded' ? baseline.diagnosis.totalQuietness : null
  const improvement =
    diagnosis && baselineTotal !== null ? diagnosis.totalQuietness - baselineTotal : 0
  const dateMoved =
    state.baseline !== null && state.baseline.plan.startDate !== plan.startDate

  /*
    원안 날짜도 같은 줄로 그린다. 서버는 창에서 기준일을 빼고 보내므로 여기서 도로 넣는다.
    이게 곧 <b>되돌아갈 줄</b>이다 — 따로 "되돌리기" 버튼을 만들지 않고 목록 안에 둔다.
    같은 일을 하는 조작이 화면 두 곳에 있으면 어느 쪽이 진짜인지 흔들린다.
  */
  const todayDate = today()
  const dateRows: DateRow[] = dates
    ? [
        {
          date: dates.selectedDate,
          quietness: dates.selectedQuietness,
          level: dates.selectedLevel,
          levelLabel: dates.selectedLevelLabel,
          improvement: 0,
          current: false,
        },
        ...dates.options.map((option) => ({ ...option, current: false })),
      ]
        .map((row) => ({
          ...row,
          /** 지금 코스에 적용된 날짜 */
          current: row.date === plan?.startDate,
          /** 사용자가 처음 고른 날짜. 여기로 돌아올 수 있어야 한다 */
          base: row.date === dates.selectedDate,
          /** 지난 날짜는 보여주되 고를 수 없다 — 이미 지나간 날로 여행을 갈 수는 없다 */
          selectable: row.date >= todayDate,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : []

  /**
   * 접을 만한 날짜 목록이 있을 때만 그 값, 아니면 null.
   *
   * <p>불리언이 아니라 값으로 두는 이유: 타입스크립트가 dates의 null 여부를
   * 불리언 변수로는 좁히지 못한다.
   */
  const toggleableDates = dates && dates.options.length > 0 ? dates : null

  /**
   * 가장 많이 좋아지는 날. 접혀 있을 때 한 줄로 보여준다.
   *
   * <p>서버 정렬을 믿지 않고 직접 고른다. 목록 순서가 바뀌어도 이 문장은 계속 맞아야 한다 —
   * 화면에 "가장"이라고 적어놓고 실제로는 첫 번째를 집는 것은 거짓말이 된다.
   *
   * <p>이제 목록에 <b>더 붐비는 날도 들어 있어</b> 개선폭이 음수일 수 있다. 갈 수 있고
   * 실제로 나아지는 날만 고른다 — 아니면 "옮기면 −8" 같은 문장이 요약 자리에 오른다.
   */
  const bestDate =
    dates?.options
      .filter((option) => option.improvement > 0 && option.date >= todayDate)
      .reduce<DateOption | null>(
        (best, option) => (best === null || option.improvement > best.improvement ? option : best),
        null,
      ) ?? null

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

  /*
   * 다음 단계 버튼. 화면 두 곳에 놓지만 정의는 하나다.
   *
   * 좁은 화면에서는 아래에 붙어 따라오고, 넓은 화면에서는 종합 지수 바로 아래에 선다.
   * 자리가 달라 감싸는 것이 다를 뿐 하는 일은 같으므로, 두 번 적어두면
   * 문구나 이동 경로를 고칠 때 한쪽만 바뀐다. 둘 중 하나는 항상 display:none이라
   * 화면에도 보조기술에도 버튼은 하나로 보인다.
   */
  const confirmButton = (
    <button type="button" className={PRIMARY_BUTTON} onClick={() => navigate('/result')}>
      최종 코스 확인하기
    </button>
  )

  return (
    // lg부터 읽기 폭(max-w-read)을 풀어 대시보드 폭으로 넓힌다
    <div className="mx-auto flex w-full max-w-read flex-col gap-4.5 lg:max-w-app">
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
        /*
          좁은 화면은 지금까지처럼 한 줄로 쌓이고, lg부터 둘로 갈라진다.

            ┌──────────────┬───────────────────┐
            │ 종합 지수     │ Day 1             │
            │ 더 한적한 날짜 │ Day 2             │
            │ (따라다님)    │ Day 3 …           │
            ├──────────────┴───────────────────┤
            │ 최종 코스 확인하기 (바닥에 붙어 따라옴) │
            └──────────────────────────────────┘

          왼쪽이 따라다니는(sticky) 것이 요점이다. 장소를 교체하면 총점이 바로 바뀌는데,
          세로 한 줄이면 그 숫자가 화면 위로 사라진 뒤라 <b>무엇이 좋아졌는지 보이지 않는다.</b>
          목록을 훑는 내내 총점과 날짜 대안이 눈에 남아 있어야 교체가 판단이 된다.

          items-start가 있어야 왼쪽 칸이 줄 높이만큼 늘어나지 않고 제 높이로 서서,
          긴 오른쪽 칸 안에서 따라다닐 여지가 생긴다.
        */
        <div className="flex flex-col gap-4.5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
          {/*
            왼쪽 패널.

            top-18 = 공용 헤더(56px) 아래로 한 칸. 헤더에 가려지지 않게 한다.

            <b>화면 높이를 넘지 못하게 묶는다(max-h).</b> 이게 없으면 패널이 화면보다 길어질 때
            아래쪽 날짜들이 화면 밖으로 밀려 영영 보이지 않는다. 넘칠 때 스크롤되는 것은
            날짜 목록뿐이고(min-h-0 + overflow-y-auto), 종합 지수와 버튼은 늘 제자리에 있다.
          */}
          <div className="flex min-w-0 flex-col gap-4.5 lg:sticky lg:top-18 lg:col-span-5 lg:max-h-[calc(100svh-5.5rem)]">
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
                {/* 출처 표기(절대 규칙 4). 공사 이름 대신 중립 표현 — 숫자가 서는 화면마다 한 번은 말한다 */}
                <span className="text-hint text-[13px]">
                  {formatKoreanDate(plan.startDate)} 기준 · 공공데이터 기반 예측
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

            {/* refreshing이라야 뜬다. loading일 때는 이 블록 자체가 화면에 없다 */}
            {current.phase === 'refreshing' && (
              <p className="text-hint text-xs">다시 계산 중…</p>
            )}
          </section>

          {/*
            넓은 화면의 다음 단계 버튼. <b>종합 지수 바로 아래</b>에 둔다.

            앞서 날짜 카드 밑에 있었는데, 그 자리에서는 "날짜를 확정하는 버튼"으로 읽혔다.
            실제로는 날짜 이동과 장소 교체를 <b>둘 다 반영한 결과</b>로 넘어가는 버튼이다.
            바로 위 종합 지수가 그 둘을 합친 값이므로, 거기에 붙여야 무엇을 확정하는지가 맞는다.
          */}
          <div className="hidden flex-none lg:block">{confirmButton}</div>

          {/* 회피 경로 ①: 장소는 그대로 두고 날짜를 옮긴다 */}
          {/* lg:min-h-0 — flex 자식은 이게 없으면 내용보다 작아지지 않아 스크롤이 걸리지 않는다 */}
          <section
            className={`${CARD_RAISED} flex flex-col gap-3.5 p-4.5 lg:min-h-0 lg:overflow-y-auto`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-fg text-[15px] font-semibold">더 한적한 날짜</h2>

              {/*
                좁은 화면에서만 접었다 펼친다.

                날짜 후보가 최대 열몇 줄이라 좁은 화면에서는 이 카드 하나가 화면을 다 먹고,
                정작 아래 일자별 목록까지 내려가는 데만 한참 걸렸다.

                넓은 화면에는 이 버튼이 없다. 거기서는 왼쪽 패널이 화면 높이에 묶여 있어
                길어져도 카드 안에서만 스크롤되므로, 접을 이유가 없다.
              */}
              {toggleableDates ? (
                <button
                  type="button"
                  className="text-brand-deep hover:text-brand -mr-1 cursor-pointer bg-transparent px-1 py-0.5 text-[12.5px] font-semibold lg:hidden"
                  aria-expanded={datesOpen}
                  aria-controls="date-alternatives"
                  onClick={() => setDatesOpen((open) => !open)}
                >
                  {datesOpen ? '접기' : '날짜 비교'}
                </button>
              ) : null}

              <span className="text-hint hidden text-[12.5px] lg:inline">
                같은 코스를 앞뒤 3일로 계산했어요
              </span>
            </div>

            {!dates && <p className="text-[13px]">날짜 정보를 불러오지 못했어요.</p>}
            {/*
              이 안내가 목록을 대신하지 않는다. 더 나은 날이 없어도 <b>되돌아갈 줄</b>은
              보여야 하고, "왜 없는지"는 옆에 늘어선 점수들이 스스로 말한다.
            */}
            {dates?.alreadyQuietest && (
              <p className="text-[13px]">
                고르신 {formatKoreanDate(dates.selectedDate)}이 앞뒤 3일 중 가장 한적한 날이에요.
              </p>
            )}

            {/*
              접었을 때도 <b>결론 한 줄</b>은 남긴다. 목록만 통째로 감추면 "여기에 무엇이
              들어 있는지" 알 수 없어, 펼쳐볼 이유가 생기지 않는다. 날짜 회피는 이 서비스의
              두 경로 중 하나라 접혀서 묻히면 안 된다.
            */}
            {toggleableDates && !datesOpen && bestDate && (
              <p className="m-0 text-[13px] leading-[1.55] lg:hidden">
                {formatCompactDate(bestDate.date)} {formatWeekday(bestDate.date)}로 옮기면{' '}
                <strong className="text-quiet-deep">한적 지수 +{bestDate.improvement}</strong>
              </p>
            )}

            {dates && (
              <>
                {/*
                  hidden은 좁은 화면에서 접혔을 때만이다. lg:flex가 미디어 쿼리 안에 있어
                  넓은 화면에서는 접힘 상태와 무관하게 항상 펼쳐진다.
                */}
                <ul
                  id="date-alternatives"
                  className={`flex-col gap-2 lg:flex ${datesOpen ? 'flex' : 'hidden'}`}
                >
                  {dateRows.map((row) => (
                    <li
                      key={row.date}
                      className={`rounded-ui flex items-center gap-3 border px-3.5 py-3 ${
                        row.current
                          ? 'border-quiet-soft bg-quiet-tint/50'
                          : row.selectable
                            ? 'border-line bg-bg'
                            : /* 지난 날짜. 자리는 지키되 뒤로 물린다 */
                              'border-line/50 bg-bg/50 opacity-60'
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
                          {/*
                            원안과 적용됨은 서로 다른 것이다. 날짜를 옮기면 두 표시가
                            다른 줄에 붙고, 되돌리면 한 줄에 겹친다. 겹칠 때 둘 다
                            적으면 장황해서 "원안 · 적용됨"으로 합쳐 보인다.
                          */}
                          {row.base && (
                            <span className="bg-line/70 text-muted rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                              원안
                            </span>
                          )}
                          {row.current && (
                            <span className="bg-quiet-soft/50 text-quiet-deep rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                              적용됨
                            </span>
                          )}
                          {/* 원안 대비 증감. 0이면(=원안 줄) 적을 것이 없다 */}
                          {row.improvement !== 0 && (
                            <span
                              className={`text-[11.5px] font-semibold ${
                                row.improvement > 0 ? 'text-quiet-deep' : 'text-crowded-deep'
                              }`}
                            >
                              {row.improvement > 0 ? `+${row.improvement}` : row.improvement}
                            </span>
                          )}
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

                      {/*
                        누르면 코스 전체가 그 날짜로 옮겨진다. 장소는 그대로 둔다.

                        원안 줄의 문구만 <b>되돌리기</b>다. 하는 일은 같지만 사용자가
                        읽는 뜻이 다르다 — "다른 날로 옮긴다"와 "원래대로 돌린다"는
                        같은 버튼이어도 결심의 무게가 다르다.
                      */}
                      {row.current ? (
                        <span className="text-quiet-deep bg-quiet-tint rounded-chip h-9 flex-none px-3 text-center text-[12.5px] leading-9 font-semibold whitespace-nowrap">
                          적용 중
                        </span>
                      ) : !row.selectable ? (
                        <span className="text-hint bg-line/50 rounded-chip h-9 flex-none px-3 text-center text-[12.5px] leading-9 font-medium whitespace-nowrap">
                          지난 날
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`rounded-chip h-9 flex-none cursor-pointer px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                            row.base
                              ? 'border-line bg-surface text-fg hover:bg-bg border'
                              : 'bg-fg hover:bg-fg/85 text-white'
                          }`}
                          onClick={() => changeStartDate(row.date)}
                        >
                          {row.base ? '되돌리기' : '이 날짜로'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {/* 목록과 함께 접힌다. 목록이 안 보이는데 사용법만 남아 있으면 뜬금없다 */}
                <p
                  className={`text-hint m-0 text-[12.5px] lg:block ${
                    datesOpen ? 'block' : 'hidden'
                  }`}
                >
                  날짜를 누르면 장소는 그대로 두고 코스 전체가 그 날로 옮겨져요.
                </p>
              </>
            )}
          </section>
          </div>

          {/* 회피 경로 ②: 날짜는 그대로 두고 붐비는 장소를 바꾼다 */}
          <div className="flex min-w-0 flex-col gap-4.5 lg:col-span-7">
            {/*
              코스 전체를 한눈에.

              마커 색이 <b>한적도 등급</b>이다. 목록은 위에서 아래로 하나씩 읽어야 하지만,
              지도는 "이 근처가 통째로 붐빈다"를 한 번에 보여준다 — 어느 장소를 바꿀지
              고를 때 목록만으로는 안 나오는 판단이다.

              편집 화면 지도와 같은 컴포넌트지만 거기엔 등급을 넘기지 않는다.
              첫 코스에는 점수를 노출하지 않기로 했기 때문이다.
            */}
            <section className={`${CARD_RAISED} flex flex-col gap-3 p-4.5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-fg text-[15px] font-semibold">코스 지도</h2>
                <span className="text-hint text-[12.5px]">마커 색이 예상 혼잡도예요</span>
              </div>

              {/* 읽기 전용. onSelect를 넘기지 않으면 마커를 누를 수 없다 */}
              <CourseMap
                places={mapPlaces}
                routes={mapRoutes}
                levels={mapLevels}
                className="lg:h-[340px]"
              />

              {/* 색이 무엇을 뜻하는지 적어둔다. 색만 두면 무엇의 색인지 알 수 없다 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {(
                  [
                    { level: 'QUIET', label: '한적' },
                    { level: 'MODERATE', label: '보통' },
                    { level: 'CROWDED', label: '붐빔' },
                  ] as const
                ).map((item) => (
                  <span key={item.level} className="flex items-center gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 flex-none rounded-full ${LEVEL_SOLID[item.level]}`}
                      aria-hidden="true"
                    />
                    <span className="text-hint text-[12px]">{item.label}</span>
                  </span>
                ))}
                {diagnosis.days > 1 && (
                  <span className="text-hint text-[12px]">
                    마커 번호는 “일차-순서”예요
                  </span>
                )}
              </div>
            </section>

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
                      className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-3.5`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        {/* 색 안에 번호가 들어가므로 LEVEL_SOLID가 아니라 LEVEL_ON_SOLID다.
                            글자색이 짝으로 따라오니 여기서 따로 지정하지 않는다 */}
                        <span
                          className={`grid h-7 w-7 flex-none place-items-center rounded-full font-mono text-[13px] font-semibold ${LEVEL_ON_SOLID[slot.level]}`}
                        >
                          {slot.order}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

                        {/*
                          한적도 배지는 카드 오른쪽 끝에 세운다.

                          아래 행동 줄에 있을 때는 대안 버튼과 나란히 서서 두 번째 버튼처럼
                          읽혔다. 배지는 누르는 것이 아니라 이 장소를 설명하는 값이다.

                          이름 바로 옆에 붙이면 이름 길이에 따라 배지 위치가 카드마다 달라져
                          목록을 훑을 때 눈이 매번 다른 자리를 찾아야 한다. 오른쪽 끝에 고정하면
                          <b>세로로 한 줄</b>이 되어 위아래로 비교된다.
                        */}
                        <span className="flex-none">
                          <CongestionBadge
                            level={slot.level}
                            label={slot.levelLabel}
                            quietness={slot.quietness}
                            size="sm"
                          />
                        </span>
                      </div>

                      {/* 아래 줄은 "얼마나(막대)"와 "무엇을 할까(버튼)"만 남는다 */}
                      <div className="flex items-center gap-3 sm:flex-none sm:ml-auto">
                        {/*
                          한적도 막대. 좁은 화면에서만 선다.

                          배지가 위로 올라가 이 줄은 버튼 하나만 남았다. 빈자리를 장식으로
                          메우는 대신 <b>읽을 것</b>을 넣는다 — 막대 길이는 숫자를 읽기 전에
                          카드끼리의 차이를 보여준다. 바로 아래 날짜 목록이 쓰는 것과 같은
                          패턴이라 두 목록을 같은 방식으로 훑게 된다.

                          넓은 화면에서는 버튼이 오른쪽 끝에 붙어 남는 자리가 없다.
                        */}
                        <div className="bg-line h-1.5 flex-1 overflow-hidden rounded-full sm:hidden">
                          <div
                            className={`h-full rounded-full ${LEVEL_SOLID[slot.level]}`}
                            style={{ width: `${slot.quietness}%` }}
                          />
                        </div>
                        {/*
                          대안은 모든 자리에서 열 수 있다. 한적하다고 판단된 곳도
                          사용자가 더 나은 후보를 직접 보고 판단할 수 있어야 한다.

                          다만 붐비는 곳만 채운 버튼으로 강하게 두고, 나머지는
                          테두리만 있는 조용한 버튼으로 둔다. 모든 카드에 빨간 버튼이
                          서 있으면 경고색이 의미를 잃는다 — 시안에도 "주황·빨강은
                          경고 신호로만"이라고 못박혀 있다.
                        */}
                        <button
                          type="button"
                          className={`rounded-chip h-10 flex-none cursor-pointer px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                            slot.level === 'CROWDED'
                              ? 'bg-crowded-strong hover:bg-crowded-deep text-white shadow-[0_4px_12px_rgb(179_23_90/0.24)]'
                              : 'border-line bg-surface text-muted hover:border-brand hover:text-brand-deep border'
                          }`}
                          onClick={() =>
                            setSheet({
                              day: slot.day,
                              index: slot.order - 1,
                              placeId: slot.place.id,
                              placeName: slot.place.name,
                              visitDate: slot.visitDate,
                              quietness: slot.quietness,
                              level: slot.level,
                            })
                          }
                        >
                          대안 보기
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
          </div>

          {/*
            좁은 화면의 다음 단계 버튼. 아래에 붙어 따라온다.
            bottom-15: BottomNav(60px) 위에 얹는다. 막대가 사라지는 md부터는 바닥으로 내려온다.

            <b>lg에서는 감춘다.</b> 넓은 화면에서는 이 막대가 화면 아래를 가로질러
            왼쪽 패널의 날짜 목록 끝을 덮었다. 거기서는 같은 버튼이 종합 지수 아래에
            이미 서 있으므로 이 막대는 가리기만 한다.
          */}
          {/*
            z-30 — 이 막대는 본문 위에 떠 있어야 한다. 값을 주지 않으면 뒤에 오는
            형제(특히 지도)에 덮인다. BottomNav(z-40)와 시트(z-50)보다는 아래다.
          */}
          <div className="from-bg/0 to-bg sticky bottom-15 z-30 mt-1 bg-gradient-to-b to-[30%] pt-3.5 pb-5 md:bottom-0 lg:hidden">
            {confirmButton}
          </div>
        </div>
      )}

      {!diagnosis && current.phase === 'loading' && <p className="text-[13px]">진단하는 중…</p>}

      {sheet && (
        <AlternativeSheet
          originName={sheet.placeName}
          originPlaceId={sheet.placeId}
          originQuietness={sheet.quietness}
          originLevel={sheet.level}
          visitDate={sheet.visitDate}
          excludePlaceIds={state.days[sheet.day - 1] ?? []}
          onClose={() => setSheet(null)}
          onSelect={handleSelectAlternative}
        />
      )}
    </div>
  )
}
