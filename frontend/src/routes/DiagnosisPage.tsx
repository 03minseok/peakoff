import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { AlternativeSheet } from '../components/AlternativeSheet'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { LEVEL_COLOR_VAR, LEVEL_SOLID } from '../components/levelStyles'
import { CARD, CARD_RAISED, NOTICE, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/styles'
import { currentDiagnosis, toSlots, useDiagnosis } from '../hooks/useDiagnosis'
import { fetchDateAlternatives } from '../services/api'
import { planKeyOf } from '../services/alternativeCache'
import { useTrip } from '../state/tripContext'
import type { CongestionLevel, DateAlternatives } from '../types/api'
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
  /** 예측 자료가 없는 날은 null. 0으로 오지 않는다 — 0은 "매우 붐빔"이다 */
  quietness: number | null
  level: CongestionLevel | null
  levelLabel: string | null
  /** 원안 날짜 대비 한적도 증가폭. 음수면 그날이 더 붐빈다. 자료가 없으면 null */
  improvement: number | null
  /** 점수가 없는 이유를 사람이 읽는 문장. 있으면 화면이 그대로 띄운다 */
  gapMessage?: string | null
  /** 지금 코스에 적용된 날짜 */
  current: boolean
  /** 사용자가 처음 고른 날짜 */
  base?: boolean
  /** 여행 날짜로 고를 수 있는가. 지난 날짜와 자료 없는 날은 false */
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

  /*
   * 날짜 대안에 넘길 방문 목록.
   *
   * 진단이 쓰는 toSlots를 그대로 쓴다. 일차를 매기는 규칙이 두 벌이 되면
   * 같은 코스인데 진단 화면과 날짜 대안의 숫자가 어긋난다.
   *
   * 예전에는 Set으로 중복을 없앤 장소 목록이었다. 두 가지가 틀렸다 —
   * 일차가 사라져 2일차 장소도 시작일로 계산됐고, 이틀 연속 들르는 곳이
   * 한 번만 반영돼 코스 평균이 실제 일정과 달랐다.
   */
  const visits = useMemo(() => toSlots(state.days), [state.days])

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

  /**
   * 마커 색을 정하는 표. 진단 화면에서만 넘긴다 — 편집 화면은 점수를 숨긴다.
   *
   * 등급이 없는 장소는 표에서 뺀다. 넣을 색이 없어서다 — 임의로 한 색을 고르면
   * 지도에서 그 장소의 혼잡도를 우리가 안다고 말하는 셈이 된다.
   */
  const mapLevels = useMemo(
    () =>
      diagnosis
        ? Object.fromEntries(
            diagnosis.slots
              .filter((slot) => slot.level !== null)
              .map((slot) => [slot.place.id, slot.level as CongestionLevel]),
          )
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
    if (!baseDate || visits.length === 0) {
      return
    }
    const controller = new AbortController()

    fetchDateAlternatives(visits, baseDate, DATE_SEARCH_RANGE, controller.signal)
      .then(setDates)
      // 날짜 제안은 곁들이는 정보다. 실패해도 진단 결과까지 막지 않는다.
      .catch(() => setDates(null))

    return () => controller.abort()
    // 적용 날짜(plan.startDate)는 의존성이 아니다 — 옮겨도 창이 움직이면 안 된다.
  }, [baseDate, visits])

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
          // 자기 자신과의 차이라 늘 0이다. 자료가 없으면 비교할 것도 없다.
          improvement: dates.selectedQuietness === null ? null : 0,
          gapMessage: null,
          // 원안 날짜는 서버 목록에 없어 여기서 직접 판단한다. 지난 날로 여행을 갈 수는 없다.
          selectable: dates.selectedDate >= todayDate,
          current: false,
        },
        /*
         * 후보 날짜의 selectable은 <b>서버가 준 값을 그대로 쓴다.</b>
         * 화면이 다시 계산하면 "지난 날짜"와 "예측 범위 밖"이라는 두 판단이 두 곳에 생기고,
         * 예측 창이 바뀔 때 한쪽만 고쳐진다.
         */
        ...dates.options.map((option) => ({ ...option, current: false })),
      ]
        .map((row) => ({
          ...row,
          /** 지금 코스에 적용된 날짜 */
          current: row.date === plan?.startDate,
          /** 사용자가 처음 고른 날짜. 여기로 돌아올 수 있어야 한다 */
          base: row.date === dates.selectedDate,
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
   * <p><b>서버가 고른 날을 그대로 쓴다.</b> 예전에는 화면이 목록을 훑어 직접 골랐는데,
   * 그러면 "무엇이 가장 나은가"라는 판단이 서버와 화면 두 곳에 생긴다. 동점 처리 규칙
   * (기준일에 가까운 날 → 이른 날)까지 양쪽에 두면 언젠가 갈라진다.
   *
   * <p>서버는 고를 수 있고 실제로 나아지는 날만 후보로 본다. 그런 날이 없으면 null이다.
   */
  const bestDate =
    dates?.bestDate === null || dates === null
      ? null
      : (dates.options.find((option) => option.date === dates.bestDate) ?? null)

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

  /*
   * 교체한 자리를 원안의 장소로 되돌린다.
   *
   * <p>새 액션을 만들지 않고 {@code replacePlace}를 그대로 쓴다 — 되돌리기도 결국
   * "그 자리에 다른 장소를 넣는 것"이고, 넣을 값은 원안에 이미 적혀 있다.
   * 되돌리기 전용 경로를 만들면 코스를 바꾸는 길이 둘로 갈라져 나중에 한쪽만 고쳐진다.
   *
   * <p>원안이 없거나(진단 전) 그 자리가 비어 있으면 아무것도 하지 않는다.
   * 이 버튼은 교체된 자리에만 서므로 실제로는 걸리지 않지만, 되돌릴 곳을 못 찾았을 때
   * 엉뚱한 장소를 넣는 것보다 가만히 있는 편이 안전하다.
   */
  function handleRevert(day: number, order: number) {
    const original = state.baseline?.days[day - 1]?.[order - 1]
    if (original === undefined) {
      return
    }
    replacePlace(day, order - 1, original)
  }

  const crowdedCount = diagnosis
    ? diagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0
  const quietCount = diagnosis
    ? diagnosis.slots.filter((slot) => slot.level === 'QUIET').length
    : 0

  /*
   * 이 화면에서 나가는 두 갈래. 화면 두 곳에 놓지만 정의는 하나다.
   *
   * 좁은 화면에서는 아래에 붙어 따라오고, 넓은 화면에서는 종합 지수 바로 아래에 선다.
   * 자리가 달라 감싸는 것이 다를 뿐 하는 일은 같으므로, 두 번 적어두면
   * 문구나 이동 경로를 고칠 때 한쪽만 바뀐다. 둘 중 하나는 항상 display:none이라
   * 화면에도 보조기술에도 버튼은 한 벌로 보인다.
   *
   * <b>돌아가기를 작게 두는 이유</b>: 이 화면의 목적은 진단 결과를 보고 다음으로 가는 것이다.
   * 두 버튼을 같은 크기로 두면 "어느 쪽이 기본인가"가 흐려져, 매번 읽고 고르게 된다.
   * 되돌아가는 길은 있되 눈에 먼저 걸리지는 않아야 한다.
   *
   * 코스 편집으로 돌아가도 원안(baseline)은 그대로 남는다 — 장소를 더 담고 다시 와도
   * "원안 대비 개선폭"의 기준이 흔들리지 않는다.
   */
  const stepActions = (
    <div className="flex gap-2">
      <button
        type="button"
        className={`${SECONDARY_BUTTON} flex-none px-5`}
        onClick={() => navigate('/course')}
      >
        돌아가기
      </button>
      <button
        type="button"
        className={`${PRIMARY_BUTTON} flex-1`}
        onClick={() => navigate('/result')}
      >
        최종 코스 확인하기
      </button>
    </div>
  )

  return (
    // lg부터 읽기 폭(max-w-read)을 풀어 대시보드 폭으로 넓힌다
    <div className="mx-auto flex w-full max-w-read flex-col gap-4.5 lg:max-w-app">
      {/*
        코스 편집으로 돌아가는 길은 아래 "돌아가기" 하나뿐이다.
        같은 일을 하는 조작이 화면 두 곳에 있으면 어느 쪽이 진짜인지 흔들리고,
        위쪽 링크는 다음 단계 버튼과 멀리 떨어져 있어 짝으로 읽히지도 않았다.
      */}
      <header>
        <h1 className="text-fg text-xl font-bold tracking-tight">진단 결과</h1>
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
            │ 돌아가기 · 최종 코스 확인하기 (바닥에 붙어 따라옴) │
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
          <div className="hidden flex-none lg:block">{stepActions}</div>

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
            {/*
              문구를 화면에서 짓지 않고 서버가 준 문장을 그대로 쓴다. 판단(어느 상태인가)과
              그 판단을 설명하는 말이 갈라지면 기준이 바뀔 때 한쪽만 고쳐진다.
              옮기라고 권하는 상태(RECOMMENDED)일 때는 아래 요약 줄이 개선폭을 말하므로 겹치지 않게 뺀다.
            */}
            {dates && dates.status !== 'RECOMMENDED' && (
              <p className="text-[13px]">{dates.statusMessage}</p>
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
                          {/* 원안 대비 증감. 0이면(=원안 줄) 적을 것이 없고, 자료가 없으면 잴 수 없다 */}
                          {row.improvement !== null && row.improvement !== 0 && (
                            <span
                              className={`text-[11.5px] font-semibold ${
                                row.improvement > 0 ? 'text-quiet-deep' : 'text-crowded-deep'
                              }`}
                            >
                              {row.improvement > 0 ? `+${row.improvement}` : row.improvement}
                            </span>
                          )}
                        </div>

                        {/*
                          막대는 점수를 눈으로 비교하는 장치다. 숫자만 있으면 줄마다 다시 읽어야 한다.
                          자료가 없는 날은 빈 홈으로 남긴다 — 0%짜리 막대를 그리면 "가장 붐빔"으로 읽힌다.
                        */}
                        <div className="bg-line h-2 overflow-hidden rounded-full">
                          {row.quietness !== null && row.level !== null && (
                            <div
                              className={`h-full rounded-full ${LEVEL_SOLID[row.level]}`}
                              style={{ width: `${row.quietness}%` }}
                            />
                          )}
                        </div>
                      </div>

                      <span
                        className={`w-8 flex-none text-right font-mono text-[14.5px] font-semibold ${
                          row.current ? 'text-fg' : ''
                        }`}
                        // 자료가 없는 날은 이유를 손끝에 남긴다. 회색 줄만 보면 왜인지 알 수 없다.
                        title={row.gapMessage ?? undefined}
                      >
                        {/* 빈칸이 아니라 가운뎃점을 둔다. 자리를 지켜야 표의 열이 흔들리지 않는다 */}
                        {row.quietness ?? '·'}
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
            // 진단된 칸만 평균에 넣는다. 음식점을 0으로 세면 밥집을 넣을수록 그 날이 붐벼 보인다.
            const scoredDaySlots = daySlots.filter((slot) => slot.quietness !== null)
            const dayAverage =
              scoredDaySlots.length === 0
                ? null
                : Math.round(
                    scoredDaySlots.reduce((sum, slot) => sum + (slot.quietness ?? 0), 0) /
                      scoredDaySlots.length,
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

                <ol className="flex flex-col gap-2.5">
                  {daySlots.map((slot, index) => {
                    /*
                     * 점수를 지역 상수로 꺼내 쓴다.
                     *
                     * slot.quietness를 그대로 조건에 쓰면 <b>아래 onClick 안에서 좁히기가 풀린다</b> —
                     * 타입스크립트는 객체 속성의 좁히기를 클로저 안까지 유지하지 않는다.
                     * 나중에 실행될 때 값이 바뀌어 있을 수 있어서다. 지역 상수는 그 걱정이 없다.
                     */
                    const quietness = slot.quietness
                    const level = slot.level

                    return (
                    <li
                      key={`${slot.day}-${slot.order}`}
                      className="flex items-start gap-2.5 sm:items-center"
                    >
                      {/*
                        방문 순서. <b>카드 밖 왼쪽</b>에 세운다.

                        사진 위에 얹어 봤더니 두 가지가 걸렸다 — 사진이 밝으면 읽기 어렵고,
                        오른쪽 아래 한적도 배지와 같은 사진 위에서 색 신호가 둘이 되어
                        어느 쪽을 읽어야 할지 흔들렸다.

                        밖으로 빼면 번호들이 세로로 한 줄에 서서 <b>목록의 눈금</b>처럼 읽힌다.

                        색은 등급색이 아니라 <b>브랜드색 하나로 통일</b>한다. 이 번호는 순서를
                        가리키는 눈금이지 혼잡을 알리는 신호가 아니다. 등급을 여기서도 색으로
                        말하면 한 카드 안에 같은 뜻의 색 신호가 둘(번호·배지)이 되어,
                        어느 쪽을 읽어야 할지 흔들린다. 혼잡은 배지와 막대가 맡는다.

                        밝은 틸 위에는 흰 글자가 2.2:1로 안 보인다. 잉크(text-fg)를 얹는다.
                      */}
                      {/*
                        번호와 그 아래로 이어지는 선. 둘이 합쳐 <b>타임라인</b>이 된다.

                        self-stretch로 이 열을 카드 높이만큼 늘리고, 선은 절대 배치로
                        카드 아래(-bottom-2.5 = 목록 간격 10px)까지 내려 다음 번호에 닿게 한다.
                        간격만큼 내리지 않으면 카드 사이에서 선이 끊겨 보인다.

                        마지막 칸에는 선을 두지 않는다 — 이어질 것이 없는데 선이 남으면
                        아래에 무언가 더 있는 것처럼 읽힌다.
                      */}
                      <div className="relative flex-none self-stretch">
                        <span className="bg-surface border-brand text-fg mt-1 grid h-7 w-7 place-items-center rounded-full border-2 font-mono text-[13px] font-semibold sm:mt-0">
                          {slot.order}
                        </span>
                        {index < daySlots.length - 1 && (
                          <span
                            className="bg-line absolute top-9 -bottom-2.5 left-1/2 w-px -translate-x-1/2 sm:top-8"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/*
                        overflow-hidden: 배너 사진이 카드의 둥근 위 모서리에 맞춰 잘린다.
                        좁은 화면에서는 사진이 카드 폭을 가로지르므로 안쪽 여백을 카드가 아니라
                        각 줄이 갖는다. 넓은 화면에서는 예전처럼 한 줄짜리 카드다.
                      */}
                      <div
                        className={`${CARD} flex min-w-0 flex-1 flex-col overflow-hidden sm:flex-row sm:items-center sm:gap-4 sm:p-4.5`}
                      >
                      {/*
                        사진과 그 위에 얹히는 두 표시.

                        좁은 화면에서는 사진이 배너이고 순서 칩과 한적도 배지가 그 위에 뜬다.
                        넓은 화면에서는 sm:contents로 이 상자를 layout에서 없애 셋이 카드의
                        직접 자식이 되고, order로 한 줄에 늘어선다 — 사진을 두 개 두지 않으려는 배치다.
                      */}
                      <div className="relative sm:contents">
                        <PlaceThumbnail
                          name={slot.place.name}
                          imageUrl={slot.place.imageUrl}
                          size="banner"
                          className="sm:order-1"
                        />

                        {/*
                          그 날 몇 번째로 가는 자리인가. 사진 위에 얹으므로 흐린 검정 바탕에
                          흰 글자를 둔다 — 사진이 밝든 어둡든 읽혀야 한다.
                          넓은 화면에서는 예전처럼 등급색 동그라미로 돌아간다.
                        */}
                        {/*
                          한적도 배지. 사진 오른쪽 아래에 얹는다 — 사진과 점수가 한눈에 짝지어진다.
                          진단되지 않은 칸은 배지 대신 사유를 적는다. 배지 자리를 비워두면
                          "아직 불러오는 중"으로 읽히고, 아무 등급이나 넣으면 거짓말이 된다.
                        */}
                        {slot.level !== null && slot.levelLabel !== null && (
                          <span className="absolute right-3 bottom-3 sm:hidden">
                            <CongestionBadge
                              level={slot.level}
                              label={slot.levelLabel}
                              quietness={slot.quietness ?? undefined}
                              size="sm"
                            />
                          </span>
                        )}
                      </div>

                      {/*
                        이름과 분류. 넓은 화면에서는 가운데 열이 되어 남는 폭을 가진다.

                        진단된 칸의 아래 여백은 오른쪽 행동 자리가 갖는다(pb-4). 진단되지 않은
                        칸은 그 자리가 비므로 여기서 직접 갖는다 — 안 그러면 카드 바닥에
                        글자가 붙는다.
                      */}
                      <div
                        className={`flex min-w-0 flex-col gap-0.5 px-4 pt-3.5 sm:order-2 sm:flex-1 sm:px-0 sm:pt-0 sm:pb-0 ${
                          quietness === null || level === null ? 'pb-4' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-fg m-0 text-[17px] font-bold tracking-[-0.01em] sm:text-base sm:font-semibold">
                            {slot.place.name}
                          </p>
                          {isSwapped(slot.day, slot.order, slot.place.id) && (
                            <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                              교체함
                            </span>
                          )}
                        </div>
                        <p className="text-hint m-0 text-[12.5px]">{slot.place.categoryName}</p>

                        {/*
                          진단하지 못한 이유. <b>서버가 문구를 줄 때만</b> 그린다.

                          gap이 아니라 gapMessage가 있는지로 가르는 것이 핵심이다. 음식점·숙박은
                          gap은 있어도 문구가 null로 온다 — 애초에 예측 대상이 아닌 것을 "없다"고
                          알리는 것은 정보가 아니고, 코스에 밥집이 서넛만 있어도 이 줄이 화면을
                          채워 정작 읽어야 할 점수들이 그 사이에 묻힌다.

                          반대로 관광지인데 자료가 없으면 반드시 말한다. 같은 왕릉인데 어떤 곳은
                          점수가 뜨고 어떤 곳은 아무것도 없으면, 사용자는 담는 방법을 잘못 알았다고
                          생각하며 자기 탓을 찾는다.

                          <b>회색으로 조용히 둔다.</b> 경고색을 쓰면 "문제가 생겼다"로 읽히는데,
                          이건 잘못된 상태가 아니라 우리가 아직 매기지 못한 자리일 뿐이다.
                        */}
                        {slot.gapMessage && (
                          <p className="bg-fill text-muted rounded-chip m-0 mt-1.5 w-fit px-2.5 py-1 text-[12px] leading-snug">
                            {slot.gapMessage}
                          </p>
                        )}
                      </div>

                      {/*
                        행동 자리. 좁은 화면에서는 카드 아래를 가로지르는 버튼이고,
                        넓은 화면에서는 오른쪽 끝의 작은 버튼이다.
                      */}
                      <div
                        className={`sm:order-3 sm:flex sm:w-28 sm:flex-none sm:flex-col sm:items-end sm:gap-2 sm:p-0 ${
                          quietness === null || level === null ? '' : 'px-4 pt-3 pb-4'
                        }`}
                      >
                        {/*
                          넓은 화면에서는 배지가 사진에서 내려와 버튼 위에 선다.
                          폭을 고정(w-32)하는 이유는 배지 글자 길이가 등급마다 달라서다 —
                          그대로 두면 카드마다 버튼 시작점이 달라져, 목록을 훑을 때
                          눈이 매번 다른 자리를 찾아야 한다.

                          좁은 화면의 배지와 마크업이 겹치지만 사진과 달리 <b>받아올 것이 없어</b>
                          비용이 없다. 사진은 하나로 두고 order로 옮긴 것과 판단이 다른 이유다.
                        */}
                        {slot.level !== null && slot.levelLabel !== null && (
                          <span className="hidden sm:block">
                            <CongestionBadge
                              level={slot.level}
                              label={slot.levelLabel}
                              quietness={slot.quietness ?? undefined}
                              size="sm"
                            />
                          </span>
                        )}

                        {quietness === null || level === null ? (
                          /*
                            진단되지 않은 자리는 <b>그냥 비워 둔다.</b>

                            버튼을 잠근 채로 두지 않는 이유: 눌리지 않는 버튼은 "지금은 안 되지만
                            언젠가 될 것"으로 읽혀 사용자가 계속 시도한다.

                            사유는 이 자리가 아니라 <b>이름 아래</b>에 적는다. 여기는 폭이 좁아
                            (sm:w-28) 문장이 서너 줄로 접히고, 무엇보다 "왜 점수가 없는지"는
                            장소에 딸린 설명이지 행동이 아니다.
                          */
                          null
                        ) : isSwapped(slot.day, slot.order, slot.place.id) ? (
                          /*
                            되돌리기는 날짜 목록의 원안 줄과 <b>같은 모양</b>이다 —
                            테두리만 있는 조용한 버튼. 이 화면에서 "원래대로"는 늘 이렇게 생겼다.
                          */
                          <button
                            type="button"
                            className="press rounded-ui border-line bg-surface text-fg hover:bg-bg h-11 w-full cursor-pointer border text-sm font-semibold whitespace-nowrap sm:h-9 sm:w-full sm:px-3 sm:text-[13px]"
                            onClick={() => handleRevert(slot.day, slot.order)}
                            aria-label={`${slot.place.name} 되돌리기`}
                          >
                            되돌리기
                          </button>
                        ) : (
                          /*
                            붐비는 곳만 채운 버튼으로 강하게 두고, 나머지는 테두리만 있는
                            조용한 버튼으로 둔다. 모든 카드에 빨간 버튼이 서 있으면
                            경고색이 의미를 잃는다.
                          */
                          <button
                            type="button"
                            className={`press rounded-ui h-11 w-full cursor-pointer text-sm font-semibold whitespace-nowrap sm:h-9 sm:w-full sm:px-3 sm:text-[13px] ${
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
                                quietness,
                                level,
                              })
                            }
                            aria-label={`${slot.place.name} 장소 바꾸기`}
                          >
                            장소 바꾸기
                          </button>
                        )}
                        </div>
                      </div>
                    </li>
                    )
                  })}
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
            {stepActions}
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
          planKey={planKeyOf(plan.region, plan.startDate, plan.nights)}
          onClose={() => setSheet(null)}
          onSelect={handleSelectAlternative}
        />
      )}
    </div>
  )
}
