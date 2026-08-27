import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CARD_RAISED, PRIMARY_BUTTON, TEXT_INPUT } from '../components/styles'
import { DEFAULT_REGION, REGIONS, regionNameOf } from '../constants/regions'
import { fetchForecastWindow } from '../services/api'
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
  // 초점링은 brand-deep이다. brand(틸)는 흰 카드 위에서 2.2:1이라 링으로는 보이지 않는다
  'flex h-11 cursor-pointer items-center justify-center rounded-ui px-3 text-[15px] font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-deep'

const REGION_SEGMENT = `${SEGMENT_BASE} border border-line bg-surface text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-fg`

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

  /*
   * 예측이 닿는 마지막 날. 서버가 준다 — 상수로 박으면 공사가 창을 늘려도 안 따라간다.
   *
   * 실패하거나 목업으로 도는 동안에는 null이고, 그때는 안내를 그리지 않는다.
   * 없는 제약을 설명하는 것보다 조용한 편이 낫다.
   */
  const [forecastEnd, setForecastEnd] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchForecastWindow(controller.signal)
      .then((window) => setForecastEnd(window.lastDate))
      .catch(() => setForecastEnd(null))
    return () => controller.abort()
  }, [])

  /**
   * 고른 날짜가 예측 창 밖인가.
   *
   * <p><b>막지 않는다.</b> 여행은 원래 미리 계획하는 것이라, 두 달 뒤를 짜려는 사람을
   * 날짜 입력에서 튕겨내면 그 사람은 서비스를 쓸 수 없다. 코스는 짜 두고 여행이
   * 가까워지면 다시 진단하면 된다 — 서버도 그때를 위해 "아직 예측이 나오지 않은 날짜"라는
   * 사유를 따로 갖고 있다(기다려도 안 생기는 사유와 갈라 두었다).
   *
   * <p>대신 <b>여기서 미리 말한다.</b> 이 안내가 없으면 코스를 다 짜고 진단 버튼을 누른
   * 뒤에야 회색 화면을 만난다. 되돌리기에 늦은 자리다.
   */
  const beyondForecast = forecastEnd !== null && !isPastDate && startDate > forecastEnd
  const regionName = regionNameOf(region)
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
    /*
      입력 폼은 넓힐수록 오히려 쓰기 어렵다. 그래서 <b>폼은 넓히지 않고</b>, 넓은 화면에서
      남는 왼쪽을 설명으로 채운다. 입력칸을 1180px까지 늘리는 것보다 이쪽이 낫다 —
      칸이 넓다고 고르기 쉬워지지 않고, 눈은 오히려 라벨과 값 사이를 멀리 오간다.

      좁은 화면에서는 지금까지처럼 설명이 폼 위에 오는 한 줄이다.
    */
    <div className="mx-auto w-full max-w-form lg:grid lg:max-w-app lg:grid-cols-12 lg:items-start lg:gap-10">
      {/* 폼을 채우는 동안 왼쪽 설명이 따라와 무엇을 하는 화면인지가 계속 남는다 */}
      {/*
        위 여백을 여기서 더 얹지 않는다. Layout이 이미 본문 위 여백(pt-6/lg:pt-8)을 주는데
        그 위에 pt-6/lg:pt-10을 또 쌓으니, 홈에서 넘어오는 순간 내용이 훅 내려앉았다 —
        화면마다 헤더~첫 내용 거리가 다르면 이동할 때마다 시선이 다시 자리를 찾는다.
      */}
      <section className="flex flex-col gap-3.5 pb-7 lg:sticky lg:top-18 lg:col-span-5 lg:pb-0">
        <h1 className="text-fg text-[34px] leading-[1.25] font-bold tracking-[-0.025em] lg:text-[40px]">
          붐비는 곳을
          <br />
          피해서 가요
        </h1>
        {/*
          min-w를 걸지 않는다. 폭을 강제하면 화면이 그보다 좁을 때 문단이 밖으로 삐져나가
          페이지 전체에 가로 스크롤이 생긴다. 줄바꿈은 text-pretty에 맡긴다.
        */}
        <p className="text-[15.5px] leading-[1.65] text-pretty">
          날짜만 정하면 각 장소가 그날 얼마나 붐빌지 미리 알려드려요.
          <br />
          가입 없이 바로 시작할 수 있어요.
        </p>

        {/*
          지역을 모르는 사람의 갈림길. 서비스 흐름 1단계가 이 갈래를 약속한다 —
          여기 없으면 홈을 지나쳐 들어온 사람은 30개 목록 앞에서 처음 막힌다.
          조용한 링크로 둔다. 이 화면의 주인공은 직접 짜는 흐름이다.
        */}
        <Link
          to="/recommend"
          className="text-brand-deep -mx-1 w-fit rounded-chip px-1 py-0.5 text-[13.5px] font-semibold no-underline hover:underline"
        >
          여행지가 안 정해졌다면? 몇 가지 답하고 코스 추천받기
        </Link>

        {/*
          넓은 화면에서만 편다. 좁은 화면에서는 이 세 줄을 읽느라 정작 입력칸이
          화면 밖으로 밀려난다 — 여기서 할 일은 읽는 것이 아니라 고르는 것이다.

          내용은 실제 다음 화면들이 하는 일 그대로다. 없는 기능을 약속하지 않는다.
        */}
        <ol className="mt-3 hidden list-none flex-col gap-4 p-0 lg:flex">
          {[
            '지도에서 갈 곳을 순서대로 담아요',
            '날짜별로 얼마나 붐빌지 계산해요',
            '붐비는 곳은 한적한 대안으로 바꿔요',
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
          {/*
            legend를 div로 한 겹 감싼다.

            감싸지 않으면 브라우저가 legend를 <b>fieldset 테두리 위로 끌어올려</b> 특별하게 배치한다.
            border-0이라 테두리는 안 보이는데 글자만 카드 밖으로 삐져나와, 제목이 박스에서
            떨어져 보인다. div 안에 넣으면 평범한 블록으로 흘러 카드 안에 자리를 잡는다.
            (같은 이유로 "어디로 가시나요"는 처음부터 감싸져 있었다)
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>언제 떠나요</legend>
          </div>
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

          {/*
            예측 창 밖이라고 <b>막지 않는다.</b> 색도 경고(붐빔)가 아니라 보통(앰버)이다 —
            무언가 잘못됐다는 뜻이 아니라 "지금은 아직"이라는 뜻이라서다.

            마지막 날을 문장에 그대로 적는다. "예측 범위를 벗어났어요"만으로는
            사용자가 언제로 옮겨야 할지 모른다.
          */}
          {beyondForecast && (
            <div className="bg-moderate-tint rounded-ui flex items-start gap-2.5 px-3.5 py-3">
              <span
                className="bg-moderate mt-1.5 h-2 w-2 flex-none rounded-full"
                aria-hidden="true"
              />
              <p className="text-moderate-deep m-0 text-[12.5px] leading-[1.6]">
                예상 혼잡은 <strong className="font-semibold">
                  {formatKoreanDate(forecastEnd!)}
                </strong>까지만 나와 있어요.
                <br />
                이 날짜로도 코스를 짤 수 있지만 지금은 혼잡 진단이 비어 나와요 —
                여행이 가까워지면 다시 진단할 수 있어요.
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className={`${CARD_RAISED} m-0 flex flex-col gap-3.5 border-0 p-4.5`}>
          {/*
            legend를 div로 한 겹 감싼다.

            감싸지 않으면 브라우저가 legend를 <b>fieldset 테두리 위로 끌어올려</b> 특별하게 배치한다.
            border-0이라 테두리는 안 보이는데 글자만 카드 밖으로 삐져나와, 제목이 박스에서
            떨어져 보인다. div 안에 넣으면 평범한 블록으로 흘러 카드 안에 자리를 잡는다.
            (같은 이유로 "어디로 가시나요"는 처음부터 감싸져 있었다)
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>며칠 머무를까요</legend>
          </div>
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
