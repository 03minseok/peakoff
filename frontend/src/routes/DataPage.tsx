import { useEffect, useState } from 'react'
import { CongestionBadge } from '../components/CongestionBadge'
import { defaultRegionSlug, regionNameOf, regionOptions } from '../constants/regions'
import { ApiRequestError, fetchForecastWindow, fetchPlaces, fetchQuotas } from '../services/api'
import type { QuotaSummary } from '../types/api'
import { formatKoreanDate } from '../utils/date'

/**
 * 데이터가 어떻게 흐르고, 지금의 값들이 <b>무엇을 재서</b> 정해졌는지 한 화면에 편다.
 *
 * <h3>왜 이 화면이 있나</h3>
 * 심사 배점에 "데이터 활용 적절성"이 20점 있다. 기능 화면들은 <b>결과</b>를 보여주지만
 * "왜 65점이 한적인가", "왜 연관 관광지를 점수에 안 넣었나" 같은 물음에는 답하지 못한다.
 * 발표에서 말로 답하는 대신 <b>가리킬 화면</b>을 둔다.
 *
 * <p>예전에는 {@code /preview} — "공통 컴포넌트 확인"이었다(2026-07-30, 프론트 뼈대를 세운 첫
 * 커밋). 배지가 실제로 어떻게 보이는지와 백엔드가 살아 있는지를 한 화면에서 보려고 둔
 * 개발용 자리이고, "구현 완료 후 삭제 예정"이라고 적혀 있었다. 화면 구현이 끝나면서 배지
 * 견본은 할 일을 잃었고, 남은 것은 백엔드 연결 표시 하나였다.
 *
 * <p>지우는 대신 <b>쓸 데가 생겨 이름을 바꿨다</b>({@code /data}, 2026-09-09). 배지는 아래
 * <b>경계값</b> 자리로 옮겨 "65 / 35가 무엇을 가르는가"를 보이는 데 쓴다 — 견본이 아니라
 * 설명의 일부다.
 *
 * <h3>⚠️ 숫자에 두 종류가 있다</h3>
 * <ul>
 *   <li><b>지금 값</b>: 서버에 물어 받아온다(오늘 호출 수 · 예측 창 · 지역 수). 초록 점을 단다.</li>
 *   <li><b>기록</b>: 분석 노트에서 확정한 값과 그때의 실측. <b>측정일을 함께 적는다</b> —
 *       날짜 없는 숫자는 지금 잰 것처럼 읽힌다.</li>
 * </ul>
 *
 * <p>⚠️ <b>기록 쪽은 화면에 적힌 사본이다.</b> 서버의 임계값·가중치가 바뀌면 여기도 함께
 * 고쳐야 한다. 그래서 이 화면은 값을 <b>쓰는</b> 곳이 아니라 <b>설명하는</b> 곳으로만 둔다 —
 * 어떤 계산도 이 파일의 숫자를 읽지 않는다.
 */
export function DataPage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 pb-4">
      <PageHeader />
      <SectionIndex />
      <LiveTiles />
      <FlowSection />
      <ScoreSection />
      <ThresholdSection />
      <PlaceOffSection />
      <TimeOffSection />
      <RegionOffSection />
      <FullPeakoffSection />
      <SpreadSection />
      <RulesSection />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   조각들
   ────────────────────────────────────────────────────────────── */

const SECTION_TITLE = 'text-fg m-0 text-[18px] font-bold tracking-[-0.02em]'
const KICKER = 'text-brand-deep m-0 text-[11px] font-semibold tracking-[0.14em]'
const LEAD = 'text-muted m-0 text-[13.5px] leading-[1.7]'
const CARD = 'bg-surface shadow-rest rounded-card'

/**
 * 숫자만 고정폭으로 세운다.
 *
 * <p>⚠️ <b>한글에 고정폭 글꼴을 씌우지 않는다.</b> 자간이 벌어져 "한적도"가 "한 적 도"로
 * 읽힌다 — 챗봇 카드에서 같은 실수를 한 번 고친 적이 있다. 자릿수를 맞춰 세로로 견주고 싶은
 * 것은 숫자이지 조사가 아니다.
 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono">{children}</span>
}

/**
 * 이 값이 어디서 왔는지 다는 꼬리표.
 *
 * <p><b>날짜 없는 숫자는 지금 잰 것처럼 읽힌다.</b> 그래서 실측한 것에는 날짜를 달고,
 * 재서 정한 것이 아니라 설계로 정한 규칙에는 그렇다고 적는다 — 둘을 같은 말로 뭉개면
 * 어느 쪽이 데이터에서 나온 값인지 알 수 없다.
 */
function Measured({ on }: { on: string }) {
  return <span className="text-hint text-[10.5px] whitespace-nowrap">{on}</span>
}

/**
 * 이 화면에 있는 절 전부. <b>번호·이름의 원천이 여기 한 곳</b>이다.
 *
 * <p>차례표와 각 절의 머리가 같은 배열을 읽는다. 두 벌로 적으면 절을 하나 끼울 때
 * 한쪽만 고쳐져 <b>차례에는 있는데 눌러도 안 가는 줄</b>이 생긴다.
 *
 * <p>순서가 곧 번호다 — 절을 옮기면 번호도 따라 옮는다. 손으로 매기면 사이에
 * 하나를 끼울 때 뒤의 번호를 전부 고쳐야 하고, 그러다 하나를 빠뜨린다.
 */
const SECTIONS = [
  { id: 'flow', kicker: 'FLOW', title: '공사 응답이 화면에 닿기까지' },
  { id: 'scores', kicker: 'SCORES', title: '점수는 둘뿐입니다' },
  { id: 'evidence', kicker: 'EVIDENCE', title: '값을 정한 근거' },
  { id: 'place-off', kicker: 'PLACE OFF', title: '대안 하나가 뽑히기까지' },
  { id: 'time-off', kicker: 'TIME OFF', title: '더 한적한 날짜를 고르는 법' },
  { id: 'region-off', kicker: 'REGION OFF', title: '어디로 갈지 묻는 자리' },
  { id: 'full', kicker: 'FULL PEAKOFF', title: '설문에서 코스가 나오기까지' },
  { id: 'spread', kicker: 'ANTI-CONCENTRATION', title: '같은 곳으로 몰지 않는 장치' },
  { id: 'rules', kicker: 'RULES', title: '계산이 지키는 것' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/** 번호는 배열의 자리에서 온다. 1부터 세고 두 자리로 맞춘다. */
function numberOf(id: SectionId) {
  return String(SECTIONS.findIndex((section) => section.id === id) + 1).padStart(2, '0')
}

/**
 * 눌러서 그 절로 건너뛰는 차례표.
 *
 * <p>절이 아홉이라 위에서부터 훑기에는 길다. 발표 중에 "그건 여기 있습니다" 하고
 * 곧장 짚을 수 있어야 이 화면이 <b>가리킬 화면</b> 구실을 한다.
 *
 * <p>⚠️ 건너뛴 자리가 헤더 뒤로 숨지 않게 {@code scroll-mt}를 절마다 둔다. 머리 막대는
 * 넓은 화면에서만 붙어 있으므로(Layout) 여백도 그때만 크다.
 */
function SectionIndex() {
  return (
    <nav aria-label="이 화면의 차례" className={`${CARD} flex flex-col gap-1.5 p-4`}>
      <p className="text-fg m-0 text-[13px] font-semibold">이 화면에 있는 것</p>
      <ol className="m-0 grid list-none grid-cols-1 gap-x-5 p-0 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-muted hover:text-brand-deep flex items-baseline gap-2 py-1 text-[12.5px] no-underline"
            >
              <span className="text-hint font-mono text-[11px] tabular-nums">
                {numberOf(section.id)}
              </span>
              <span>{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * 절 하나. <b>이름과 번호는 넘기지 않고 {@link SECTIONS}에서 찾아 쓴다.</b>
 *
 * <p>번호가 차례표의 것과 같아야 눌러서 온 사람이 자기가 어디 왔는지 안다.
 * 부르는 쪽이 번호를 손으로 넘기면 언젠가 둘이 어긋난다.
 */
function Section({
  id,
  lead,
  children,
}: {
  id: SectionId
  lead?: string
  children: React.ReactNode
}) {
  const meta = SECTIONS.find((section) => section.id === id)
  if (!meta) {
    return null
  }
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 lg:scroll-mt-[72px]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-hint font-mono text-[11px] font-semibold tabular-nums">
            {numberOf(id)}
          </span>
          <span className="bg-line h-px w-3" aria-hidden="true" />
          <p className={KICKER}>{meta.kicker}</p>
        </div>
        <h2 className={SECTION_TITLE}>{meta.title}</h2>
        {lead && <p className={LEAD}>{lead}</p>}
      </div>
      {children}
    </section>
  )
}

function PageHeader() {
  return (
    <header className="flex flex-col gap-2 pt-1">
      <p className={KICKER}>DATA PIPELINE</p>
      <h1 className="text-fg m-0 text-[26px] font-bold tracking-[-0.025em]">
        데이터가 흐르는 길과
        <br />
        값을 정한 근거
      </h1>
      <p className={LEAD}>
        PEAKOFF는 한국관광공사 OpenAPI를 <strong className="text-fg font-semibold">실시간으로 호출해</strong>{' '}
        혼잡을 예측하고, 그 위에서 한적한 대안을 고릅니다. 이 화면은 그 과정과, 화면에 쓰이는
        경계값들이 <strong className="text-fg font-semibold">무엇을 재서 정해졌는지</strong>를 모아 둔
        자리입니다.
      </p>
    </header>
  )
}

/* ── 지금 값 ────────────────────────────────────────────────── */

/**
 * 서버에 물어 지금 값을 세운다. <b>이 셋만 살아 있는 숫자</b>다.
 *
 * <p>못 받아오면 그 타일만 {@code —}로 두고 화면은 그대로 선다 — 설명하러 온 화면이
 * 값 하나 때문에 통째로 죽으면 안 된다.
 */
function LiveTiles() {
  const [quota, setQuota] = useState<QuotaSummary | null>(null)
  const [forecastEnd, setForecastEnd] = useState<string | null>(null)
  const [connection, setConnection] = useState<string>('확인 중…')

  useEffect(() => {
    const controller = new AbortController()
    fetchQuotas(controller.signal).then(setQuota).catch(() => setQuota(null))
    fetchForecastWindow(controller.signal)
      .then((window) => setForecastEnd(window.lastDate))
      .catch(() => setForecastEnd(null))
    fetchPlaces(defaultRegionSlug(), { limit: 30, signal: controller.signal })
      .then((places) => setConnection(`${regionNameOf(defaultRegionSlug())} ${places.length}곳 응답`))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setConnection(error instanceof ApiRequestError ? `실패 · ${error.message}` : '실패')
      })
    return () => controller.abort()
  }, [])

  const regionCount = regionOptions().length

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.75">
        <span className="bg-quiet h-2 w-2 flex-none rounded-full" aria-hidden="true" />
        <p className="text-fg m-0 text-[13px] font-semibold">지금 서버에 물어본 값</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile
          label="오늘 공사 API 호출"
          value={quota ? `${quota.totalAllApis}` : '—'}
          unit="회"
          note={quota ? `가정 한도 ${quota.assumedDailyLimit.toLocaleString()}회` : '집계를 받지 못했어요'}
        />
        <Tile
          label="예측이 닿는 마지막 날"
          value={forecastEnd ? formatKoreanDate(forecastEnd) : '—'}
          mono={false}
          note="공사가 주는 창은 24~30일 사이에서 실제로 변합니다"
        />
        <Tile label="서비스 지역" value={`${regionCount}`} unit="곳" note="시도마다 하나씩, 강원·제주만 둘" />
        <Tile
          label="백엔드 연결"
          value={connection.startsWith('실패') ? '실패' : '연결됨'}
          mono={false}
          note={connection}
        />
      </div>

      {/*
        API별 내역. 오늘 규칙 1("공사 OpenAPI로 가져온다")을 화면에서 증명하는 자리다 —
        인증키 호출 이력으로 심사가 검증하는 그 숫자를 그대로 보인다.
        안 부른 API도 0으로 선다: "안 불렀다"가 보여야 한다.
      */}
      {quota && (
        <div className={`${CARD} flex flex-col gap-2 p-4`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-fg m-0 text-[13px] font-semibold">활용신청 단위로 센 호출</p>
            <span className="text-hint font-mono text-[11px]">{quota.date}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {quota.apis.map((row) => (
              <li key={row.api} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-muted">{row.api}</span>
                <span>
                  <Num>{row.total}</Num>회
                  {row.failure > 0 && (
                    <span className="text-crowded-deep">
                      {' '}
                      (실패 <Num>{row.failure}</Num>)
                    </span>
                  )}
                  <span className="text-hint ml-1">
                    · <Num>{row.percentOfAssumedLimit}%</Num>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-hint m-0 text-[11.5px] leading-[1.6]">
            한도는 포털이 알려주지 않아 <strong className="font-semibold">가정한 값</strong>입니다.
            비율도 그 가정 기준입니다.
          </p>
        </div>
      )}
    </section>
  )
}

function Tile({
  label,
  value,
  unit,
  note,
  /** 값이 숫자일 때만 고정폭. 한글에 씌우면 자간이 벌어져 낱말이 쪼개진다({@link Num}) */
  mono = true,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  mono?: boolean
}) {
  return (
    <div className={`${CARD} flex flex-col gap-1 p-3.5`}>
      <p className="text-hint m-0 text-[11.5px]">{label}</p>
      <p className="text-fg m-0 flex items-baseline gap-0.5">
        <span
          className={`leading-none font-semibold tracking-[-0.02em] ${
            mono ? 'font-mono text-[20px]' : 'text-[16px]'
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-muted text-[12px] font-semibold">{unit}</span>}
      </p>
      {note && <p className="text-hint m-0 text-[11px] leading-[1.5]">{note}</p>}
    </div>
  )
}

/* ── 흐름 ──────────────────────────────────────────────────── */

/** 한 단계. 왼쪽 번호와 세로선이 순서를 잇는다 */
function Step({
  no,
  title,
  body,
  tone = 'default',
  last = false,
}: {
  no: number
  title: string
  body: React.ReactNode
  tone?: 'default' | 'brand'
  last?: boolean
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-none flex-col items-center">
        <span
          className={`grid h-6.5 w-6.5 place-items-center rounded-full font-mono text-[11.5px] font-semibold ${
            tone === 'brand' ? 'bg-brand text-fg' : 'bg-fill text-muted'
          }`}
        >
          {no}
        </span>
        {/* 마지막 단계 아래에는 선을 긋지 않는다 — 이어질 곳이 없다 */}
        {!last && <span className="bg-line w-px flex-1" aria-hidden="true" />}
      </div>
      <div className={`flex flex-col gap-1 ${last ? 'pb-0' : 'pb-4'}`}>
        <p className="text-fg m-0 text-[14px] font-semibold">{title}</p>
        <div className="text-muted text-[12.5px] leading-[1.7]">{body}</div>
      </div>
    </li>
  )
}

function FlowSection() {
  return (
    <Section
      id="flow"
      lead="파일을 받아 두거나 DB에 적재하지 않습니다. 값이 필요할 때마다 공사에 묻고, 성능을 위해 원자료만 잠시 기억합니다."
    >
      <div className={`${CARD} p-4.5`}>
        <ol className="m-0 flex list-none flex-col p-0">
          <Step
            no={1}
            title="공사 OpenAPI 네 곳을 부른다"
            body={
              <>
                국문 관광정보(장소·분류·좌표·사진) · 집중률 예측(한적도의 원천) · 중심 관광지 ·
                연관 관광지. 지역과 분류는 <strong className="text-fg font-semibold">법정동 코드와 신분류 코드</strong>로
                지정합니다. 폐기 예정인 옛 지역·분류 코드는 쓰지 않습니다.
              </>
            }
          />
          <Step
            no={2}
            title="원자료만 6시간 기억한다"
            body={
              <>
                공사 데이터는 하루 한 번 갱신되므로 수명을 6시간으로 둡니다. 공사가 침묵하면
                직전 값으로 최대 사흘까지 버팁니다. ⚠️{' '}
                <strong className="text-fg font-semibold">빈 응답(200에 0건)은 받지 않습니다</strong> —
                멀쩡한 옛 값을 덮으면 우리가 스스로 자료를 지우는 셈이 됩니다.
              </>
            }
          />
          <Step
            no={3}
            title="요청 전에 미리 채운다"
            body={
              <>
                서버가 켜지면 지역 카탈로그를 모두 받아 두고, 이후 5시간마다 갱신합니다. 첫 손님이
                콜드 호출을 떠안지 않게 하려는 것입니다. 수명(6시간)보다 주기가 짧아야 그 사이 값이
                죽지 않습니다.
              </>
            }
          />
          <Step
            no={4}
            title="집중률을 뒤집어 한적도를 만든다"
            body={
              <>
                공사의 <code className="font-mono text-[11.5px]">cnctrRate</code>는 0~100이고 높을수록
                붐빕니다. 이를 뒤집어 <strong className="text-fg font-semibold">한적도</strong>로 씁니다.
                공사는 장소를 이름 문자열로만 주기 때문에, 괄호·지자체명·공백을 정규화해 우리 장소와
                잇습니다. 여러 후보가 나오면 잇지 않습니다 — 잘못 이으면 다른 장소의 혼잡도를 그
                장소의 것이라 말하게 됩니다.
              </>
            }
          />
          <Step
            no={5}
            tone="brand"
            last
            title="거르고 · 점수 매기고 · 뽑는다"
            body={
              <>
                분류·거리·중복·혼잡자료 조건을 통과한 후보만 남기고, 추천도를 계산해 상위 후보군을
                만든 뒤 그 안에서 가중 무작위로 뽑습니다. 순서를 지키는 것이 중요합니다 — 거르기를
                뽑기 뒤로 미루면 자격 미달 후보가 1등이 될 수 있습니다.
              </>
            }
          />
        </ol>
      </div>

      <div className="bg-moderate-tint rounded-card flex items-start gap-2.5 px-4 py-3.5">
        <span className="bg-moderate mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
        <p className="text-moderate-deep m-0 text-[12.5px] leading-[1.7]">
          <strong className="font-semibold">캐시는 원자료 층에만 둡니다.</strong> 완성된 추천 목록을
          기억해 모든 사용자에게 돌려주면 아래 분산 장치가 통째로 죽습니다. 공사 응답까지만 기억하고,
          점수 계산과 뽑기는 매번 다시 합니다.
        </p>
      </div>
    </Section>
  )
}

/* ── 점수 ──────────────────────────────────────────────────── */

function ScoreSection() {
  return (
    <Section
      id="scores"
      lead="화면에 없는 값으로 목록을 줄 세우면 '왜 이게 1등인지'를 설명할 수 없습니다. 그래서 셋째 점수를 만들지 않았습니다."
    >
      <div className="flex flex-col gap-2.5">
        <div className={`${CARD} flex flex-col gap-2.5 p-4.5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-fg m-0 text-[15px] font-bold">한적도</h3>
            <span className="text-hint text-[11.5px]">원본 지표</span>
          </div>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            그 장소가 그 날짜에 얼마나 덜 붐빌지. 공사 집중률 예측에서 바로 나오므로{' '}
            <strong className="text-fg font-semibold">비교 대상 없이도 존재</strong>합니다. 진단 화면의
            모든 장소에 표시하고, 대안 목록에서도 판단의 원본 수치로 함께 보여줍니다.
          </p>
        </div>

        <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-fg m-0 text-[15px] font-bold">추천도</h3>
            <span className="text-hint text-[11.5px]">교체 추천에만</span>
          </div>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            "이 서비스가 그곳을 대안으로 얼마나 미는가". 원래 장소가 있어야 성립하는 관계값이라
            진단 타임라인에는 나오지 않습니다.
          </p>

          {/*
            반영 비율. ⚠️ 여기 적힌 값은 <b>기본값의 사본</b>이다 — 설문의 혼잡 민감도에 따라
            서버가 실제로 다르게 매긴다. 그래서 대안 카드의 구성 내역은 이 파일이 아니라
            서버가 준 factors에서 그린다.
          */}
          <div className="bg-bg rounded-ui flex flex-col gap-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg text-[12.5px] font-semibold">한적도</span>
              <span className="text-quiet-deep font-mono text-[12.5px] font-semibold">70%</span>
            </div>
            <div className="bg-line h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-quiet h-full rounded-full" style={{ width: '70%' }} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-fg text-[12.5px] font-semibold">동선 근접도</span>
              <span className="text-muted font-mono text-[12.5px] font-semibold">30%</span>
            </div>
            <div className="bg-line h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-brand h-full rounded-full" style={{ width: '30%' }} />
            </div>
            <p className="text-hint m-0 pt-0.5 text-[11px] leading-[1.6]">
              기본값입니다. 설문의 혼잡 민감도에 따라 서버가 비율을 바꾸며, 화면은 서버가 내려준
              값으로 그립니다.
            </p>
          </div>

          <div className="border-line/70 flex flex-col gap-2 border-t pt-3">
            <p className="text-fg m-0 text-[12.5px] font-semibold">점수에 넣지 않은 것</p>
            <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
              <strong className="text-fg font-semibold">연관성과 카테고리는 점수가 아니라 문</strong>입니다.
              후보를 만들고 거르는 데만 씁니다. 특히{' '}
              <strong className="text-fg font-semibold">인기도를 가점으로 쓰지 않습니다</strong> — 인기
              장소가 곧 붐비는 장소라, 가점을 주면 오버투어리즘 과제와 정면으로 어긋납니다.
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ── 경계값 ────────────────────────────────────────────────── */

function Evidence({
  title,
  value,
  measured,
  children,
}: {
  title: string
  /** 숫자는 {@link Num}으로 감싸 넘긴다 — 한글까지 고정폭이 되면 낱말이 쪼개진다 */
  value: React.ReactNode
  measured: string
  children: React.ReactNode
}) {
  return (
    <div className={`${CARD} flex flex-col gap-2 p-4.5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-fg m-0 text-[14px] font-bold">{title}</h3>
        <Measured on={measured} />
      </div>
      <p className="text-brand-deep m-0 text-[17px] font-semibold tracking-[-0.01em]">{value}</p>
      <div className="text-muted text-[12.5px] leading-[1.7]">{children}</div>
    </div>
  )
}

function ThresholdSection() {
  return (
    <Section
      id="evidence"
      lead="아래 숫자들은 임의로 고른 것이 아니라 실제 데이터를 재서 정했습니다. 측정한 날짜를 함께 적습니다."
    >
      <div className="flex flex-col gap-2.5">
        <Evidence
          title="한적도 3단계 경계"
          value={
            <>
              <Num>65</Num> / <Num>35</Num>
            </>
          }
          measured="2026-08-31 실측"
        >
          <p className="m-0">
            전국 16개 시도에서 뽑은{' '}
            <strong className="text-fg font-semibold">64개 시군구 · 관광지 2,905곳 · 관측 87,150건</strong>
            으로 잡았습니다. 서비스 지역 셋만 보고 잡으면 지역을 늘리는 순간 전국의 45%가 "한적"이
            되어 무너집니다.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <CongestionBadge level="QUIET" quietness={82} />
            <CongestionBadge level="MODERATE" quietness={54} />
            <CongestionBadge level="CROWDED" quietness={12} />
          </div>
          <p className="m-0 mt-2.5">
            지역이 열하나가 된 뒤 다시 재보니 서비스 지역 전체(관광지 1,091곳 · 관측 32,730건)에서{' '}
            <strong className="text-fg font-semibold">35.9 / 37.3 / 26.8</strong>으로 섰습니다. 셋이 모두
            살아 있고 한 배지도 45%를 넘지 않습니다.
          </p>
        </Evidence>

        <Evidence
          title="연관 관광지를 점수에서 뺀 이유"
          value={
            <>
              켄달 타우 <Num>−0.073</Num>
            </>
          }
          measured="2026-08-31 실측"
        >
          <p className="m-0">
            연관 순위와 한적도의 상관을 6개 지역{' '}
            <strong className="text-fg font-semibold">26,819쌍</strong>에서 쟀더니 음의 상관이었고, 6곳 중
            5곳이 음수였습니다(서귀포 −0.139 · 경주 −0.127).{' '}
            <strong className="text-fg font-semibold">함께 많이 가는 곳일수록 더 붐빕니다.</strong> 가점을
            주면 "더 붐비는 곳을 더 밀어라"가 되므로, 점수가 아니라 후보를 만드는 문으로만 씁니다.
          </p>
        </Evidence>

        <Evidence
          title="대안이 되기 위한 최소 개선폭"
          value={
            <>
              한적도 <Num>+5</Num>점
            </>
          }
          measured="설계 규칙"
        >
          <p className="m-0">
            추천도에 근접도가 섞여 있어, 이 하한이 없으면{' '}
            <strong className="text-fg font-semibold">아주 가까운 곳이 더 붐비는데도</strong> 총점이 높아
            "대안"으로 나갑니다. 붐빔을 피하라는 서비스가 더 붐비는 곳을 권하게 됩니다. 거리 상한은
            15km입니다.
          </p>
        </Evidence>

        <Evidence
          title="후보 출처를 둘로 넓힌 효과"
          value={
            <>
              <Num>41%</Num> → <Num>86%</Num>
            </>
          }
          measured="2026-09-01 실측"
        >
          <p className="m-0">
            연관 관광지만 보면 관광지 넷 중 셋이 대안을 얻지 못했습니다(경주 25.6% · 제주시 30.9% ·
            서귀포 33.7%). 지역 카탈로그를 함께 보되{' '}
            <strong className="text-fg font-semibold">출처마다 한 자리씩 보장</strong>했습니다. 그냥 섞으면
            지역 후보가 5~6배 많아 상위권을 쓸어갑니다.
          </p>
        </Evidence>

        <Evidence
          title="총점을 숫자로 내걸 조건"
          value={
            <>
              진단 <Num>2</Num>곳 이상 · 진단율 <Num>50%</Num> 이상
            </>
          }
          measured="설계 규칙"
        >
          <p className="m-0">
            못 채우면 평균 대신 <strong className="text-fg font-semibold">등급 요약</strong>을 폅니다("한적
            2곳 · 보통 1곳 · 자료 없음 3곳"). 사실의 나열이라 근거가 얇아도 정직합니다. 채우면 모수를
            함께 적습니다 — "관광지 3곳 중 2곳의 예측자료 기준".
          </p>
        </Evidence>

        <Evidence
          title="같은 날짜의 예측값도 갱신되며 바뀐다"
          value={
            <>
              <Num>0</Num> / <Num>1,587</Num>쌍이 일치
            </>
          }
          measured="2026-08-30 실측"
        >
          <p className="m-0">
            요일 패턴을 되풀이하는 표가 아니라 날짜마다 따로 매겨진 예보입니다. 요일 효과는 크지만(토
            71.4 · 수 31.3) 같은 토요일끼리도 주마다 다릅니다.{' '}
            <strong className="text-fg font-semibold">저장한 코스에 점수 스냅샷을 남기고 열 때마다
            재계산하지 않는 이유</strong>가 이것입니다.
          </p>
        </Evidence>

        {/*
          발전성을 말하는 자리. "11곳"이 한계로만 읽히는 것을 막는다 — 세 조건과 통과·탈락한
          곳의 이유가 저장소(analysis/region-candidates)에 있는데 심사위원은 저장소를 안 읽는다.
          숫자는 그 노트의 사본이라 재면 조금씩 달라진다(예측이 날마다 갱신된다).
        */}
        <Evidence
          title="지역이 11곳인 이유 — 그리고 어디까지 가는가"
          value={
            <>
              후보 <Num>28</Num>곳 → 넣은 곳 <Num>4</Num>
            </>
          }
          measured="2026-09-03 실측"
        >
          <p className="m-0">
            11은 한계가 아니라 <strong className="text-fg font-semibold">지금 고른 수</strong>입니다.
            지역은 세 조건을 모두 넘어야 들어옵니다 — ① 무작위 6칸 코스에서 붐빔이 한 칸 이상 나올
            확률 <Num>35%</Num> 이상 · ② 집중률 예측이 있는 관광지 <Num>40</Num>곳 이상 · ③ 자치구로
            쪼개지지 않은 단일 시군구. 서울을 뺀 시도마다 하나씩을 목표로 비어 있던 열 시도의 후보{' '}
            <Num>28</Num>곳을 재서 가평·충주·통영·남원을 넣었습니다.
          </p>
          <p className="m-0 mt-2">
            ①은 한 번 바뀐 자입니다. 처음엔 "가장 적은 배지 20% 이상"이었는데 충북·경남이 통째로
            떨어졌습니다 —{' '}
            <strong className="text-fg font-semibold">한적 배지가 절반을 넘어서</strong>였고, 그건 그
            지역이 실제로 한산하다는 뜻이라 한산한 곳으로 사람을 보내는 서비스가 그 이유로 빼는 것은
            앞뒤가 맞지 않았습니다. 사용자가 보는 것은 6칸짜리 코스 하나라, 대리 지표 대신 그것을
            직접 재는 자로 바꿨습니다. 그러자 충주(<Num>52.5%</Num>)가 경주(<Num>47.4%</Num>)와 같은
            자리였습니다.
          </p>
          {/*
            ■ <b>다음 후보를 숫자로 세운다</b> (2026-09-10)

            "어떻게 늘리나"에 글로만 답하면 계획으로 읽히고, 숫자로 답하면 <b>이미 재 본 것</b>으로
            읽힌다. 발전성은 이 화면에서 가장 얇은 칸이라 여기서 벌어야 한다.

            <p>수치는 1부가 받아 둔 스냅샷을 <b>지금 조건</b>으로 다시 잰 것이다
            ({@code analysis/region-candidates/next.py}). 공사를 다시 부르지 않는다 — 예측이 갱신되면
            후보끼리 견줄 기준이 어긋난다.

            <p>⚠️ 인천은 옹진군·강화군이 <b>둘 다</b> 통과했지만 하나만 적는다. 시도마다 하나씩이
            원칙이라 강화군을 함께 세우면 그 원칙과 화면이 어긋난다.
          */}
          <div className="bg-bg rounded-ui mt-3 flex flex-col gap-2 p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg text-[12.5px] font-semibold">다음에 열 수 있는 시도</span>
              <span className="text-hint text-[11px]">붐빔 1칸↑ · 예측</span>
            </div>
            {[
              { area: '인천 옹진군', rate: '78.4%', forecast: '59곳' },
              { area: '울산 울주군', rate: '54.5%', forecast: '54곳' },
              { area: '대구 달성군', rate: '43.3%', forecast: '48곳' },
            ].map((row) => (
              <div key={row.area} className="flex items-baseline justify-between gap-3">
                <span className="text-muted text-[12.5px]">{row.area}</span>
                <span className="text-[12.5px] font-semibold">
                  <span className="text-quiet-deep font-mono">{row.rate}</span>
                  <span className="text-hint ml-1.5 font-mono font-normal">{row.forecast}</span>
                </span>
              </div>
            ))}
            <p className="text-hint m-0 pt-0.5 text-[11px] leading-[1.6]">
              셋을 넣으면 <Num>11</Num>곳 → <Num>14</Num>곳, 시도가 셋 늡니다. 이미 들어와 있는 곳의
              하한이 <Num>37.9%</Num>(가평)라 새 후보가 기존 지역보다 무른 채로 들어오지 않습니다.
            </p>
          </div>

          <p className="m-0 mt-2">
            <strong className="text-fg font-semibold">아직 없는 곳과 이유</strong> — 대전은 시 전체가
            자치구라 ③을 넘을 후보가 없고, 세종은 국문 관광정보 카탈로그가 <Num>0</Num>건이며, 부산
            기장군은 예측 대상이 <Num>39</Num>곳으로 <strong className="text-fg font-semibold">한 곳
            모자랐습니다</strong> — 공사가 대상을 늘리면 통과하는 유일한 자리입니다. 인천 옹진군·울산
            울주군·대구 달성군은 조건을 넘어 다음 차례이고, 옹진은 섬이라 15km 안 이웃이 다른 지역의 3분의 1이라
            대안이 자주 빌 수 있습니다. 조건을 지키는 한 <strong className="text-fg font-semibold">
            지역을 늘려도 경계값과 점수식은 그대로</strong>입니다 — 11곳이 되면서 오히려 경계가 전국
            분포에 맞아 들어갔습니다.
          </p>
        </Evidence>
      </div>
    </Section>
  )
}

/* ── 장소 교체 ────────────────────────────────────────────── */

/**
 * 후보가 통과해야 하는 문 하나.
 *
 * <p>{@link Step}과 모양이 비슷하지만 <b>다른 것을 말한다.</b> 저쪽은 순서대로 일어나는
 * 일이라 세로선으로 잇고, 여기는 <b>모두 통과해야 하는 조건</b>이라 잇지 않는다 —
 * 선을 그으면 "1번 다음에 2번"으로 읽혀 하나만 걸려도 탈락한다는 뜻이 흐려진다.
 */
function Gate({ no, title, body }: { no: number; title: string; body: React.ReactNode }) {
  return (
    <li className="border-line flex gap-2.5 border-t pt-3 first:border-t-0 first:pt-0">
      <span className="bg-fill text-muted grid h-5 w-5 flex-none place-items-center rounded-full font-mono text-[10.5px] font-semibold">
        {no}
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-fg m-0 text-[13px] font-semibold">{title}</p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">{body}</p>
      </div>
    </li>
  )
}

/** 카드 안의 작은 제목 + 오른쪽 꼬리표. */
function CardHead({ title, measured }: { title: string; measured: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-fg m-0 text-[14px] font-bold">{title}</h3>
      <Measured on={measured} />
    </div>
  )
}

/**
 * 장소 교체 추천이 어떻게 한 줄을 고르는지 편다.
 *
 * <h3>왜 이 절이 있나</h3>
 * 발표에서 가장 많이 받을 질문이 <b>"그래서 이 대안은 왜 여기 떴나요"</b>다.
 * 진단 화면은 결과만 보여주고, 대안 카드의 구성 내역은 <b>점수 두 항목</b>까지만 말한다 —
 * 그 앞에 있는 <b>거르기</b>와 뒤에 있는 <b>뽑기</b>는 화면 어디에도 드러나지 않는다.
 * 이 절이 그 앞뒤를 채운다.
 *
 * <p>⚠️ 여기 적힌 숫자는 <b>서버 값의 사본</b>이다. 임계값이 바뀌면 함께 고쳐야 한다 —
 * 그래서 이 화면은 값을 <b>쓰는</b> 곳이 아니라 <b>설명하는</b> 곳으로만 둔다.
 */
function PlaceOffSection() {
  return (
    <Section
      id="place-off"
      lead="붐빌 것으로 예측된 자리에 다른 곳을 권하는 경로입니다. 거르기가 먼저이고 뽑기가 마지막입니다 — 순서를 뒤집으면 자격 미달 후보가 무작위로 1등이 될 수 있습니다."
    >
      {/* 1. 거르기 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="① 문을 모두 통과해야 후보가 됩니다" measured="점수 매기기 이전" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          일곱 개가 <strong className="text-fg font-semibold">순서가 아니라 조건</strong>입니다. 하나라도
          걸리면 그 자리에서 탈락하고, 점수는 통과한 것에만 매깁니다.
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <Gate
            no={1}
            title="원래 장소의 한적도를 안다"
            body={
              <>
                얼마나 나아지는지 재려면 기준이 있어야 합니다. 음식점·숙박처럼 공사의 예측 대상이
                아닌 자리는 여기서 갈라져,{' '}
                <strong className="text-fg font-semibold">"같은 분류 · 가까운 순"이라는 다른 경로</strong>로
                안내합니다. 점수 자리가 빈 응답을 추천과 같은 곳으로 내보내면 화면이 "아직 점수가 안 온
                추천"으로 읽습니다.
              </>
            }
          />
          <Gate
            no={2}
            title="같은 지역 안이다"
            body="기준 장소가 든 지역의 후보만 봅니다. 어느 지역 카탈로그에도 없는 장소는 연관 목록에도 없습니다."
          />
          <Gate
            no={3}
            title="세부 분류가 맞는다"
            body={
              <>
                대분류로 뭉뚱그리지 않고 <strong className="text-fg font-semibold">중분류로 가릅니다</strong>.
                대분류만 보면 문화·명소가 박물관과 리조트를 한데 묶어{' '}
                <strong className="text-fg font-semibold">황리단길 자리에 리조트</strong>가 올라옵니다.
                유적에서 박물관으로 갈 수 있으면 반대도 되어야 하므로 양방향으로 맞춥니다 — 한쪽만 열면
                같은 두 장소가 어느 쪽을 눌렀느냐에 따라 다른 답을 줍니다.
              </>
            }
          />
          <Gate
            no={4}
            title="직선거리 15km 안이다"
            body={
              <>
                근접도가 이미 거리를 반영하지만 <strong className="text-fg font-semibold">깎을 뿐 막지는
                못합니다</strong>. 반영 비율이 30%라 아주 한적한 곳은 근접도가 0점이어도 총점이 높게
                나옵니다. 실측에서 경주 <Num>38.8km</Num> · 제주시 <Num>62.7km</Num> 떨어진 곳이 대안으로
                나가고 있었습니다 — 코스의 한 칸을 대신하는 자리에 그 거리는 실행할 수 없는 제안입니다.
              </>
            }
          />
          <Gate
            no={5}
            title="그 날 혼잡 예측이 있다"
            body="후보 쪽에도 예측이 있어야 한적도를 매길 수 있습니다. 없으면 얼마나 나은지 말할 방법이 없습니다."
          />
          <Gate
            no={6}
            title="원래 자리보다 한적도 +5점 이상이다"
            body={
              <>
                <strong className="text-fg font-semibold">이 하한이 없으면 더 붐비는 곳이 대안으로
                나갑니다</strong> — 추천도에 근접도가 섞여 있어 아주 가까운 곳은 총점이 높기 때문입니다.
                0점이 아니라 5점인 이유는 <Num>1~2</Num>점 차이가 예측값의 오차 범위 안이라서입니다.
                그 정도로 "여기가 낫다"고 하면 장소를 바꾸는 수고를 시켜 놓고 실제로는 아무것도
                나아지지 않습니다.
              </>
            }
          />
          <Gate
            no={7}
            title="이미 그 날 코스에 담겨 있지 않다"
            body={
              <>
                <strong className="text-fg font-semibold">자격을 따진 뒤, 뽑기 앞입니다.</strong> 뽑기
                뒤로 미루면 고를 수 없는 곳이 후보군 자리를 차지해 목록이 이유 없이 짧아지고, 자격 심사
                앞에 두면 "이미 담긴 후보"가 몇이었는지 몰라 <strong className="text-fg font-semibold">더
                한적한 곳을 찾고도 "찾지 못했다"</strong>고 말하게 됩니다.
              </>
            }
          />
        </ul>
      </div>

      {/* 2. 점수 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="② 통과한 것에만 점수를 매깁니다" measured="비율은 서버가 내려보냄" />
        {/*
         * ⚠️ 한 줄 수식으로 쓰지 않는다. 좁은 화면에서 "추천도 = 한적도 × 70% + …"가
         * 제멋대로 줄을 바꿔 <b>수식으로 읽히라고 만든 줄이 조각 더미</b>가 됐다.
         * 대안 카드의 구성 내역이 같은 이유로 세로 목록이 됐고, 여기도 같은 문법을 쓴다.
         *
         * <p>그리고 이 줄에 {@code font-mono}를 씌우지 않는다 — 자간이 벌어져 "한적도"가
         * "한 적 도"로 읽힌다. 고정폭은 {@link Num}이 감싼 숫자에만 간다.
         */}
        <div className="bg-bg rounded-ui flex flex-col gap-2.5 p-3.5">
          <p className="text-fg m-0 text-[12.5px] font-semibold">추천도 = 두 항목의 가중 평균</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted text-[12.5px]">한적도</span>
              <span className="text-brand-deep text-[12.5px] font-semibold">
                반영 <Num>70%</Num>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted text-[12.5px]">동선 근접도</span>
              <span className="text-brand-deep text-[12.5px] font-semibold">
                반영 <Num>30%</Num>
              </span>
            </div>
          </div>
          <p className="text-hint m-0 text-[11.5px] leading-[1.7]">
            근접도는 원래 자리에서 <Num>1km</Num> 멀어질 때마다 <Num>5</Num>점씩 깎아{' '}
            <Num>0~100</Num> 사이에 둡니다.
          </p>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">한적도의 반영 비율을 반드시 가장 높게 둡니다.</strong>{' '}
          한적한 곳으로 사람을 보내는 것이 추천의 목적 자체이고, 이 규칙은 문서가 아니라 코드가
          강제합니다 — 근접도가 한적도보다 크면 서버가 뜨지 않습니다. 설문에서 혼잡 민감도를 고르면
          비율이 <Num>55:45</Num> · <Num>70:30</Num> · <Num>85:15</Num>로 갈리는데,{' '}
          <strong className="text-fg font-semibold">화면은 비율을 적어 두지 않고 서버가 준 값을 그대로
          그립니다.</strong> 화면에 박아 두면 가중치가 바뀔 때 한쪽만 고쳐져 두 값이 어긋납니다.
        </p>
        <div className="bg-moderate-tint rounded-ui flex items-start gap-2.5 px-3.5 py-3">
          <span className="bg-moderate mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
          <p className="text-moderate-deep m-0 text-[12px] leading-[1.7]">
            <strong className="font-semibold">추천도는 100점 만점이 아닙니다.</strong> 실측 분포가{' '}
            <Num>25~80</Num> · 중앙 <Num>53</Num>입니다(150건). 구조상 100이 나올 수 없는데 중앙값 53을
            그대로 내걸면 낙제로 읽혀, 화면은 숫자를 <strong className="font-semibold">구간 문구</strong>로
            옮겨 세웁니다. 경계는 임의의 70/50이 아니라 실측 1·3분위수(<Num>46</Num> / <Num>64</Num>)입니다.{' '}
            <Measured on="2026-08-29 실측" />
          </p>
        </div>
      </div>

      {/* 3. 두 출처 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="③ 출처가 둘이고, 자리를 나눠 줍니다" measured="2026-09-01 실측" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="bg-bg rounded-ui flex flex-col gap-1 p-3.5">
            <p className="text-brand-deep m-0 text-[12px] font-semibold">연관 관광지 API</p>
            <p className="text-muted m-0 text-[12px] leading-[1.7]">
              함께 많이 방문되는 곳. <strong className="text-fg font-semibold">인기도 하한을 겸합니다</strong>{' '}
              — 아무도 함께 가지 않는 곳은 이 목록에 나오지 않습니다.
            </p>
            <p className="text-hint m-0 text-[11px] leading-[1.6]">
              근거 문구 · "OO에 다녀간 사람들이 함께 찾은 곳 중에서 골랐어요"
            </p>
          </div>
          <div className="bg-bg rounded-ui flex flex-col gap-1 p-3.5">
            <p className="text-brand-deep m-0 text-[12px] font-semibold">지역 카탈로그</p>
            <p className="text-muted m-0 text-[12px] leading-[1.7]">
              같은 지역의 관광지 전체. 인기도 하한이 없으므로{' '}
              <strong className="text-fg font-semibold">나머지 조건을 그대로 지킵니다.</strong>
            </p>
            <p className="text-hint m-0 text-[11px] leading-[1.6]">
              근거 문구 · "OO 근처의 비슷한 곳 중에서 골랐어요"
            </p>
          </div>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          연관 후보만 보면 <strong className="text-fg font-semibold">관광지 넷 중 셋이 대안을 얻지
          못했습니다</strong>(경주 25.6% · 제주시 30.9% · 서귀포 33.7%). 그래서 지역 카탈로그를 함께 보되{' '}
          <strong className="text-fg font-semibold">그냥 섞지는 않습니다</strong> — 지역 후보가 연관 후보보다{' '}
          <Num>5~6</Num>배 많아(제주시 <Num>698</Num> vs <Num>125</Num>) 상위권을 쓸어가기 때문입니다.
          섞어서 추천도로 자르면 연관이 상위 3에 하나도 못 드는 자리가 제주시 <Num>57%</Num> · 서귀포{' '}
          <Num>37%</Num>였습니다.
        </p>
        <div className="bg-quiet-tint rounded-ui flex items-start gap-2.5 px-3.5 py-3">
          <span className="bg-quiet mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
          <p className="text-quiet-deep m-0 text-[12px] leading-[1.7]">
            <strong className="font-semibold">품질이 밀려서가 아닙니다.</strong> 같은 실측에서 추천도
            중앙값은 같거나 연관이 오히려 높았습니다(경주 <Num>53.5</Num> vs <Num>52.0</Num> · 서귀포{' '}
            <Num>62</Num> vs <Num>57</Num>). 순전히 <strong className="font-semibold">표본 크기</strong>{' '}
            문제라 크기와 무관한 장치로 풉니다 — <strong className="font-semibold">출처마다 한 자리씩
            보장하고 남은 자리를 겨루게</strong> 합니다. 가중치로 보정하면 배율이 지역마다 달라
            (<Num>4.9~6.4</Num>배) 값의 근거가 없고, 무엇보다 인기도를 점수에 넣는 것이 되어 과제와
            어긋납니다.
          </p>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          자리 보장은 <strong className="text-fg font-semibold">인기도 하한도 함께 지킵니다</strong> — 한
          자리는 언제나 연관, 곧 실제로 함께 가는 곳입니다. 그리고 그 보장 안에서도{' '}
          <strong className="text-fg font-semibold">가중 무작위로 뽑습니다.</strong> 출처별 1등을 늘 세우면
          분산을 지키려던 장치가 도리어 분산을 죽입니다.
        </p>
        <div className="bg-bg rounded-ui flex items-baseline justify-between gap-3 p-3.5">
          <span className="text-muted text-[12.5px]">대안 3개를 채운 자리</span>
          <span className="text-[13px] font-semibold">
            <span className="text-crowded-deep">
              <Num>41%</Num>
            </span>
            <span className="text-hint mx-1">→</span>
            <span className="text-quiet-deep">
              <Num>86%</Num>
            </span>
          </span>
        </div>
      </div>

      {/* 4. 빈 목록 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="④ 비었을 때 왜 비었는지 말합니다" measured="2026-08-25 실측" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          개선폭 하한 때문에 <strong className="text-fg font-semibold">목록이 비는 일이 흔합니다</strong> —
          대안이 있던 자리의 <Num>36~51%</Num>가 빈 목록이 됩니다. 그런데 비는 이유가 서로 완전히 다릅니다.
          원래 장소가 이미 한적한 것과 대신할 곳을 못 찾은 것은{' '}
          <strong className="text-fg font-semibold">사용자에게 정반대의 소식</strong>인데, 같은 빈 화면으로
          뭉개면 둘 다 "이 서비스는 데이터가 부실하다"로 읽힙니다.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {[
            {
              tone: 'quiet' as const,
              label: '이미 한적함',
              text: '여기는 이미 한적한 편이에요. 굳이 바꾸지 않아도 좋아요.',
            },
            {
              tone: 'plain' as const,
              label: '코스에 있음',
              text: '더 한적한 곳들이 이미 이 날 코스에 담겨 있어요.',
            },
            {
              tone: 'plain' as const,
              label: '개선폭 미달',
              text: '지금보다 눈에 띄게 한적한 곳을 찾지 못했어요.',
            },
            {
              tone: 'plain' as const,
              label: '후보 없음',
              text: '이 자리를 대신할 만한 곳을 찾지 못했어요.',
            },
            {
              tone: 'plain' as const,
              label: '예측 대상 아님',
              text: '예상 혼잡을 알 수 없는 곳이라 추천 순서를 매기지 못해요.',
            },
          ].map((row) => (
            <li
              key={row.label}
              className={`rounded-ui flex flex-col gap-0.5 px-3.5 py-2.5 ${
                row.tone === 'quiet' ? 'bg-quiet-tint' : 'bg-bg'
              }`}
            >
              <span
                className={`text-[10.5px] font-semibold tracking-[0.06em] ${
                  row.tone === 'quiet' ? 'text-quiet-deep' : 'text-hint'
                }`}
              >
                {row.label}
              </span>
              <span
                className={`text-[12.5px] leading-[1.6] ${
                  row.tone === 'quiet' ? 'text-quiet-deep' : 'text-muted'
                }`}
              >
                {row.text}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          맨 위 하나가 특히 중요합니다. 하한 때문에 사라지는 자리의 대부분이{' '}
          <strong className="text-fg font-semibold">원래 자리가 이미 한적한 곳</strong>입니다 — 경주는 25곳
          중 22곳이 그랬습니다. <strong className="text-fg font-semibold">이것은 실패가 아니라
          성공인데</strong>, "찾지 못했어요"로 뭉개면 잘 고른 사용자에게 서비스가 사과하는 꼴이 됩니다.
          그래서 문구를 화면이 아니라 <strong className="text-fg font-semibold">서버가 들고 있습니다</strong>{' '}
          — 하한을 3점으로 낮추는 날 문구도 함께 손봐야 하는데, 문구가 화면에 있으면 그 사실을 아무도
          모릅니다.
        </p>
      </div>
    </Section>
  )
}

/* ── 날짜 대안 ────────────────────────────────────────────── */

/**
 * 날짜를 옮기는 회피 경로.
 *
 * <p>접수 때 낸 서비스 개요가 <b>회피 경로 둘</b>을 약속했다 — 날짜와 장소. 장소 쪽이
 * 훨씬 두꺼워 보여 이 경로가 곁가지처럼 읽히기 쉬운데, 실제로는 <b>먼저 물어야 할 쪽</b>이다.
 * 날짜 하나를 옮기면 코스 전체의 한적도가 함께 움직인다.
 */
function TimeOffSection() {
  return (
    <Section
      id="time-off"
      lead="장소를 바꾸는 대신 날짜를 옮기는 길입니다. 코스는 그대로 두고 하루를 옮기면 모든 칸의 한적도가 함께 바뀝니다."
    >
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="앞뒤로 사흘씩, 이레를 봅니다" measured="설계 규칙 · 상한 앞뒤 14일" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">앞으로만 보지 않습니다.</strong> 앞만 보면 사용자가
          날짜를 옮긴 뒤 원래 날짜로 돌아갈 수 없습니다 — 옮긴 날짜를 기준으로 다시 물으면 이전 날짜는
          창 밖(과거)이라 목록에 영영 나오지 않습니다. 앞뒤로 열어 두면 되돌아갈 날짜가 늘 목록 안에
          있습니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">사흘인 이유</strong>는 여행 날짜를 옮길 수 있는 폭이
          현실적으로 주말 하나를 넘지 않기 때문입니다. 넓게 열어 두면{' '}
          <strong className="text-fg font-semibold">"두 주 뒤가 가장 한적합니다"</strong> 같은, 실행할 수
          없는 제안이 위로 올라옵니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          더 붐비는 날과 고를 수 없는 날도 함께 내려보냅니다. 화면이{' '}
          <strong className="text-fg font-semibold">날짜를 고르는 표</strong>로 쓰이기 때문입니다 —
          되돌아갈 날짜와 견줄 대상이 함께 있어야 표가 표 구실을 합니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="다섯 상태로 답하고, 순서가 규칙입니다" measured="설계 규칙" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          예전에는 참·거짓 하나였습니다. 그러면 화면이 할 수 있는 말이 둘뿐인데,{' '}
          <strong className="text-fg font-semibold">"더 나은 날이 없다"와 "자료를 못 불러왔다"와 "이미
          충분히 한적하다"는 전혀 다른 소식</strong>입니다. 위에서부터 먼저 들어맞는 것을 씁니다 —
          조건을 나란히 두면 둘이 동시에 참일 때 어느 쪽을 보여줄지가 코드 순서로 우연히 정해집니다.
        </p>
        {/*
         * ⚠️ 색 둘이 <b>같은 자의 두 눈금이 아니다.</b> ②의 초록은 등급 신호(그 날이 실제로
         * 한적하다)이고 ⑤의 틸은 강조(화면이 개선폭을 내세워도 되는 유일한 상태)다.
         * 팔레트가 둘에게 다른 자리를 준 그대로 쓴 것이지, 5단계 색 눈금이 아니다.
         */}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {[
            { no: 1, label: '자료 부족', text: '날짜 정보를 충분히 불러오지 못했어요' },
            { no: 2, label: '이미 한적', text: '지금 일정도 충분히 여유로워요', tone: 'quiet' as const },
            { no: 3, label: '지금이 최선', text: '선택한 날짜가 앞뒤 며칠 중 가장 한적해요' },
            { no: 4, label: '차이 미미', text: '날짜별 혼잡 차이가 크지 않아요' },
            { no: 5, label: '권함', text: '더 한적한 날짜가 있어요', tone: 'brand' as const },
          ].map((row) => (
            <li
              key={row.no}
              className={`rounded-ui flex items-baseline gap-2.5 px-3.5 py-2.5 ${
                row.tone === 'quiet' ? 'bg-quiet-tint' : row.tone === 'brand' ? 'bg-brand-tint' : 'bg-bg'
              }`}
            >
              <span className="text-hint font-mono text-[11px] font-semibold">{row.no}</span>
              <span
                className={`flex-none text-[11px] font-semibold ${
                  row.tone === 'quiet' ? 'text-quiet-deep' : 'text-hint'
                }`}
              >
                {row.label}
              </span>
              <span
                className={`text-[12.5px] leading-[1.6] ${
                  row.tone === 'quiet' ? 'text-quiet-deep' : 'text-muted'
                }`}
              >
                {row.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          ② 가 특히 중요합니다. 코스 전체가 이미 한적한데 <Num>1</Num>점 더 나은 날을 들이밀면 서비스가{' '}
          <strong className="text-fg font-semibold">쓸데없이 참견하는 것</strong>이 됩니다. 개별 장소가
          붐비는 문제는 장소 교체가 맡습니다 — 칸 하나가 붐빈다고 여행 날짜 전체를 옮기라고 할 일은
          아닙니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-2 p-4.5`}>
        <CardHead title="옮기라고 권하는 최소 개선폭" measured="분석 검증 전 임시값" />
        <p className="text-brand-deep m-0 text-[17px] font-semibold tracking-[-0.01em]">
          한적도 <Num>+5</Num>점
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          장소 교체의 하한과 <strong className="text-fg font-semibold">값은 같지만 상수를 나눠
          두었습니다.</strong> 날짜를 옮기는 것은 숙소·교통까지 딸린 큰 결정이고 장소 하나를 바꾸는 것은
          가볍습니다 — 실행 비용이 다르니 언제든 갈릴 값이고, 지금 같다는 이유로 묶어 두면 한쪽을
          조정할 때 다른 쪽이 딸려 옵니다. 이 값도 화면에 적지 않고{' '}
          <strong className="text-fg font-semibold">응답에 실어 보냅니다.</strong>
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          동점이면 <strong className="text-fg font-semibold">기준일에 가까운 날</strong>을, 그래도 같으면
          이른 날을 고릅니다. 이미 잡아 둔 일정에서 덜 움직이는 쪽이 실행 가능성이 높습니다.
        </p>
      </div>
    </Section>
  )
}

/* ── 지역 추천 챗봇 ────────────────────────────────────────── */

function RegionOffSection() {
  return (
    <Section
      id="region-off"
      lead="아직 어디로 갈지 안 정한 사람의 입구입니다. 질문 하나를 지역 카드 둘로 바꿉니다."
    >
      <div className="bg-moderate-tint rounded-card flex items-start gap-2.5 px-4 py-3.5">
        <span className="bg-moderate mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
        <p className="text-moderate-deep m-0 text-[12.5px] leading-[1.7]">
          <strong className="font-semibold">이름과 달리 "다른 데 가라"가 아닙니다.</strong> 지역을 이미
          정한 사람에게 바꾸라고 하지 않습니다. 나머지 기능이 전부{' '}
          <strong className="font-semibold">지역을 정했다고 전제</strong>하는데, 여행의 첫 결정은 "어디
          갈까"라 그 자리가 비어 있었습니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="층이 셋이고, 가운데가 우리 것입니다" measured="설계 규칙" />
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-hint text-[11px] font-semibold">LLM ①</span>
            <span className="text-muted text-[12.5px] leading-[1.7]">
              질문 → 관심사 · 기간 조각. <strong className="text-fg font-semibold">고르기와 읽기만</strong>{' '}
              시킵니다.
            </span>
          </li>
          <li className="bg-brand-tint rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-brand-deep text-[11px] font-semibold">서버</span>
            <span className="text-fg text-[12.5px] leading-[1.7]">
              그것으로 <strong className="font-semibold">지역과 날짜를 정합니다. 판단은 전부 여기</strong>서
              일어납니다.
            </span>
          </li>
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-hint text-[11px] font-semibold">LLM ②</span>
            <span className="text-muted text-[12.5px] leading-[1.7]">
              우리가 준 값 → 문장. <strong className="text-fg font-semibold">옮기기만</strong> 시킵니다.
            </span>
          </li>
        </ol>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">위아래가 다 죽어도 가운데는 돕니다.</strong> ①이 없으면
          관심사 없이 한적한 곳을 고르고, ②가 없으면 서버 템플릿이 문장을 씁니다. 인증키가 없거나 하루
          상한에 닿아도 오류가 아니라 설문으로 안내합니다 — 화면 한 칸이 빨갛게 죽는 것이 더 손해입니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="LLM에게 시키지 않는 것 둘" measured="2026-09 실측" />
        <div className="flex flex-col gap-1">
          <p className="text-fg m-0 text-[13px] font-semibold">지역을 고르게 하지 않습니다</p>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            막는 방법이 프롬프트가 아니라 <strong className="text-fg font-semibold">응답 스키마에 지역
            칸을 만들지 않는 것</strong>입니다. 프롬프트로 금지하면 언젠가 넘어오지만, 받을 칸이 없으면
            넘어올 자리가 없습니다. 같은 이유로 관심사도 자유 문자열이 아니라{' '}
            <strong className="text-fg font-semibold">정해진 아홉</strong> 중 하나입니다.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-fg m-0 text-[13px] font-semibold">날짜 산수를 시키지 않습니다</p>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            "며칠 뒤냐"를 숫자로 물었더니 <strong className="text-fg font-semibold">"10월 중순"을{' '}
            <Num>45</Num>일로 읽었습니다</strong>(실제 <Num>38</Num>일). 오늘이 며칠인지 알려준 적이
            없으니 답할 수 없는 것을 물어본 셈입니다. 모델은{' '}
            <strong className="text-fg font-semibold">조각만 읽고</strong>, 달력은 서버가 봅니다.
          </p>
        </div>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="물어본 기간만 셉니다" measured="2026-09-08 실측" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          기간을 안 말하면 예측이 닿는 기간 전체를, 말하면 그 며칠만 셉니다.{' '}
          <strong className="text-fg font-semibold">사소한 차이가 아닙니다</strong> — 같은 자료를 창만 바꿔
          재면 순위가 뒤집힙니다.
        </p>
        <div className="bg-bg rounded-ui flex flex-col gap-2 p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">서귀포시 · 30일 창</span>
            <span className="text-hint font-mono text-[12.5px]">꼴찌 20.2%</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-fg text-[12.5px] font-semibold">서귀포시 · 9/12~13 주말</span>
            <span className="text-quiet-deep font-mono text-[12.5px] font-semibold">1위 21.8%</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">통영시 · 30일 → 그 주말</span>
            <span className="text-crowded-deep font-mono text-[12.5px]">51.6% → 16.5%</span>
          </div>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          주말을 물은 사람에게 한 달 평균으로 답하는 것은 정밀도 문제가 아니라{' '}
          <strong className="text-fg font-semibold">틀린 지역을 주는 일</strong>입니다. 창 밖을 물으면
          카드를 주지 않고 "아직 예측이 나오지 않았어요"라고 합니다 — 지금 창의 지역을 붙이면 사용자가
          그것을 물어본 시점의 답으로 읽습니다. 달력으로 셀 수 없는 말("추석 연휴"·"단풍철")은 모델
          지식에 기대야 하므로 읽지 않습니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="카드에 적히는 숫자는 평균이 아닙니다" measured="설계 규칙" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          그 기간의 <strong className="text-fg font-semibold">(장소 × 날짜) 관측 중 한적(65+)인 관측의
          비율</strong>입니다. 지역 평균 한적도가 아닙니다 — 열한 곳이 전부 <Num>48~63</Num>으로
          "보통"이라 평균으로는 카드가 서로 구분되지 않습니다. 비율로 세면 제주시 <Num>17%</Num>에서 통영{' '}
          <Num>52%</Num>까지 벌어집니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          ⚠️ 이 값에는 <strong className="text-fg font-semibold">3단계 배지를 붙이지 않습니다.</strong>{' '}
          <Num>65</Num>/<Num>35</Num>는 한적도의 경계라 이 값에는 뜻이 없습니다. 문구를 가르는 기준도
          따로입니다 — <Num>40%</Num> 이상이면 "한적한 곳이 많은 편이에요", 아래면 "덜 붐비는 편이에요".{' '}
          <Num>18%</Num>인데 "한적한 곳이 많다"고 하면 <strong className="text-fg font-semibold">화면이
          스스로 모순됩니다.</strong>
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="두 장 다 한적한 쪽에서 고릅니다" measured="2026-09-08 되돌림" />
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-fg text-[12.5px] font-semibold">거르기 · 관심사의 몫이 중앙값 이상</span>
            <span className="text-muted text-[12px] leading-[1.7]">
              관심사는 <strong className="text-fg font-semibold">문이지 점수가 아닙니다.</strong> 분류마다
              몫의 크기가 달라(음식 17~45% · 체험 2~6%) 절대 등급을 세울 수 없으므로, 그 분류 안에서
              상대적으로 강한 절반만 남깁니다.
            </span>
          </li>
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-fg text-[12.5px] font-semibold">자르기 · 한적한 순 위쪽 절반</span>
            <span className="text-muted text-[12px] leading-[1.7]">
              바닥으로 <strong className="text-fg font-semibold">최소 <Num>4</Num>곳</strong>을 둡니다.
              관심사가 좁으면 후보가 다섯뿐이라 절반만 남기면 통이 둘~셋이 되고, 그러면 늘 같은 조합이
              나가 <strong className="text-fg font-semibold">그곳이 새로운 혼잡지</strong>가 됩니다.
            </span>
          </li>
          <li className="bg-brand-tint rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-fg text-[12.5px] font-semibold">뽑기 · 그 통에서 둘을 균등 무작위</span>
            <span className="text-fg text-[12px] leading-[1.7]">
              가중이 아니라 <strong className="font-semibold">균등</strong>입니다. 자격으로 이미 자른 뒤
              남은 점수 차는 우열이 아니라 같은 등급 안의 잔차입니다.
            </span>
          </li>
        </ol>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          ⚠️ 한때 <strong className="text-fg font-semibold">아래쪽에서 하나를 일부러 끼웠다가
          되돌렸습니다.</strong> "붐비는 곳이 하나 섞여야 차이가 보인다"고 만들었는데, 추천받는 사람에게는{' '}
          <strong className="text-fg font-semibold">고를 것이 하나뿐</strong>이었습니다. 한산한 곳으로
          사람을 보내는 것이 목적인 서비스가 덜 한산한 곳에 한 자리를 보장하고 있었습니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="계산하지 않은 것을 말하지 않게 막습니다" measured="실제로 나온 답에서" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          LLM이 쓴 문장은 검증을 통과해야 카드에 오릅니다 — <Num>40</Num>자 이하 ·{' '}
          <strong className="text-fg font-semibold">숫자 금지</strong>(카드의 숫자는 전부 서버가 계산합니다)
          · 다른 지역 이름 금지 · 금칙어. 걸리면 템플릿이 그 자리를 지킵니다.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {[
            {
              words: '지금 · 현재 · 실시간 · 오늘 · 요즘',
              why: '공사 자료는 예측이다 — "여수는 지금 아주 한적해요"',
            },
            {
              words: '이번 주 · 이번 달',
              why: '어느 기간을 봤는지는 서버가 말한다. 모델이 적으면 한 달치를 보고 이레의 이야기인 척한다',
            },
            {
              words: '방문객 · 관광객 · 인파 · 유명',
              why: '우리는 사람 수를 세지 않는다 — "제주시는 방문객이 많은 편이에요"',
            },
          ].map((row) => (
            <li key={row.words} className="bg-crowded-tint rounded-ui flex flex-col gap-0.5 px-3.5 py-2.5">
              <span className="text-crowded-deep text-[12.5px] font-semibold">{row.words}</span>
              <span className="text-crowded-deep text-[11.5px] leading-[1.6] opacity-90">{row.why}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/* ── 설문 코스 초안 ────────────────────────────────────────── */

function FullPeakoffSection() {
  return (
    <Section
      id="full"
      lead="지역만 알고 어디를 담을지 모르는 사람에게 코스 초안을 만들어 줍니다. 사후 교정이 아니라 사전 분산 유도라, 과제 해결 측면에서는 이쪽이 더 강합니다."
    >
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="문항이 둘뿐인 것은 줄인 결과입니다" measured="2026-08-27" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          넷이었다가 둘을 걷어냈습니다. 지킬 규칙이 하나 있어서입니다 —{' '}
          <strong className="text-fg font-semibold">어느 답을 골라도 코스가 나와야 합니다.</strong> 고른
          대가로 결과가 비는 문항은 선택지가 아니라 함정입니다.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <li className="bg-crowded-tint rounded-ui flex flex-col gap-0.5 px-3.5 py-2.5">
            <span className="text-crowded-deep text-[12.5px] font-semibold">걷어냄 · 여행 스타일</span>
            <span className="text-crowded-deep text-[11.5px] leading-[1.6] opacity-90">
              하나만 고르면 후보가 제주시 3곳·서귀포 2곳으로 쪼그라들었다
            </span>
          </li>
          <li className="bg-crowded-tint rounded-ui flex flex-col gap-0.5 px-3.5 py-2.5">
            <span className="text-crowded-deep text-[12.5px] font-semibold">걷어냄 · 이동수단</span>
            <span className="text-crowded-deep text-[11.5px] leading-[1.6] opacity-90">
              대중교통을 고르면 반경 8km 밖이 통째로 잘렸다
            </span>
          </li>
        </ul>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          둘 다 <strong className="text-fg font-semibold">"고른 답이 후보를 거른다"</strong>는 같은
          병이었습니다. 남은 두 문항은 후보를 거르지 않습니다 — 밀도는 슬롯 수만, 민감도는 점수 비중과
          하한만 바꿉니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="남은 두 문항이 바꾸는 것" measured="설계 규칙" />
        <div className="flex flex-col gap-1.5">
          <p className="text-fg m-0 text-[13px] font-semibold">일정 밀도 · 하루에 몇 칸</p>
          <div className="bg-bg rounded-ui flex flex-col gap-1.5 p-3.5">
            {[
              ['여유', '2~3칸'],
              ['적당', '3~4칸'],
              ['알차게', '4~5칸'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="text-muted text-[12.5px]">{label}</span>
                <span className="text-brand-deep text-[12.5px] font-semibold">
                  <Num>{value}</Num>
                </span>
              </div>
            ))}
          </div>
          <p className="text-hint m-0 text-[11.5px] leading-[1.7]">
            범위 안에서 <strong className="text-muted font-semibold">날마다 다시 뽑습니다.</strong> 장소만
            분산하고 코스 골격이 늘 같으면 결국 같은 동선이 됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-fg m-0 text-[13px] font-semibold">혼잡 민감도 · 점수와 후보군</p>
          <div className="bg-bg rounded-ui flex flex-col gap-1.5 p-3.5">
            {[
              ['유명한 곳 위주', '55:45', '후보군 제한 없음'],
              ['적당히 섞기', '70:30', '후보군 8곳'],
              ['한적한 곳 위주', '85:15', '후보군 5곳 · 붐빔 제외'],
            ].map(([label, ratio, pool]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted text-[12.5px]">{label}</span>
                  <span className="text-brand-deep text-[12.5px] font-semibold">
                    <Num>{ratio}</Num>
                  </span>
                </div>
                <span className="text-hint text-[11px]">{pool}</span>
              </div>
            ))}
          </div>
          <p className="text-hint m-0 text-[11.5px] leading-[1.7]">
            <strong className="text-muted font-semibold">세 답 모두 한적도의 비중이 가장 큽니다.</strong>{' '}
            "유명한 곳 위주"를 골라도 인기도가 가점이 되지는 않습니다 — 그것은 과제와 정면으로 어긋나서,
            설문 답 하나로 뒤집을 수 있는 것이 아닙니다. 명소가 코스에 오르게 하는 장치는{' '}
            <strong className="text-muted font-semibold">후보군을 자르지 않는 것</strong>과 한적도 하한을
            걸지 않는 것입니다.
          </p>
        </div>
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="거리는 둘로 막습니다" measured="분석 검증 전 임시값" />
        <div className="bg-bg rounded-ui flex flex-col gap-1.5 p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">그 날 첫 장소로부터의 반경</span>
            <span className="text-brand-deep text-[12.5px] font-semibold">
              <Num>25km</Num>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">직전 장소에서 다음 장소까지</span>
            <span className="text-brand-deep text-[12.5px] font-semibold">
              <Num>15km</Num>
            </span>
          </div>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">둘인 이유</strong>는 슬롯 간 거리만 제한하면 짧은
          이동이 이어져 하루 동안 한 방향으로 계속 밀려날 수 있기 때문입니다 — <Num>5km</Num>씩 네 번이면{' '}
          <Num>20km</Num>입니다. 날 단위 반경이 그 표류를 막습니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          이동수단 문항을 걷어내면서 자차(<Num>25km</Num>)와 대중교통(<Num>8km</Num>) 중{' '}
          <strong className="text-fg font-semibold">넓은 쪽을 남겼습니다.</strong> 좁은 쪽으로 두면
          고치려던 "추천이 안 뜬다"가 그대로 다시 생깁니다. 거리는 좌표 기반 직선거리이지 실제 도로·환승
          시간이 아닙니다 — 최단 경로 최적화는 이 서비스의 범위가 아니고, "하루에 다닐 만한가"만 가리면
          충분합니다.
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-2 p-4.5`}>
        <CardHead title="후보는 대표 관광지 100곳에서" measured="설계 규칙" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          공사 <strong className="text-fg font-semibold">중심 관광지</strong>(실제 이동 데이터 기반 순위)
          상위 <Num>100</Num>곳을 원천으로 삼고, 거기서{' '}
          <strong className="text-fg font-semibold">코스에 어울리지 않는 분류만</strong> 뺍니다 —
          음식점·숙박·축제, 그리고 문화·명소에 섞여 있는 리조트·도서관·수련관. 그 뒤는 장소 교체와 같은
          장치를 씁니다: 추천도를 매기고, 상위 후보군에서 가중 무작위로 한 칸씩 채웁니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          <strong className="text-fg font-semibold">1등을 그대로 쓰지 않는 이유가 여기서도 같습니다.</strong>{' '}
          같은 장소가 모든 사용자에게 추천되면 그곳이 새로운 혼잡지가 됩니다. 붐비는 곳을 피하라고 안내해
          놓고 한 곳으로 몰아주면 서비스가 직접 2차 오버투어리즘을 만드는 셈입니다.
        </p>
      </div>
    </Section>
  )
}

/* ── 분산 ──────────────────────────────────────────────────── */

/**
 * 뽑기가 실제로 어떻게 도는지 편다.
 *
 * <p>발표에서 가장 값이 나가는 자리다 — <b>추천 서비스가 스스로 만드는 혼잡</b>을 어떻게
 * 막았는가는 되묻고 싶어지는 질문이고, 답이 실측으로 준비돼 있다.
 */
function SpreadSection() {
  return (
    <Section
      id="spread"
      lead="동일한 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 됩니다. 오버투어리즘을 풀겠다는 서비스가 오버투어리즘을 만드는 셈입니다. 위 네 경로가 모두 이 장치를 지납니다."
    >
      {/* 뽑기 방식 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="점수에 비례하되, 매번 같지는 않게" measured="설계 규칙" />
        {/* 한글에 고정폭을 씌우지 않는다 — 자간이 벌어져 낱말이 쪼개진다. 추천도 칸과 같은 규칙. */}
        <div className="bg-bg rounded-ui flex flex-col gap-2.5 p-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted text-[12.5px]">뽑힐 무게</span>
              <span className="text-brand-deep text-[12.5px] font-semibold">
                추천도<sup className="ml-px text-[9px]">1.2</sup>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted text-[12.5px]">상위 후보군</span>
              <span className="text-brand-deep text-[12.5px] font-semibold">
                <Num>3</Num>곳
              </span>
            </div>
          </div>
          <p className="text-hint m-0 text-[11.5px] leading-[1.7]">
            중복 없이 뽑고, 부를 때마다 다시 계산합니다.
          </p>
        </div>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          지수가 <Num>1</Num>이면 점수에 그대로 비례하고, 클수록 상위 후보에 쏠립니다.{' '}
          <Num>1.2</Num>는 <strong className="text-fg font-semibold">높은 점수가 더 자주 뽑히되 1등이
          고정되지는 않는</strong> 자리입니다. 후보군을 <Num>3</Num>으로 자르기 때문에 뽑히는 것은 언제나
          "충분히 좋은 후보" 안에서입니다 — 거르기를 뽑기 뒤로 미루면 자격 미달 후보가 무작위로 1등이 될
          수 있습니다.
        </p>
      </div>

      {/* 고쳤을 때의 변화 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="이 장치가 오래도록 아무 일도 안 하고 있었습니다" measured="2026-08-26 · 09-03 실측" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          같은 자리를 <Num>40</Num>번 물어도 1등이 한 번도 바뀌지 않았습니다. 값은 전부 맞게 들어 있었고,
          죽인 것은 <strong className="text-fg font-semibold">구현 두 가지</strong>였습니다.
        </p>
        <ol className="text-muted m-0 flex list-none flex-col gap-2.5 p-0">
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-fg text-[12.5px] font-semibold">
              화면이 후보군보다 많이 요청했다
            </span>
            <span className="text-[12px] leading-[1.7]">
              후보군이 셋인데 여덟을 달라고 하면 <strong className="text-fg font-semibold">"다 가져가라"와
              같아</strong> 후보군이라는 개념이 무의미해집니다. 화면도 후보군 크기만큼만 요청합니다.
            </span>
          </li>
          <li className="bg-bg rounded-ui flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-fg text-[12.5px] font-semibold">뽑은 뒤 점수순으로 다시 정렬했다</span>
            <span className="text-[12px] leading-[1.7]">
              뽑힌 순서가 통째로 덮여 <strong className="text-fg font-semibold">최고점이 언제나
              1등</strong>이 됐습니다. 자격 후보가 20곳이나 되는 자리에서도 1등이 68~82% 고정이었는데,
              데이터가 모자라서가 아니라 이 정렬 때문이었습니다.
            </span>
          </li>
        </ol>

        <div className="bg-bg rounded-ui flex flex-col gap-2.5 p-3.5">
          <p className="text-fg m-0 text-[12.5px] font-semibold">고친 뒤</p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">1등이 고정되는 비율</span>
            <span className="font-mono text-[13px] font-semibold">
              <span className="text-crowded-deep">95~100%</span>
              <span className="text-hint mx-1">→</span>
              <span className="text-quiet-deep">38~42%</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted text-[12.5px]">홈 60자리에 선 서로 다른 장소</span>
            <span className="text-[13px] font-semibold">
              <span className="text-crowded-deep">
                <Num>20</Num>곳
              </span>
              <span className="text-hint mx-1">→</span>
              <span className="text-quiet-deep">
                <Num>50</Num>곳
              </span>
            </span>
          </div>
          <p className="text-hint m-0 text-[11px] leading-[1.6]">
            이론상 기대값은 약 <Num>35%</Num>입니다. 1등이 세 종류씩 돌아갑니다.
          </p>
        </div>
      </div>

      {/* 정렬 · 재추첨 */}
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <CardHead title="뽑은 뒤에 지키는 것 둘" measured="2026-08-26 · 08-30" />
        <div className="flex flex-col gap-1">
          <p className="text-fg m-0 text-[13px] font-semibold">
            정렬은 <strong className="text-brand-deep">구간 단위까지만</strong> 합니다
          </p>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            점수로 줄 세우지 않되 아무 순서도 아니면 "(문구 없음)"이 "이날 가기 좋아요" 위에 서서 고장으로
            읽힙니다. 구간까지만 세우면{' '}
            <strong className="text-fg font-semibold">줄 세운 값이 카드에 적힌 문구 그 자체</strong>라
            설명이 서고, 같은 구간 안은 뽑힌 차례 그대로라 분산도 삽니다. ⚠️ 그래서 "추천도가 높은 순"
            같은 문구를 두면 화면이 거짓말을 합니다 — 정렬과 문구는 한 몸입니다.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-fg m-0 text-[13px] font-semibold">
            뽑은 목록을 <strong className="text-brand-deep">세션에 저장</strong>합니다
          </p>
          <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
            화면이 다시 그려질 때마다 다시 뽑지 않습니다. 대안 시트를 닫았다 열었을 뿐인데 목록이 바뀌면{' '}
            <strong className="text-fg font-semibold">사용자가 되돌아갈 후보를 찾지 못합니다.</strong> 다시
            뽑는 것은 사용자가 새 추천을 <strong className="text-fg font-semibold">직접 요청</strong>했거나
            코스·날짜·지역 조건이 <strong className="text-fg font-semibold">실제로 바뀐</strong> 경우뿐입니다.
          </p>
        </div>
      </div>

      {/* 균등 예외 */}
      <div className={`${CARD} flex flex-col gap-2 p-4.5`}>
        <CardHead title="자격선으로 이미 잘랐다면 균등입니다" measured="2026-09-03 실측" />
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          가중 무작위는 <strong className="text-fg font-semibold">후보들 사이에 우열이 있을 때</strong> 쓰는
          규칙입니다. 자격선으로 먼저 자른 뒤라면 남은 점수 차는 우열이 아니라 같은 등급 안의 잔차이고, 그
          잔차로 확률을 기울이면 넓혀 놓은 후보군에서 결국 위쪽 몇 곳만 나옵니다.
        </p>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          홈의 "이번 주 한적한 곳"이 그랬습니다 — 지역마다 상위 6곳을 이어 와 그중 상위 3곳에서
          가중으로 뽑으니, 곱하면 <strong className="text-fg font-semibold">지역마다 가장 한적한 세 곳이
          전부</strong>라 화면에 한적도 <Num>83~91</Num>만 떴습니다. 후보를{' '}
          <strong className="text-fg font-semibold">지역 상위 35%</strong>로 넓히고 그 안에서는 고르게 뽑자
          한적도가 <Num>70~90</Num>으로 퍼졌습니다. 35%인 이유는 그 경계의 한적도가 지역마다{' '}
          <Num>70~80</Num>이라 <strong className="text-fg font-semibold">전부 한적(65) 등급 안</strong>이기
          때문입니다 — 더 넓히면 보통인 곳을 한적하다고 부르게 됩니다.
        </p>
      </div>

      <div className="bg-crowded-tint rounded-card flex items-start gap-2.5 px-4 py-3.5">
        <span className="bg-crowded mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
        <p className="text-crowded-deep m-0 text-[12.5px] leading-[1.7]">
          <strong className="font-semibold">완성된 추천 목록은 캐시하지 않습니다.</strong> 서버가 결과를
          기억해 모든 사용자에게 같은 목록을 돌려주면 위의 장치가 통째로 죽고, 우리가 미는 곳이 새 혼잡지가
          됩니다. 캐시는 <strong className="font-semibold">공사 응답까지만</strong>이고, 점수 계산과 뽑기는
          매번 다시 합니다.
        </p>
      </div>
    </Section>
  )
}

/* ── 규칙 ──────────────────────────────────────────────────── */

function RulesSection() {
  const rules: { title: string; body: string }[] = [
    {
      title: '실시간이 아니라 예측입니다',
      body: '공사가 주는 것은 방문일별 예측·통계값입니다. 화면 문구를 "실시간 혼잡"이 아니라 "예상 혼잡 / 예측 기반"으로 씁니다. 챗봇이 쓰는 문장도 같은 규칙을 지켜 "지금·오늘·실시간"을 금칙어로 둡니다.',
    },
    {
      title: '계산하지 않은 것을 근거로 말하지 않습니다',
      body: '추천 문구는 실제로 계산한 항목만 반영합니다. 지역 카탈로그에서 고른 후보에게 "함께 많이 찾는 곳"이라 하지 않고, "근처의 비슷한 곳 중에서 골랐어요"라고 말합니다.',
    },
    {
      title: '좌표를 지어내지 않습니다',
      body: '좌표는 공사 값만 쓰고 보완하지 않습니다. 좌표가 없거나 한국 범위 밖인 장소는 버립니다. 틀린 좌표는 없는 것보다 나쁩니다 — 지도에 엉뚱한 데 찍히고 동선 근접도까지 오염됩니다.',
    },
    {
      title: '위치 정보를 서버로 보내지 않습니다',
      body: '지역과 장소는 사용자가 직접 고릅니다. 지도에 "현재 위치" 기능을 두지 않습니다.',
    },
    {
      title: '첫 코스에는 개입하지 않습니다',
      body: '코스 편집 화면에는 한적도를 노출하지 않습니다. 점수를 미리 보여주면 "직접 짠 코스"가 아니라 시스템이 유도한 코스가 되어, 진단의 의미가 사라집니다.',
    },
  ]

  return (
    <Section id="rules">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rules.map((rule) => (
          <li key={rule.title} className={`${CARD} flex flex-col gap-1 p-4`}>
            <p className="text-fg m-0 text-[13.5px] font-semibold">{rule.title}</p>
            <p className="text-muted m-0 text-[12.5px] leading-[1.7]">{rule.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
