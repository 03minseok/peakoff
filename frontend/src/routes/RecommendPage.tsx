import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { ListEdgeJump } from '../components/ListEdgeJump'
import { LEVEL_SOLID } from '../components/levelStyles'
import { CARD, CARD_RAISED, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_INPUT } from '../components/styles'
import { DEFAULT_REGION, REGIONS, regionNameOf } from '../constants/regions'
import { ApiRequestError, recommendCourse } from '../services/api'
import { useTrip } from '../state/tripContext'
import type {
  CourseDraft,
  CrowdSensitivity,
  DraftSlot,
  ItineraryDensity,
} from '../types/api'
import {
  daysFromToday,
  formatCompactDate,
  formatDateRange,
  formatWeekday,
  today,
} from '../utils/date'

/**
 * 설문으로 코스를 추천받는 화면.
 *
 * <p>경주를 모르는 사용자의 진입점이다. 나머지 흐름은 "어디를 갈지 이미 아는 사람"만 쓸 수 있다.
 *
 * <p><b>사후 교정이 아니라 사전 분산이다.</b> 붐비는 코스를 짠 뒤 고치라고 하는 대신,
 * 처음부터 덜 붐비는 코스를 쥐여 준다.
 *
 * <h3>왜 결과를 별도 주소로 두지 않는가</h3>
 * 다른 단계는 전부 주소가 따로 있다(/plan → /course → /diagnosis). 그런데 초안은
 * <b>같은 답을 보내도 매번 다른 코스가 온다</b> — 서버가 상위 후보군에서 가중 무작위로 뽑는다.
 * 주소로 다시 열어도 그때 그 코스가 아니므로, 주소를 나눠도 얻는 것이 없다.
 * 대신 "다시 뽑기"를 두어 그 성질을 사용자가 직접 쓸 수 있게 했다.
 *
 * <h3>이 화면에서만 점수를 편다</h3>
 * 초안을 편집 화면으로 넘기면 한적도는 <b>보이지 않는다.</b> 편집 중에 점수를 보여주면
 * "직접 짠 코스"가 아니라 시스템이 유도한 코스가 되어 진단의 의미가 사라진다.
 * 근거를 펴는 자리는 여기 하나뿐이다.
 */

/** 기본 날짜. /plan과 같은 값이어야 두 진입로에서 같은 날이 보인다. */
const DEFAULT_DAYS_AHEAD = 7

const DURATIONS = [
  { nights: 0, label: '1일' },
  { nights: 1, label: '2일' },
  { nights: 2, label: '3일' },
  { nights: 3, label: '4일' },
]

/*
 * 설문 문항.
 *
 * <b>답이 무슨 값을 뜻하는지는 여기 적지 않는다.</b> "여유(하루 2~3곳)"처럼 숫자를 적으면
 * 서버가 범위를 바꿀 때 화면만 거짓말이 된다. 추천도 반영 비율을 화면에 적지 않는 것과 같은
 * 이유다. 실제로 몇 곳이 담겼는지는 결과 화면이 일자별로 보여준다.
 */
const DENSITY_OPTIONS: { value: ItineraryDensity; label: string }[] = [
  { value: 'RELAXED', label: '여유롭게' },
  { value: 'BALANCED', label: '적당히' },
  { value: 'PACKED', label: '알차게' },
]

const SENSITIVITY_OPTIONS: { value: CrowdSensitivity; label: string; hint: string }[] = [
  { value: 'POPULAR', label: '유명한 곳도 좋아요', hint: '대표 명소를 빼지 않아요' },
  { value: 'MIXED', label: '적당히 섞어주세요', hint: '알려진 곳과 한적한 곳을 함께' },
  { value: 'QUIET', label: '한적한 곳 위주로', hint: '붐빌 것으로 보이는 곳은 빼요' },
]

/* /plan의 선택 버튼과 같은 구조다. 라디오를 sr-only로 숨기고 옆의 span을 버튼처럼 꾸민다.
   sr-only는 화면에서만 감추고 초점은 살려둔다 — display:none이면 키보드로 못 고른다. */
const SEGMENT_BASE =
  'flex cursor-pointer items-center justify-center rounded-ui px-3 text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-deep'

/** 한 줄에 나란히 서는 단일 선택 (밀도·기간) */
/*
 * 지역 칸. <b>브랜드색으로 고른 것을 표시한다</b> — 아래 답들(잉크색)과 색을 갈라
 * "어디"와 "어떻게"가 다른 층위임을 눈으로 알린다. 코스 짜기 화면과 같은 규칙이다.
 */
const REGION_SEGMENT = `${SEGMENT_BASE} h-11 border border-line bg-surface text-[15px] font-medium text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-fg`

const SEGMENT = `${SEGMENT_BASE} h-11 border border-line bg-surface text-[15px] font-medium text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:font-semibold peer-checked:text-white`

/**
 * 설명이 함께 붙는 세로 선택 (혼잡 민감도).
 *
 * 한 줄짜리 선택과 달리 <b>브랜드색으로 꽉 채우지 않는다.</b> 밝은 틸 위에서는
 * 둘째 줄의 옅은 설명 글자가 3.5:1까지 떨어져 읽히지 않는다.
 * 옅은 배경(tint)에 진한 테두리(brand-deep)로 선택을 표시해 대비를 지킨다.
 */
const STACKED = `${SEGMENT_BASE} min-h-14 flex-col items-start justify-center gap-0.5 py-2 text-left border border-line bg-surface peer-checked:border-brand-deep peer-checked:bg-brand-tint`

const CARD_TITLE = 'text-fg text-sm font-semibold'

/** 설문 답. 서버에 그대로 실어 보내는 모양이다 */
interface Answers {
  density: ItineraryDensity
  sensitivity: CrowdSensitivity
}

type Phase =
  | { phase: 'survey' }
  | { phase: 'loading' }
  | { phase: 'result'; draft: CourseDraft }
  | { phase: 'error'; message: string }

/** 초안 슬롯을 일차별 장소 ID 배열로 접는다. 편집 흐름(TripState.days)이 쓰는 모양이다. */
function toDays(draft: CourseDraft): string[][] {
  const days: string[][] = Array.from({ length: draft.days }, () => [])
  draft.slots.forEach((slot) => {
    // 서버가 후보를 못 채운 일차는 빈 배열로 남는다. 사용자가 편집 화면에서 채우면 된다.
    days[slot.day - 1]?.push(slot.place.id)
  })
  return days
}

export function RecommendPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, restore } = useTrip()

  /* 홈의 "이 날로 코스 짜기"가 실어 보낸 날짜. /plan과 같은 방식으로 받는다 —
     전역 상태에 미리 쓰지 않아, 되돌아 나가면 흔적이 남지 않는다. */
  const suggestedDate = (location.state as { startDate?: string } | null)?.startDate

  const [startDate, setStartDate] = useState(
    suggestedDate ?? state.plan?.startDate ?? daysFromToday(DEFAULT_DAYS_AHEAD),
  )
  const [nights, setNights] = useState(state.plan?.nights ?? 1)
  const [answers, setAnswers] = useState<Answers>({
    density: 'BALANCED',
    sensitivity: 'QUIET',
  })
  const [view, setView] = useState<Phase>({ phase: 'survey' })

  /*
   * 지역. 코스 짜기에서 이미 고른 적이 있으면 그 값으로 시작한다.
   *
   * 상수가 아니라 상태인 이유: 이 화면은 코스 짜기를 <b>거치지 않고도</b> 들어올 수 있다.
   * 그 경로로 들어온 사람에게 지역이 고정돼 있으면, 경주를 보러 온 것이 아닌데도
   * 경주 코스를 받게 된다.
   */
  const [region, setRegion] = useState(state.plan?.region ?? DEFAULT_REGION)
  const regionName = regionNameOf(region)
  const isPastDate = startDate < today()
  /*
   * 세 문항 모두 기본값이 있어 아무것도 안 눌러도 코스를 받을 수 있다.
   * 남은 잠금 조건은 지난 날짜뿐이다 — 예측이 없는 날은 계산할 것이 없다.
   */
  const canSubmit = !isPastDate

  async function requestDraft() {
    setView({ phase: 'loading' })
    try {
      const draft = await recommendCourse({ region, startDate, nights, ...answers })
      setView({ phase: 'result', draft })
    } catch (error) {
      /* 서버 메시지를 그대로 쓴다. "이 지역에서 예상 혼잡을 계산할 수 있는 장소를 찾지
         못했습니다" 같은 문구는 무엇을 바꾸면 되는지까지 알려주므로,
         화면에서 일반 문구로 덮으면 손해다. */
      const message =
        error instanceof ApiRequestError
          ? error.message
          : '코스를 만들지 못했어요.\n잠시 후 다시 시도해 주세요.'
      setView({ phase: 'error', message })
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    void requestDraft()
  }

  /** 초안을 편집 흐름에 올린다. 여기서부터는 사용자의 코스다 */
  function startEditing(draft: CourseDraft) {
    /*
     * restore를 쓴다. 원안 기준(baseline)이 null로 초기화되는 것이 중요하다 —
     * 초안을 원안이라고 찍어두면 최종 비교가 "시스템이 짠 코스 대비 개선폭"을 재게 된다.
     * 사용자가 편집을 마치고 진단에 들어가는 순간 그 코스가 원안이 된다.
     */
    restore({ region, startDate: draft.startDate, nights: draft.nights }, toDays(draft))
    navigate('/course')
  }

  if (view.phase === 'result') {
    return (
      <DraftResult
        draft={view.draft}
        regionName={regionName}
        onStart={() => startEditing(view.draft)}
        onReroll={() => void requestDraft()}
        onEditAnswers={() => setView({ phase: 'survey' })}
      />
    )
  }

  return (
    /*
      ■ 넓은 화면에서 /plan과 <b>같은 골격</b>이다 — 왼쪽 설명, 오른쪽 입력

      두 진입점은 홈에서 나란히 선 문이라, 들어간 뒤 화면 구조가 다르면 같은 서비스의
      두 갈래로 읽히지 않는다. 격자(12칸)·비율(5:7)·간격(gap-10)·왼쪽 sticky까지
      /plan과 맞췄다.

      폼을 넓히지 않는 이유도 그쪽과 같다. 입력칸은 넓힌다고 고르기 쉬워지지 않고,
      오히려 라벨과 값 사이를 눈이 멀리 오간다. 남는 왼쪽을 설명으로 채운다.

      좁은 화면에서는 지금까지처럼 설명이 폼 위에 오는 한 줄이다.
    */
    <div className="mx-auto w-full max-w-form pb-10 lg:grid lg:max-w-app lg:grid-cols-12 lg:items-start lg:gap-10">
      {/* 폼을 채우는 동안 왼쪽 설명이 따라와 무엇을 하는 화면인지가 계속 남는다 */}
      <section className="flex flex-col gap-3.5 pb-7 lg:sticky lg:top-18 lg:col-span-5 lg:pb-0">
        <h1 className="text-fg m-0 text-[34px] leading-[1.25] font-bold tracking-[-0.025em] lg:text-[40px]">
          어디로 갈지,
          <br />
          같이 발견해볼까요
        </h1>
        {/*
          ⚠️ 글자 크기를 {@code /plan}과 <b>같은 값으로</b> 둔다(제목 34→40, 본문 15.5).
          예전에는 27→34 / 14.5였다. 폼이 가운데 한 줄이던 시절에는 그게 맞았지만,
          좌우 두 칸으로 바꾸면서 두 화면의 제목이 <b>같은 자리에 서게 됐다</b> —
          홈에서 나란히 선 두 문을 지나 들어왔는데 한쪽 제목만 6px 작으면
          한쪽이 곁다리로 읽힌다.

          <h3>⚠️ "오늘의 혼잡도"가 아니라 "그날의 혼잡도"다</h3>
          이 화면은 여행 날짜를 따로 고르게 하고, 코스를 만들 때 보는 것은 <b>그 날짜의
          예측 혼잡도</b>다. 오늘 것이 아니다.

          <p>결과 화면의 "오늘의 경주가 뽑혔어요"는 <b>뽑은 시점</b>을 뜻하므로 그대로 두지만,
          이 문장은 <b>어느 날 데이터를 썼는가</b>에 대한 주장이라 성격이 다르다.
          9월 16일 여행을 만들어 놓고 "오늘의 혼잡도"를 읽으면 화면이 거짓을 말하는 셈이고,
          예측 기반이라는 서비스의 핵심이 그 한 단어에서 무너진다.

          <p>본문은 <b>한 문단 두 줄</b>이다. 문단을 나누면 그 사이 간격만큼 왼쪽이
          길어져 오른쪽 폼과 무게가 어긋난다.

          <p>뒷줄("언제든 바꿀 수 있어요")을 붙여 두는 이유는 이 문이 "정해둔 게 없으니
          맡기겠다"는 사람의 자리라서다 — <b>맡기는 데 따르는 불안을 먼저 덜어야</b>
          답을 고르기 시작한다.

          <p>혼잡 이야기가 이 두 줄에서 빠졌지만 화면에서 사라지지는 않는다 —
          아래 순서도 ②("장소마다 얼마나 붐빌지 함께 보여드려요")와 오른쪽 문항
          ("붐비는 곳은 얼마나 피하고 싶나요?")이 그 자리를 맡는다.
        */}
        <p className="m-0 text-[15.5px] leading-[1.65] text-pretty">
          몇 가지 설문으로 새로운 여행 코스를 찾아드릴게요.
          <br />
          마음에 들지 않는 곳은 언제든 바꿀 수 있어요.
        </p>

        {/*
          반대편 문으로 가는 길. /plan이 이쪽으로 보내는 링크를 갖고 있으므로
          <b>이쪽도 같은 자리에 마주 두어야</b> 두 문이 서로를 가리킨다.
          예전에는 폼 맨 아래에 있어서, 답을 다 채운 뒤에야 "직접 짤 수도 있구나"를 알았다.
        */}
        <Link
          to="/plan"
          className="text-brand-deep -mx-1 w-fit rounded-chip px-1 py-0.5 text-[13.5px] font-semibold no-underline hover:underline"
        >
          가고 싶은 곳이 있다면? 직접 코스 짜기
        </Link>

        {/*
          넓은 화면에서만 편다. 좁은 화면에서는 이 세 줄을 읽느라 정작 입력칸이
          화면 밖으로 밀려난다 — 여기서 할 일은 읽는 것이 아니라 고르는 것이다.
          {@code /plan}과 같은 규칙이다.

          ⚠️ <b>위 본문과 다른 것을 말한다.</b> 본문은 우리가 무엇을 보고 무엇을 주는가이고,
          이 목록은 <b>다음에 벌어지는 순서</b>다. 한때 "답하면 돼요 → 찾아드려요 →
          고칠 수 있어요"였는데 그건 본문을 두 번 적은 것이었다.

          내용은 실제 결과 화면이 하는 일 그대로다 — 코스가 나오고, 장소마다 한적도가
          붙고, 마음에 안 들면 다시 뽑는다("다른 코스도 발견하기").
        */}
        <ol className="mt-3 hidden list-none flex-col gap-4 p-0 lg:flex">
          {[
            '두 문항에 답하면 코스가 나와요',
            '장소마다 얼마나 붐빌지 함께 보여드려요',
            '마음에 들 때까지 다시 찾아봐요',
          ].map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span
                className="bg-brand-tint text-brand-deep grid h-7 w-7 flex-none place-items-center rounded-full font-mono text-[13px] font-semibold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="text-muted text-[14px] leading-[1.5]">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <form className="flex flex-col gap-3.5 lg:col-span-7" onSubmit={handleSubmit}>
        {/*
          지역이 맨 앞에 오는 이유: 뒤의 답들이 전부 <b>그 지역 안에서</b> 어떻게 다닐지다.
          "한적한 곳 위주로"를 고른 뒤에 지역을 바꾸면 앞의 답을 다시 읽어야 한다.
          코스 짜기 화면도 지역을 첫 칸에 두고 있어 두 화면의 순서가 맞는다.
        */}
        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3.5 border-0 p-4.5`}>
          <div>
            <legend className={`${CARD_TITLE} p-0`}>어디로 가시나요</legend>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {REGIONS.map((option) => (
              <label key={option.slug}>
                <input
                  type="radio"
                  name="region"
                  className="peer sr-only"
                  value={option.slug}
                  checked={region === option.slug}
                  onChange={() => setRegion(option.slug)}
                />
                <span className={REGION_SEGMENT}>{option.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/*
          "어떤 곳을 좋아하세요"(여행 스타일)를 2026-08-27에 걷어냈다.

          역사·자연·문화 셋 중 고르게 했는데, 하나만 고르면 후보가 통째로 쪼그라들었다 —
          제주시에서 역사만 고르면 3곳, 서귀포는 2곳이다. 네댓 칸을 채워야 하는 코스가
          거기서 이미 막혔다.

          지금은 서버가 코스에 어울리지 않는 것만 빼고(음식점·숙박·축제·리조트) 나머지에서
          가중 무작위로 뽑는다. 남은 세 문항은 전부 "어떻게 다닐지"를 묻는 것이라
          화면의 성격도 한 갈래로 모였다.
        */}
        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3 border-0 p-4.5`}>
          {/*
            legend를 div로 감싼다. 감싸지 않으면 브라우저가 legend를 fieldset 테두리 위로
            끌어올려 배치해서, border-0인 카드에서는 제목만 박스 밖으로 삐져나온다.
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>오늘은 어떤 템포로 떠나볼까요?</legend>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DENSITY_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="density"
                  className="peer sr-only"
                  checked={answers.density === option.value}
                  onChange={() => setAnswers((prev) => ({ ...prev, density: option.value }))}
                />
                <span className={SEGMENT}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3 border-0 p-4.5`}>
          {/*
            legend를 div로 감싼다. 감싸지 않으면 브라우저가 legend를 fieldset 테두리 위로
            끌어올려 배치해서, border-0인 카드에서는 제목만 박스 밖으로 삐져나온다.
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>붐비는 곳은 얼마나 피하고 싶나요?</legend>
          </div>
          <div className="flex flex-col gap-2">
            {SENSITIVITY_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="sensitivity"
                  className="peer sr-only"
                  checked={answers.sensitivity === option.value}
                  onChange={() => setAnswers((prev) => ({ ...prev, sensitivity: option.value }))}
                />
                <span className={STACKED}>
                  <span className="text-fg text-[14.5px] font-semibold">{option.label}</span>
                  <span className="text-hint text-[11.5px]">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {/*
            서비스가 무엇을 하는 곳인지 밝히는 한 줄이다. "유명한 곳도 좋아요"를 골라도
            붐비는 곳만으로 채워지지 않는데, 말해두지 않으면 고장으로 읽힌다.
          */}
          <p className="text-hint m-0 text-[12px] leading-[1.6]">
            어떤 답을 골라도 붐빌 것으로 예측되는 곳만으로 채우지는 않아요.
          </p>
        </fieldset>

        {/*
          "어떻게 이동하세요"(자차/대중교통)를 2026-08-27에 걷어냈다.

          이 답이 후보 반경을 정했는데, 대중교통(8km)을 고르면 후보가 다시 크게 잘렸다 —
          여행 스타일과 같은 증상이다. 거리 제한은 남기되 넉넉한 쪽 하나로 고정했다
          (CourseDraftService.DAY_RADIUS_KM).

          설문에서 무언가를 고르게 하려면 어느 답을 골라도 코스가 나와야 한다.
          고른 대가로 결과가 비는 문항은 선택지가 아니라 함정이다.
        */}
        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3 border-0 p-4.5`}>
          {/*
            legend를 div로 감싼다. 감싸지 않으면 브라우저가 legend를 fieldset 테두리 위로
            끌어올려 배치해서, border-0인 카드에서는 제목만 박스 밖으로 삐져나온다.
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>언제 며칠 가세요</legend>
          </div>
          <input
            type="date"
            className={TEXT_INPUT}
            value={startDate}
            min={today()}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((option) => (
              <label key={option.nights}>
                <input
                  type="radio"
                  name="nights"
                  className="peer sr-only"
                  checked={nights === option.nights}
                  onChange={() => setNights(option.nights)}
                />
                <span className={SEGMENT}>{option.label}</span>
              </label>
            ))}
          </div>
          {isPastDate && (
            <p className="text-crowded-deep m-0 text-[12.5px]">오늘 이후 날짜를 골라주세요.</p>
          )}
        </fieldset>

        {view.phase === 'error' && (
          <p className="bg-crowded-tint text-crowded-deep rounded-ui m-0 px-4 py-3 text-[13px] leading-[1.6] whitespace-pre-line">
            {view.message}
          </p>
        )}

        <div className="mt-2 pb-4">
          <div className="flex items-center justify-between px-1 pb-2.5">
            <span className="text-[13px]">{regionName}</span>
            <span className="text-fg font-mono text-[13px] font-medium">
              {formatDateRange(startDate, nights)}
            </span>
          </div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={!canSubmit || view.phase === 'loading'}>
            {view.phase === 'loading' ? '코스를 짜는 중…' : '오늘의 여행 발견하기'}
          </button>
          {/*
            "직접 짤래요"는 <b>왼쪽 설명으로 옮겼다.</b> /plan이 반대편 링크를 그 자리에
            두고 있어 두 화면이 마주 보게 된다. 여기 두면 답을 다 채운 뒤에야
            다른 길이 있다는 것을 알게 된다.

            좁은 화면에서는 왼쪽 설명이 폼 위에 오므로 그때도 먼저 보인다.
          */}
        </div>
      </form>
    </div>
  )
}

interface ResultProps {
  draft: CourseDraft
  regionName: string
  onStart: () => void
  onReroll: () => void
  onEditAnswers: () => void
}

/**
 * 초안 미리보기.
 *
 * <p>슬롯마다 <b>왜 이곳인지</b>를 편다. 근거 없는 추천을 만들지 않는다는 원칙이
 * 화면에서 지켜지는 자리이고, 데이터 활용을 증명하는 장치이기도 하다.
 */
function DraftResult({ draft, regionName, onStart, onReroll, onEditAnswers }: ResultProps) {
  // 일차별로 끊어 그린다. 서버가 일차·순서대로 내려주므로 다시 정렬하지 않는다.
  const dayNumbers = Array.from({ length: draft.days }, (_, index) => index + 1)

  /*
    지도에 넘길 것들. 같은 곳이 여러 날에 담길 수 있어 <b>id로 한 번 걸러</b> 넘긴다 —
    마커가 겹쳐 쌓이면 지도에서 한 곳이 여러 번 찍힌 것처럼 보인다.
  */
  const mapPlaces = useMemo(() => {
    const seen = new Set<string>()
    return draft.slots
      .map((slot) => slot.place)
      .filter((place) => (seen.has(place.id) ? false : (seen.add(place.id), true)))
  }, [draft.slots])

  /* 일차별 방문 순서. 배열이 여럿이면 CourseMap이 마커를 "2-1"처럼 매긴다 */
  const mapRoutes = useMemo(
    () =>
      Array.from({ length: draft.days }, (_, index) =>
        draft.slots
          .filter((slot) => slot.day === index + 1)
          .sort((a, b) => a.order - b.order)
          .map((slot) => slot.place.id),
      ),
    [draft.slots, draft.days],
  )

  const mapLevels = useMemo(
    () => Object.fromEntries(draft.slots.map((slot) => [slot.place.id, slot.level])),
    [draft.slots],
  )

  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-3.5 pb-10">
      {/*
        같은 답을 보내도 매번 다른 코스가 온다. 그 우연을 <b>여기서만 드러낸다.</b>
        숨기면 "왜 아까랑 다르지?" 하고 혼란스러워하므로 드러내는 편이 정직하고,
        기능 성격상으로도 "정해둔 게 없으니 맡기겠다"는 사용자의 자리다.

        <h3>⚠️ 선이 있다 — "운으로 뽑았다"가 아니라 "운이 섞였다"</h3>
        <pre>
        허용   "오늘의 경주가 뽑혔어요"  "매번 다른 코스가 나와요"
        금지   "완전히 랜덤으로 골랐어요"  "운에 맡기세요"
        </pre>
        앞은 <b>결과가 다양하다</b>는 말이고 뒤는 <b>기준이 없다</b>는 말이다. 우리는 취향
        (밀도·민감도)과 한적도로 후보를 거른 뒤 그 안에서 뽑으므로, 우연을 말하되
        기준이 있다는 것이 함께 읽혀야 한다.

        <p><b>제목이 앞 화면의 약속을 그대로 이행한다.</b> 설문 화면이 "몇 가지 설문으로
        <b>새로운</b> 여행 코스를 찾아드릴게요"라고 했고, 여기서 "<b>새로운</b> 경주를
        발견했어요"라고 받는다. <b>같은 낱말이 두 화면을 잇는 것이 요점이다</b> —
        한쪽만 다른 말로 바꾸면 약속과 이행이 서로를 가리키지 않는다.

        <p>둘째 줄이 <b>근거</b>다("취향은 챙기고, 붐빔은 살짝 비켜간"). 제목이 무엇을
        받았는지 말하고 부제가 어떻게 골랐는지 말한다. <b>둘째 줄을 지우지 말 것</b> —
        지우면 "발견"이 어디서 왔는지가 사라진다.

        <p>매번 다르다는 것은 제목이 지지 않아도 된다. 아래 "다른 코스도 발견하기"
        버튼이 <b>이게 전부가 아니다</b>를 이미 말한다.

        <p>⚠️ 한때 "오늘의 경주가 뽑혔어요!"였다. <b>오늘이 아니다</b> — 여행 날짜는
        사용자가 따로 고르고 대개 미래 날짜다. 홈에는 진짜 "오늘의 경주"(오늘의 혼잡)가
        따로 있어, 한 서비스에서 같은 말이 두 뜻으로 쓰이게 된다.

        <p>⚠️ <b>대안 시트(장소 교체)에는 이 말투를 쓰지 않는다.</b> 그쪽은 사용자가 이미
        고른 곳을 대신할 것을 찾는 자리라 "이걸 왜 추천했나"에 답이 있어야 하고, 바로 아래
        추천도와 반영 비율을 편다. 거기서 운을 강조하면 그 숫자가 구색이 된다.

        <p>지역 이름은 셋 다 모음으로 끝나(경주·제주시·서귀포시) "를"이 붙는다.
        ⚠️ 자음으로 끝나는 지역을 추가하면 이 조사를 함께 손봐야 한다.
      */}
      <header className="flex flex-col gap-2">
        {/*
          ■ 기능 이름을 세운다 — 진단 화면의 TIME OFF·PLACE OFF와 같은 모양

          FULL PEAKOFF는 <b>브랜드명(PEAK OFF)과 이어져 있어</b> 헤더 로고가 뜻을 받쳐 준다.
          "PEAK OFF를 통째로"로 읽히므로 처음 보는 사람도 기댈 데가 있고,
          세 이름이 한 가족으로 선다 — 날짜는 TIME OFF, 장소는 PLACE OFF, 코스 전체는 여기.

          ⚠️ "오늘의 코스"였다가 고쳤다. <b>오늘이 아니다</b> — 여행 날짜는 사용자가 따로
          고르고, 예측 창이 앞으로 24~29일이라 대개 미래 날짜다. 알약(pill) 모양도
          걷어냈다. 진단 화면의 두 이름과 같은 자리에 서는 말이라 모양도 같아야 한다.

          ⚠️ <b>홈에는 붙이지 않는다.</b> 처음 온 사람이 서는 자리라 내부 용어를 두면
          진입 문턱만 올라간다.
        */}
        <span className="text-brand-deep text-[12px] font-semibold tracking-[0.04em]">
          FULL PEAKOFF
        </span>
        <h1 className="text-fg m-0 text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
          새로운 {regionName}를 발견했어요
        </h1>
        <p className="text-muted m-0 text-[14px] leading-[1.6] text-pretty">
          취향은 챙기고, 붐빔은 살짝 비켜간 코스예요.
        </p>
      </header>

      {/* 코스 총점. 슬롯 한적도의 평균이고 추천도가 섞이지 않는다 */}
      <section className={`${CARD_RAISED} flex items-center justify-between gap-3 p-4.5`}>
        <div className="flex flex-col gap-1">
          <span className="text-hint text-[12px]">코스 전체 한적 지수</span>
          <div className="flex items-baseline gap-2">
            <span className="text-fg font-mono text-[30px] leading-none font-semibold">
              {draft.totalQuietness}
            </span>
            <CongestionBadge
              level={draft.totalLevel}
              label={draft.totalLevelLabel}
              size="sm"
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-fg font-mono text-[13px] font-medium">
            {formatDateRange(draft.startDate, draft.nights)}
          </span>
          <span className="text-hint text-[12px]">{draft.slots.length}곳</span>
        </div>
      </section>

      {/*
        ■ 코스를 지도로 편다

        목록만으로는 <b>얼마나 흩어져 있는지</b>가 안 보인다. 설문으로 받은 코스는
        사용자가 고른 곳이 아니라서 "이게 다닐 만한 동선인가"가 첫 질문인데,
        그 답은 줄글이 아니라 지도가 한다.

        진단·결과 화면과 <b>같은 컴포넌트</b>를 쓴다. 마커 번호 매기기(여러 날이면
        "2-1"), 등급 색, 지도 키가 없을 때의 대체 화면이 이미 그 안에 있다 —
        화면마다 따로 그리면 같은 코스가 화면마다 달리 보인다.

        ⚠️ {@code useMemo}가 필수다. 매 렌더 새 배열을 만들면 CourseMap의 다시 그리기
        effect가 값이 그대로인데도 매번 돌아 마커를 지웠다 다시 만든다.
      */}
      <section className={`${CARD_RAISED} flex flex-col gap-3 p-4.5`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-fg m-0 text-[15px] font-semibold">코스 지도</h2>
          {draft.days > 1 && (
            <span className="text-hint text-[12px]">마커 번호는 “일차-순서”예요</span>
          )}
        </div>

        <CourseMap places={mapPlaces} routes={mapRoutes} levels={mapLevels} />

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
        </div>
      </section>

      {/* 긴 목록의 양 끝을 잇는다. 진단 화면과 같은 장치 — 이유는 ListEdgeJump 주석에 */}
      <div id="draft-top" className="scroll-mt-20" />

      {dayNumbers.map((day) => {
        const slots = draft.slots.filter((slot) => slot.day === day)
        const visitDate = slots[0]?.visitDate

        return (
          <section key={day} className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="text-fg m-0 text-[15px] font-semibold">{day}일차</h2>
              {visitDate && (
                <span className="text-hint text-[12.5px]">
                  {formatCompactDate(visitDate)} {formatWeekday(visitDate)} · {slots.length}곳
                </span>
              )}
              {/*
                "코스 끝으로"는 <b>1일차 줄에만</b> 얹는다. 일차마다 두면 스크롤할 때
                같은 버튼이 반복해 나타나 목록의 리듬을 끊는다. 목록이 시작되는 그 줄이
                한 번 눌러 끝으로 갈 자리다.
              */}
              {day === 1 && (
                <span className="ml-auto">
                  <ListEdgeJump targetId="draft-bottom" direction="down" label="코스" />
                </span>
              )}
            </div>

            {/*
              후보가 모자라 비는 일차가 나올 수 있다. 억지로 채우는 대신 빈 자리라고 말하고
              사용자가 편집 화면에서 채우게 둔다 — 조건에 안 맞는 곳을 끼워 넣는 것보다 낫다.
            */}
            {slots.length === 0 ? (
              <p className={`${CARD} m-0 px-4 py-3.5 text-[13px] leading-[1.6]`}>
                이 날은 조건에 맞는 곳을 더 찾지 못했어요.
                <br />
                다음 화면에서 직접 담아보세요.
              </p>
            ) : (
              /*
                키를 day-order로 만든다. 장소 id만 쓰면 여러 날에 같은 곳이 담겼을 때
                키가 겹쳐 React가 항목을 복제하거나 잃는다 — 코스 편집에서 실제로 겪은 결함이다.
                서버가 day와 order를 주므로 그 짝이 이미 고유하다.
              */
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {slots.map((slot) => (
                  <DraftSlotCard key={`${slot.day}-${slot.order}`} slot={slot} />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <div className="flex justify-end px-1">
        <ListEdgeJump targetId="draft-top" direction="up" label="코스" />
      </div>
      <div id="draft-bottom" className="scroll-mt-20" />

      <div className="mt-2 flex flex-col gap-2.5 pb-4">
        <button type="button" className={PRIMARY_BUTTON} onClick={onStart}>
          이 코스로 시작하기
        </button>
        {/*
          같은 답으로 다시 부르면 다른 코스가 온다. 서버가 상위 후보군에서 가중 무작위로
          뽑기 때문이다 — 모든 사용자에게 같은 곳을 추천하면 그곳이 새로운 혼잡지가 된다.
          그 성질을 숨기지 않고 버튼으로 내놓는다.
        */}
        <button type="button" className={SECONDARY_BUTTON} onClick={onReroll}>
          다른 코스도 발견하기
        </button>
        <button
          type="button"
          className="text-hint hover:text-muted h-11 cursor-pointer bg-transparent text-[13.5px] font-medium"
          onClick={onEditAnswers}
        >
          답변 다시 고르기
        </button>
      </div>
    </div>
  )
}

/**
 * 초안 슬롯 한 장.
 *
 * <h3>⚠️ 추천도를 두지 않는다 (2026-08-29)</h3>
 * 예전에는 오른쪽에 추천도(22px)와 그 아래 항목별 구성 내역을 펴 두었다. 걷어낸 이유는
 * <b>추천도가 이 화면의 값이 아니기 때문</b>이다.
 *
 * <p>CLAUDE.md의 정의대로 추천도는 <b>"그곳을 대안으로 얼마나 미는가"</b>이고,
 * 원래 장소가 있어야 성립하는 <b>관계값</b>이다. 여기 담긴 곳들은 대체된 것이 아니라
 * 설문 답으로 처음부터 고른 것이라, 무엇에 대한 대안인지가 없다.
 *
 * <p>추천도 구성 내역(데이터 활용을 증명하는 장치)은 <b>대안 시트가 그대로 들고 있다</b>.
 * 그쪽은 원래 장소가 있어 관계값이 성립하는 유일한 자리다.
 *
 * <p>남긴 것: 순서 번호 · 이름 · 분류 · <b>한적도 배지</b>. 한적도는 관계값이 아니라
 * 원본 지표라 장소와 날짜만 있으면 성립하므로 어디서든 말할 수 있다.
 * 근거 문장도 남긴다 — 그 곳이 왜 이 코스에 들어왔는지는 여전히 말해야 한다.
 */
function DraftSlotCard({ slot }: { slot: DraftSlot }) {
  return (
    /*
      ⚠️ 세로로 조인 카드다. 예전에는 바깥이 flex-col(gap-2.5·p-4)이고 근거 문장이
      들여쓴 문단으로 한 줄 더 내려와, 한 장이 화면의 상당 부분을 먹었다.
      담긴 곳이 5~8곳이면 그것만으로 스크롤이 길어진다.

      지금은 번호와 본문이 한 줄로 나란히 서고 안쪽만 촘촘하다(p-3.5·gap-1).
    */
    <li className={`${CARD} flex items-start gap-3 p-3.5`}>
      {/* 순서 번호는 눈금이다. 혼잡 신호는 옆의 배지가 맡으므로 색은 브랜드색 하나로
          통일한다. 밝은 틸 위에는 흰 글자가 안 보여 잉크를 얹는다 */}
      <span
        className="bg-brand text-fg mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full font-mono text-[11.5px] font-semibold"
        aria-hidden="true"
      >
        {slot.order}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-fg text-[15px] font-semibold tracking-[-0.01em]">
          {slot.place.name}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-hint text-[12.5px]">{slot.place.categoryName}</span>
          <CongestionBadge
            level={slot.level}
            label={slot.levelLabel}
            quietness={slot.quietness}
            size="sm"
          />
        </div>

        {/*
          근거 문장. 이제 <b>앞 장소에서의 거리</b>만 담는다 — 분류와 한적도는 바로 위
          줄이 이미 말하고 있어서, 서버 문구에서 걷어냈다(CourseDraftService.reasonFor).

          그 날 <b>첫 장소는 null</b>이다. 앞에 놓인 것이 없어 잴 거리가 없다.
        */}
        {slot.reason && (
          <span className="text-hint text-[11.5px]">{slot.reason}</span>
        )}
      </div>
    </li>
  )
}
