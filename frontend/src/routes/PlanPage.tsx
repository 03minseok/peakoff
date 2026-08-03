import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CARD_RAISED, FORM_COLUMN, PRIMARY_BUTTON, TEXT_INPUT } from '../components/styles'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import { daysFromToday, formatDateRange, formatKoreanDate, today } from '../utils/date'

/**
 * 당일치기(1일)부터 4일까지.
 *
 * 값은 <b>박 수</b>이고 화면에 보이는 것은 <b>일수</b>다. 서버 요청 필드가 박 수라
 * 여기서 일수로 바꿔 들고 다니면 보낼 때마다 되돌려야 한다. 표기만 다르게 둔다.
 * 1일(0박)은 서버도 이미 받는다 — CourseDiagnosisRequest의 nights가 @Min(0)이다.
 */
const DURATIONS = [
  { nights: 0, label: '1일' },
  { nights: 1, label: '2일' },
  { nights: 2, label: '3일' },
  { nights: 3, label: '4일' },
]

/**
 * 기본 날짜를 일주일 뒤로 둔다.
 *
 * 오늘로 두면 "지금 당장 출발"이라는 비현실적인 기본값이 되고,
 * 비워두면 심사위원이 달력을 열어 고르는 단계가 하나 늘어난다.
 */
const DEFAULT_DAYS_AHEAD = 7

/*
 * 선택 버튼. 라디오 입력을 sr-only로 숨기고 옆의 span을 버튼처럼 꾸민다.
 * peer-checked로 선택 상태를 표현하므로 자바스크립트 상태 분기가 필요 없다.
 *
 * sr-only는 화면에서만 감추고 초점은 살려둔다 — display:none이면 키보드로 못 고른다.
 *
 * 지역은 브랜드색, 기간은 잉크색으로 선택을 표시한다. 두 줄이 같은 색이면
 * 어느 쪽을 고르는 중인지 눈이 헷갈린다.
 */
// 기간은 네 칸이 한 줄에 들어가야 해서 좌우 여백을 좁게 잡는다.
const SEGMENT_BASE =
  'flex h-11 cursor-pointer items-center justify-center rounded-ui px-3 text-[15px] font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand'

const REGION_SEGMENT = `${SEGMENT_BASE} border border-line bg-surface text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-white`

const DURATION_SEGMENT = `${SEGMENT_BASE} border border-line bg-surface text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:font-semibold peer-checked:text-white`

/** 카드 안쪽 제목 줄 */
const CARD_TITLE = 'text-fg text-sm font-semibold'

export function PlanPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, setPlan } = useTrip()

  /*
   * 홈의 "이 날로 코스 짜기"가 실어 보낸 날짜.
   *
   * 전역 상태에 미리 써두지 않고 라우터 state로 넘긴다. 사용자가 아직 아무것도
   * 확정하지 않은 시점이라, 여기서 되돌아 나가면 흔적이 남지 않아야 한다.
   */
  const suggestedDate = (location.state as { startDate?: string } | null)?.startDate

  // 이전에 입력한 값이 있으면 그것부터 보여준다 (뒤로 왔을 때 다시 채우지 않게).
  const [region, setRegion] = useState(state.plan?.region ?? DEFAULT_REGION)
  const [startDate, setStartDate] = useState(
    suggestedDate ?? state.plan?.startDate ?? daysFromToday(DEFAULT_DAYS_AHEAD),
  )
  const [nights, setNights] = useState(state.plan?.nights ?? 1)

  const isPastDate = startDate < today()
  const regionName = REGIONS.find((option) => option.slug === region)?.name ?? ''
  const durationLabel = DURATIONS.find((option) => option.nights === nights)?.label ?? ''

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isPastDate) {
      return
    }
    setPlan({ region, startDate, nights })
    navigate('/course')
  }

  return (
    // 입력 폼은 넓힐수록 오히려 쓰기 어렵다. 껍데기가 넓어져도 본문은 가운데로 모은다.
    <div className={FORM_COLUMN}>
      <section className="flex flex-col gap-3.5 pt-6 pb-7 lg:pt-10">
        <h1 className="text-fg text-[34px] leading-[1.25] font-bold tracking-[-0.025em]">
          붐비는 곳을
          <br />
          피해서 가요
        </h1>
        <p className="min-w-[300px] text-[15.5px] leading-[1.65] text-pretty">
          날짜만 정하면 {regionName}의 각 장소가 그날 얼마나 붐빌지 미리 알려드려요.<br/> 
          가입 없이 바로 시작할 수 있어요.
        </p>
      </section>

      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3.5 border-0 p-4.5`}>
          <div className="flex items-baseline justify-between">
            <legend className={`${CARD_TITLE} p-0`}>어디로 가시나요</legend>
            {REGIONS.length === 1 && (
              <span className="text-hint text-xs">지역 확대 예정</span>
            )}
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

        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3.5 border-0 p-4.5`}>
          <legend className={`${CARD_TITLE} p-0`}>언제 떠나요</legend>
          <input
            type="date"
            className={TEXT_INPUT}
            value={startDate}
            min={today()}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
          {/* 고른 날짜를 요일까지 되읽어준다. 달력 입력만으로는 무슨 요일인지 안 보인다. */}
          <div
            className={`rounded-ui flex items-center gap-2.5 px-3.5 py-3 ${
              isPastDate ? 'bg-crowded-tint' : 'bg-bg'
            }`}
          >
            <span
              className={`h-2 w-2 flex-none rounded-full ${
                isPastDate ? 'bg-crowded' : 'bg-brand'
              }`}
              aria-hidden="true"
            />
            <p
              className={`m-0 text-[12.5px] leading-[1.5] ${
                isPastDate ? 'text-crowded-deep' : ''
              }`}
            >
              {isPastDate ? '오늘 이후 날짜를 골라주세요.' : formatKoreanDate(startDate)}
            </p>
          </div>
        </fieldset>

        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3.5 border-0 p-4.5`}>
          <legend className={`${CARD_TITLE} p-0`}>며칠 머무를까요</legend>
          <div className="flex gap-2">
            {DURATIONS.map((option) => (
              <label key={option.nights} className="flex-1">
                <input
                  type="radio"
                  name="nights"
                  className="peer sr-only"
                  value={option.nights}
                  checked={nights === option.nights}
                  onChange={() => setNights(option.nights)}
                />
                <span className={DURATION_SEGMENT}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/*
          버튼 위에 고른 조건을 한 줄로 되읽어준다. 카드 세 개를 다 채우고 나면
          맨 위 선택이 화면 밖으로 밀려 있어, 누르기 직전에 확인할 자리가 필요하다.

          이 화면에서는 버튼을 따라다니게 두지 않는다. 조건을 고르는 동안 화면 아래를
          계속 덮고 있어 날짜 입력이 가려진다. 목록을 훑어야 하는 편집·진단 화면과 달리
          여기는 세 칸만 채우면 끝이라, 끝까지 내려온 자리에 버튼이 있으면 충분하다.
        */}
        <div className="mt-2 pb-4">
          <div className="flex items-center justify-between px-1 pb-2.5">
            <span className="text-[13px]">
              {regionName} · {durationLabel}
            </span>
            <span className="text-fg font-mono text-[13px] font-medium">
              {formatDateRange(startDate, nights)}
            </span>
          </div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={isPastDate}>
            코스 짜러 가기
          </button>
          <p className="text-hint mt-3 text-center text-xs">
            로그인은 코스를 저장할 때만 필요해요
          </p>
        </div>
      </form>
    </div>
  )
}
