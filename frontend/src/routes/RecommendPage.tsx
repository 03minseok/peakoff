import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CongestionBadge } from '../components/CongestionBadge'
import { ChevronRight } from '../components/icons'
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
import { daysFromToday, formatCompactDate, formatDateRange, formatWeekday, today } from '../utils/date'

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
    // 위 여백을 더 얹지 않는다 — Layout이 이미 준다. /plan과 같은 이유다
    <div className="mx-auto flex w-full max-w-form flex-col gap-3.5 pb-10">
      <header className="flex flex-col gap-2 pb-1">
        <h1 className="text-fg m-0 text-[27px] leading-[1.3] font-bold tracking-[-0.025em]">
          몇 가지만 알려주시면
          <br />
          코스를 짜드릴게요
        </h1>
        <p className="m-0 text-[14.5px] leading-[1.65] text-pretty">
          다니시는 방식에 맞춰 그날 덜 붐빌 {regionName} 코스를 만들어 드려요.
          <br />
          만든 뒤에 직접 고칠 수 있어요.
        </p>
      </header>

      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
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
          <Link
            to="/plan"
            className="text-hint hover:text-muted mt-3 flex items-center justify-center gap-1 text-center text-[13.5px] font-medium no-underline"
          >
            직접 짤래요 <ChevronRight size={14} />
          </Link>
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

  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-3.5 pb-10">
      {/*
        여기는 <b>우연을 재미로 드러내도 되는 자리</b>다. 같은 답을 보내도 매번 다른 코스가
        오는 것이 실제 동작이라, 감추면 오히려 "왜 아까와 다르지?"가 된다.

        ⚠️ 장소 교체 시트(AlternativeSheet)는 반대다. 그쪽에서 "뽑혔어요"라고 말하면
        추천 근거를 함께 펴 놓고도 뽑기처럼 읽혀, "그럼 저 점수는 뭐냐"가 된다.
        같은 분산 로직인데 <b>말투가 갈리는 이유</b>가 이것이다.

        지역 이름은 셋 다 모음으로 끝나(경주·제주시·서귀포시) "가"가 붙는다.
        ⚠️ 자음으로 끝나는 지역을 추가하면 이 조사를 함께 손봐야 한다.
      */}
      <header className="flex flex-col gap-2">
        <span className="bg-brand-tint text-brand-deep w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold">
          오늘의 코스
        </span>
        <h1 className="text-fg m-0 text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
          오늘의 {regionName}가 뽑혔어요!
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
          다른 코스로 다시 뽑기
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

/** 초안 슬롯 한 장. 진단 카드와 같은 리듬으로 두되 추천 근거가 더 붙는다 */
function DraftSlotCard({ slot }: { slot: DraftSlot }) {
  return (
    <li className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex items-start gap-3">
        {/* 순서 번호가 곧 등급 색이다. 목록을 훑으면 붐비는 자리가 먼저 보인다.
            색은 브랜드색 하나로 통일한다. 번호는 순서를 가리키는 눈금이지 혼잡 신호가 아니다 —
            혼잡은 옆의 배지가 맡는다. 밝은 틸 위에는 흰 글자가 안 보여 잉크를 얹는다 */}
        <span
          className="bg-brand text-fg mt-0.5 grid h-6.5 w-6.5 flex-none place-items-center rounded-full font-mono text-[12px] font-semibold"
          aria-hidden="true"
        >
          {slot.order}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-fg text-base font-semibold tracking-[-0.01em]">
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
        </div>

        {/* 이 자리에 이곳을 얼마나 미는가. 한적도가 이미 반영된 값이다 */}
        <div className="flex flex-none flex-col items-end gap-0.5">
          <span className="text-hint text-[11px]">추천도</span>
          <span className="text-brand-deep font-mono text-[22px] leading-none font-semibold">
            {slot.recommendation}
          </span>
        </div>
      </div>

      {/*
        추천 근거. 문장 하나로는 "왜 82점인지"를 설명하지 못해서 항목별 내역을 함께 편다.
        반영 비율은 서버가 준 값을 그대로 쓴다 — 화면에 숫자를 적어두면 가중치가 바뀔 때
        한쪽만 고쳐진다. 대안 추천 시트와 같은 모양으로 둬서 두 화면이 같은 말을 하게 한다.
      */}
      <div className="bg-bg rounded-ui flex flex-col gap-2.5 px-3 py-3">
        <div className="flex items-start gap-2.5">
          <span
            className="bg-quiet-soft/50 text-brand-deep mt-px grid h-4 w-4 flex-none place-items-center rounded-full text-[10px] font-bold"
            aria-hidden="true"
          >
            i
          </span>
          <p className="m-0 text-[12.5px] leading-[1.6] text-pretty">{slot.reason}</p>
        </div>

        {/*
          내역이 없어도 카드는 그려야 한다. 서버와 화면이 따로 배포되는 순간이 있고,
          그때 필드 하나가 비었다고 화면이 하얘지면 안 된다.

          항목 수는 고정이 아니다 — 그 날 첫 장소는 비교 대상이 없어 한적도 하나뿐이고,
          연관 관광지 데이터가 붙으면 하나 는다. 이름을 박지 않고 배열을 그대로 편다.
        */}
        {slot.factors?.length ? (
          <ul className="border-line m-0 flex list-none flex-col gap-2 border-t p-0 pt-2.5">
            {slot.factors.map((factor) => (
              <li key={factor.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-fg text-[12.5px] font-semibold">{factor.label}</span>
                <span className="text-fg font-mono text-[12.5px] font-semibold">
                  {factor.score}
                </span>
                <span className="text-hint text-[11px]">반영 {factor.weightPercent}%</span>
                <span className="text-hint basis-full text-[11.5px]">{factor.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
}
