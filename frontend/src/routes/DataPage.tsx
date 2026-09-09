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
 * <p>예전에는 "공통 컴포넌트 확인"이었다. 배지 몇 개와 연결 상태만 있던 개발용 화면인데,
 * 화면 구현이 끝나 배지 견본이 할 일을 잃었다. 배지는 아래 <b>경계값</b> 자리로 옮겨
 * "65 / 35가 무엇을 가르는가"를 보이는 데 쓴다 — 견본이 아니라 설명의 일부다.
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
export function PreviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 pb-4">
      <PageHeader />
      <LiveTiles />
      <FlowSection />
      <ScoreSection />
      <ThresholdSection />
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

function Section({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string
  title: string
  lead?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className={KICKER}>{kicker}</p>
        <h2 className={SECTION_TITLE}>{title}</h2>
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
      kicker="FLOW"
      title="공사 응답이 화면에 닿기까지"
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
      kicker="SCORES"
      title="점수는 둘뿐입니다"
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
      kicker="EVIDENCE"
      title="값을 정한 근거"
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
      </div>
    </Section>
  )
}

/* ── 분산 ──────────────────────────────────────────────────── */

function SpreadSection() {
  return (
    <Section
      kicker="ANTI-CONCENTRATION"
      title="같은 곳으로 몰지 않는 장치"
      lead="동일한 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 됩니다. 오버투어리즘을 풀겠다는 서비스가 오버투어리즘을 만드는 셈입니다."
    >
      <div className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          자격을 통과한 상위 후보군을 만든 뒤, 그 안에서{' '}
          <strong className="text-fg font-semibold">점수에 비례한 가중 무작위</strong>로 뽑습니다. 뽑은
          뒤에는 점수순으로 다시 정렬하지 않습니다 — 다시 정렬하면 최고점이 언제나 1등이 되어 이
          장치가 아무 일도 하지 않게 됩니다.
        </p>

        <div className="bg-bg rounded-ui flex flex-col gap-2.5 p-3.5">
          <p className="text-fg m-0 text-[12.5px] font-semibold">고쳤을 때의 변화</p>
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
            이론상 기대값은 약 35%입니다. <Measured on="2026-08-26 · 09-03 실측" />
          </p>
        </div>

        <p className="text-muted m-0 text-[12.5px] leading-[1.7]">
          ⚠️ 후보를 자격선으로 이미 잘랐다면 그 안에서는{' '}
          <strong className="text-fg font-semibold">가중이 아니라 균등</strong>으로 뽑습니다. 남은 점수
          차는 우열이 아니라 같은 등급 안의 잔차이고, 그 잔차로 확률을 기울이면 넓혀 놓은 후보군에서
          결국 위쪽 몇 곳만 나옵니다.
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
    <Section kicker="RULES" title="계산이 지키는 것">
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
