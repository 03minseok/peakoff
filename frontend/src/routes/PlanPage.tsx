import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CARD_RAISED, PRIMARY_BUTTON } from '../components/styles'
import { DatePicker } from '../components/DatePicker'
import { RegionPicker } from '../components/RegionPicker'
import { regionNameOf } from '../constants/regions'
import { fetchForecastWindow } from '../services/api'
import { useTrip } from '../state/tripContext'
import { formatDateRange, formatKoreanDate, today } from '../utils/date'

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


const DURATION_SEGMENT = `${SEGMENT_BASE} border border-line bg-surface text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:font-semibold peer-checked:text-white`

/** 카드 안쪽 제목 줄 */
const CARD_TITLE = 'text-fg text-sm font-semibold'

export function PlanPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setPlan } = useTrip()

  /*
   * 홈이 실어 보낸 것.
   *
   * 전역 상태에 미리 써두지 않고 라우터 state로 넘긴다. 사용자가 아직 아무것도
   * 확정하지 않은 시점이라, 여기서 되돌아 나가면 흔적이 남지 않아야 한다.
   *
   * <p>{@code seedPlaceId}는 <b>여기서 쓰지 않고 편집 화면으로 그대로 넘긴다.</b>
   * "이 장소로 여행가기"로 들어온 사람의 그 장소다. 이 화면이 담아 버리면
   * 조건을 고치는 동안 이미 코스가 있는 셈이 되고, {@code setPlan}이 장소를 비우므로
   * 어차피 지워진다 — 담는 일은 담을 화면이 한다.
   */
  const handoff = location.state as
    | { startDate?: string; region?: string; seedPlaceId?: string }
    | null
  const suggestedDate = handoff?.startDate

  /*
   * 지역은 <b>비워 두고 시작한다.</b> 이전에 고른 적이 있으면 그것부터 보여준다
   * (뒤로 왔을 때 다시 채우지 않게).
   *
   * 파일럿 지역을 미리 골라 두면 <b>고르지 않은 사람과 경주를 고른 사람이 구분되지 않는다.</b>
   * 지역이 셋일 때는 "일단 경주"가 그럴듯했지만 일곱이 되면서 경주는 여럿 중 하나가 됐고,
   * 미리 켜 두면 아래 요약과 버튼이 <b>사용자가 하지 않은 선택</b>을 확정된 것처럼 말한다.
   */
  /*
   * ⚠️ <b>고른 적 있는 값을 끌어오지 않는다</b> (2026-08-31).
   *
   * 예전에는 {@code state.plan}에 남아 있던 지역·기간으로 시작했다. 뒤로 왔을 때
   * 다시 채우지 않게 하려던 것인데, 실제로는 <b>새 여행을 시작하는 사람에게도</b>
   * 지난번 값이 켜진 채로 보였다 — 이 화면은 홈에서 새로 들어오는 길이 주 통로다.
   *
   * <p>켜진 칩은 <b>사용자가 고른 것과 구분되지 않는다.</b> "경주 · 2일"이 이미 서 있으면
   * 그대로 눌러 넘어가게 되고, 어느 지역으로 며칠을 가는지 정한 적 없이 다음 화면에
   * 도착한다. 뒤로 갔다 오면 다시 골라야 하는 값은 셋뿐이고, 정하지 않은 것을
   * 정한 것처럼 보이는 쪽이 더 나쁘다.
   *
   * <p>{@code handoff}는 예외다. 홈의 "이 장소로 여행가기"가 실어 보낸 것이라
   * <b>사용자가 방금 그 지역을 눌러서</b> 온 값이다.
   */
  const [region, setRegion] = useState(handoff?.region ?? '')
  /*
   * 날짜도 <b>고른 적 있는 값을 끌어오지 않는다</b> (2026-09-01). 위 지역·기간과 같다.
   *
   * <p>예전에는 {@code state.plan?.startDate}를 물려받고, 없으면 일주일 뒤를 채웠다.
   * 물려받은 값은 <b>지난 여행이 남긴 날</b>이라 새로 들어온 사람에게도 남의 답이 적혀 있고,
   * 일주일 뒤라는 기본값은 <b>우리가 고른 날</b>이다.
   *
   * <p>날짜만은 비워 둘 수 없어서(달력 입력은 빈 값이 성립하지 않는다) 가장 중립적인
   * <b>오늘</b>로 두고 사용자가 옮기게 한다. 코스 발견 화면과 같은 규칙이다.
   *
   * <p>{@code suggestedDate}는 예외다 — 홈 주간 예보의 "이 날로 코스 짜기"가 실어 보낸,
   * <b>사용자가 방금 그 날을 눌러서</b> 온 값이다. {@code handoff.region}과 같은 이유로 살린다.
   */
  const [startDate, setStartDate] = useState(() => suggestedDate ?? today())
  /** 며칠 머무를지. <b>고르기 전에는 없다</b> — 위 지역과 같은 이유다 */
  const [nights, setNights] = useState<number | null>(null)

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

  /*
   * 지역과 기간을 고르기 전에는 넘어갈 수 없다.
   *
   * 지역이 없으면 검색할 범위가 없고, 기간이 없으면 <b>몇 일치 칸을 만들지</b> 모른다.
   * 기본값으로 채워 두고 넘기면 사용자가 정하지 않은 여행이 만들어진다.
   */
  const canSubmit = Boolean(region) && nights !== null && !isPastDate

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    // canSubmit이 null을 이미 걸렀다. 타입만 좁힌다.
    if (nights === null) {
      return
    }
    setPlan({ region, startDate, nights })
    /*
     * 씨앗 장소를 편집 화면까지 들고 간다. {@code setPlan}이 방금 장소를 전부 비웠으므로
     * 이 값이 다음 화면에서 1일차의 첫 장소가 된다.
     *
     * ⚠️ <b>지역을 바꿨으면 함께 버린다.</b> 그 장소는 홈에서 고른 지역의 곳이라,
     * 다른 지역으로 옮긴 코스에 남아 있으면 <b>검색으로는 찾을 수도 없는 장소</b>가
     * 1일차에 박힌다. 검사를 여기서 하는 이유는 두 값이 여기에만 함께 있어서다 —
     * 편집 화면은 원래 지역이 무엇이었는지 모른다.
     */
    const seedPlaceId = region === handoff?.region ? handoff?.seedPlaceId : undefined
    navigate('/course', { state: { seedPlaceId } })
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
        {/*
          ⚠️ "피해서 가요"가 아니다.

          그 말은 사용자가 고른 곳을 <b>가지 말라</b>고 미리 말하는 셈이다. 아직 아무것도
          담지 않은 첫 화면에서, 하려던 여행을 무르라는 말부터 듣게 된다.

          우리가 여기서 실제로 하는 일은 <b>알려주는 것</b>이다 — 피할지 말지는 진단을
          보고 사용자가 정한다. 문구가 하는 일보다 앞서 나가면 서비스가 참견으로 읽힌다.
          진단 화면의 "새로운 곳 발견하기"·"더 여유로운 날 발견하기"와 같은 맥락이다.
        */}
        <h1 className="text-fg text-[34px] leading-[1.25] font-bold tracking-[-0.025em] lg:text-[40px]">
          붐비는지
          <br />
          확인해드려요
        </h1>
        {/*
          min-w를 걸지 않는다. 폭을 강제하면 화면이 그보다 좁을 때 문단이 밖으로 삐져나가
          페이지 전체에 가로 스크롤이 생긴다. 줄바꿈은 text-pretty에 맡긴다.
        */}
        <p className="text-[15.5px] leading-[1.65] text-pretty">
          계획만 입력하면 각 장소가 그날 얼마나 붐빌지
          <br />
          미리 알려드려요.
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
          어디 갈지 아직 모르겠다면? 몇 가지 답하고 코스 발견하기
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
          {/*
            legend를 div로 한 겹 감싼다.

            감싸지 않으면 브라우저가 legend를 <b>fieldset 테두리 위로 끌어올려</b> 특별하게 배치한다.
            테두리를 지운 카드에서는 그 자리가 카드 <b>바깥</b>이 되어, 제목만 상자 위로 튀어나온다.
            다른 카드들과 같은 규칙이다 — 하나만 빼먹으면 그 카드의 제목만 위치가 다르다.
          */}
          <div>
            <legend className={`${CARD_TITLE} p-0`}>어디로 가시나요</legend>
          </div>
          {/*
            칩 묶음에서 검색으로 바꿨다. 지역이 일곱이 되면서 390px에서 두 줄이 되고,
            더 늘면 화면을 덮는다 — 목록을 훑는 화면은 확장되지 않는다.
            고르는 방식은 RegionPicker 한 곳에만 있다. 여기와 코스 발견이 같은 것을
            각자 그리다가 모았다 — 하나를 빠뜨리면 두 화면이 다르게 동작한다.
          */}
          <RegionPicker value={region} onChange={setRegion} />
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
            <legend className={`${CARD_TITLE} p-0`}>언제 며칠 가세요</legend>
          </div>
          {/*
            네이티브 달력을 걷어내고 직접 그린다(2026-09-01). 이유는 DatePicker 주석에.
            <b>예측 창을 함께 넘긴다</b> — 아래 안내문이 하는 말을 달력이 날짜 위에서
            미리 한다. 고르고 나서 듣는 것과 고르기 전에 보이는 것은 다르다.
          */}
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            forecastEnd={forecastEnd}
            ariaLabel="여행 시작일"
          />
          {/*
            ■ 기간이 날짜와 <b>한 카드</b>에 있다 (2026-09-02)

            "언제 떠나요"와 "며칠 머무를까요"가 각자 카드를 쓰고 있었다. 둘은 <b>한 번에
            정하는 하나의 답</b>("9월 2일부터 2일")이라, 카드를 가르면 같은 질문에
            두 번 대답하는 꼴이 된다. 코스 발견 화면이 처음부터 한 카드였고,
            같은 것을 묻는 두 화면이 다른 모양이면 사용자가 매번 다시 읽는다.
          */}
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

          {/*
            고른 날짜를 요일까지 되읽어주던 회색 줄을 걷어냈다 (2026-08-31).
            달력 입력이 이미 고른 날짜를 보여주고 있어서, 바로 아래에서 같은 날짜를 다시 적으면
            <b>같은 사실이 두 번</b> 선다. 아래 예측 창 안내가 진짜 새 소식인데
            회색 줄이 그 앞에 서서 무게를 나눠 가졌다.

            ⚠️ <b>지난 날짜 경고는 남긴다.</b> 이건 되읽기가 아니라 <b>고칠 것을 알리는 말</b>이다.
            input의 {@code min}이 대개 막아 주지만 직접 입력하면 통과하고,
            그때 아무 말이 없으면 사용자가 왜 다음으로 못 넘어가는지 모른다.
          */}
          {isPastDate && (
            <div className="bg-crowded-tint rounded-ui flex items-center gap-2.5 px-3.5 py-3">
              <span className="bg-crowded h-2 w-2 flex-none rounded-full" aria-hidden="true" />
              <p className="text-crowded-deep m-0 text-[12.5px] leading-[1.5]">
                오늘 이후 날짜를 골라주세요.
              </p>
            </div>
          )}

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

        {/*
          버튼 위에 고른 조건을 한 줄로 되읽어준다. 카드 세 개를 다 채우고 나면
          맨 위 선택이 화면 밖으로 밀려 있어, 누르기 직전에 확인할 자리가 필요하다.

          이 화면에서는 버튼을 따라다니게 두지 않는다. 조건을 고르는 동안 화면 아래를
          계속 덮고 있어 날짜 입력이 가려진다. 목록을 훑어야 하는 편집·진단 화면과 달리
          여기는 세 칸만 채우면 끝이라, 끝까지 내려온 자리에 버튼이 있으면 충분하다.
        */}
        <div className="mt-2 pb-4">
          <div className="flex items-center justify-between px-1 pb-2.5">
            {/*
              지역을 고르기 전에는 그 자리를 비운다. "경주 · 2일"처럼 적어 두면
              고르지 않았는데 고른 것처럼 읽힌다.
            */}
            {/*
              고르지 않은 것은 적지 않는다. 기간을 고르기 전에는 며칠인지도, 언제까지인지도
              말할 수 없다 — 빈 자리가 "아직 안 골랐다"를 그대로 말한다.
            */}
            <span className="text-[13px]">
              {[regionName, durationLabel].filter(Boolean).join(' · ')}
            </span>
            <span className="text-fg font-mono text-[13px] font-medium">
              {nights === null ? '' : formatDateRange(startDate, nights)}
            </span>
          </div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={!canSubmit}>
            코스 짜러 가기
          </button>
        </div>
      </form>
    </div>
  )
}
