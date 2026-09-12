import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { BrandMark } from '../components/BrandMark'
import { CongestionBadge } from '../components/CongestionBadge'
import { ArrowRight, Heart, User } from '../components/icons'
import { PlacePhotoFallback } from '../components/PlacePhotoFallback'
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/styles'
import { useInView } from '../hooks/useInView'

/**
 * PEAKOFF를 처음 만난 사람에게 <b>쓰면 무엇을 겪게 되는지</b> 보여주는 화면.
 *
 * <h3>짜임 (2026-09-13, 시안을 따라 다시 세웠다)</h3>
 * 일곱 절이 한 이야기다 — 소개 → 문제 → 접근 → 세 가지 발견 → 분산의 원리 → 여행 뒤의 변화
 * → 맺음. 절마다 <b>영문 이름표 · 큰 카피 · 짧은 설명 · 그림 하나</b>가 한 벌이고,
 * 넓은 화면에서는 글이 왼쪽, 그림이 오른쪽에 선다. 좁은 화면에서는 위아래로 쌓인다.
 *
 * <p>⚠️ 시안처럼 한 화면에 눌러 담지 않는다. 절 하나가 한 화면쯤 차지하도록 <b>세로로 길게</b>
 * 편다 — 스크롤하며 한 절씩 읽히는 것이 이 화면의 뜻이다.
 *
 * <h3>읽는 사람은 여행자다</h3>
 * "왜 이렇게 설계했는가"의 근거(실측 분포 · 상관계수 · 서버와 모델의 역할)는 여기 없다.
 * 그건 {@code /data}와 발표가 맡는다. 05절 "분산의 원리"도 <b>원리만</b> 그림으로 말하고
 * 숫자는 적지 않는다.
 *
 * <h3>⚠️ 새 디자인을 만들지 않는다</h3>
 * 시안의 파랑을 옮기지 않았다. 색·글꼴·모서리·그림자는 전부 {@code index.css}의
 * {@code --c-*}와 기존 공통 클래스에서 온다. 강조는 {@code text-brand-deep}(글자용 틸),
 * 콜아웃은 {@code bg-brand-tint}. 그림은 실제 화면의 조각(배지 · 날짜 띠 · 대안 줄 ·
 * 챗봇 말풍선)을 줄여 옮긴 것이라, 소개에서 본 것이 들어가서 그대로 있다.
 *
 * <h3>사진은 세 장, 전부 저장소에 있던 것</h3>
 * 히어로의 바다(홈과 같은 파일), 문제 절의 대비 짝(홈 진입 카드 둘의 사진).
 * 새 파일을 받지 않는다. 특정 관광지가 아닌 풍경만 쓴다 — 관광지 사진을 깔면
 * "여기로 가세요"로 읽히는데, 모두를 한 곳으로 보내지 않는 것이 이 서비스가 하려는 일이다.
 *
 * <h3>계산하지 않은 것을 적지 않는다</h3>
 * 시안의 "분산 기여 +28%"는 앱이 세지 않는 값이라 옮기지 않았다. 06절의 세 지표는 결과
 * 화면이 <b>실제로 세는 것</b>이다 — 코스 총점의 변화, 새로 발견한 곳의 수, 붐비는 자리가
 * 줄어든 수. 값은 전부 예시이고 그렇게 적어 둔다.
 *
 * <h3>스크롤에 따라 나타난다</h3>
 * 규칙은 {@code index.css}의 {@code .reveal} 주석에 있다. 라이브러리 없이
 * {@code useInView}가 속성 하나를 달고 CSS가 나머지를 한다. 움직임을 줄인 사용자와
 * 인쇄에서는 전부 처음부터 보인다.
 */
export function AboutPage() {
  return (
    <div className="relative flex flex-col gap-20 pb-6 md:gap-28">
      <HeroPhoto />
      <Intro />
      <Problem />
      <Approach />
      <Service />
      <HowItWorks />
      <Impact />
      <Ending />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   조각
   ───────────────────────────────────────────────────────────── */

/**
 * 화면에 들어오면 <b>직접 자식들</b>이 차례로 떠오르는 상자.
 * 목록·카드처럼 요소 자체가 상자여야 하는 곳은 {@link useInView}를 직접 붙인다.
 * {@code lead}는 "그림이 먼저" — {@code .reveal-visual}만 바로 나타나고 글은 뒤따른다.
 */
function Reveal({
  lead = false,
  className = '',
  children,
}: {
  lead?: boolean
  className?: string
  children: React.ReactNode
}) {
  const ref = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${className}`} data-lead={lead ? '' : undefined}>
      {children}
    </div>
  )
}

/**
 * 절의 틀. 넓은 화면에서 글(왼쪽 5칸)과 그림(오른쪽 7칸)이 나란히 선다.
 *
 * <p>글과 그림을 <b>따로 등장</b>시킨다 — 한 상자에 넣으면 그림이 글의 stagger 뒤로 밀려
 * 오른쪽이 한참 비어 있다. 그림 쪽은 {@code lead}라 먼저 자리를 잡고, 글이 뒤따른다.
 */
function Band({
  id,
  text,
  visual,
  wide = false,
}: {
  /** 절의 큰 카피에 붙는 id. 절이 그 제목으로 이름을 얻는다 */
  id: string
  text: React.ReactNode
  visual: React.ReactNode
  /** 그림이 넓을 때(카드 셋 · 아이콘 넷) 글을 위에, 그림을 아래 전폭에 둔다 */
  wide?: boolean
}) {
  if (wide) {
    return (
      <section aria-labelledby={id} className="flex flex-col gap-9">
        <Reveal className="flex max-w-[38rem] flex-col gap-4">{text}</Reveal>
        <Reveal lead>
          <div className="reveal-visual">{visual}</div>
        </Reveal>
      </section>
    )
  }
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-1 gap-9 lg:grid-cols-12 lg:items-center lg:gap-12"
    >
      <Reveal className="flex flex-col gap-4 lg:col-span-5">{text}</Reveal>
      <Reveal lead className="lg:col-span-7">
        <div className="reveal-visual">{visual}</div>
      </Reveal>
    </section>
  )
}

/** 절의 이름표 — 번호와 영문 이름. 시안의 "01 INTRO"를 그대로 따른다 */
function Eyebrow({ no, label }: { no: string; label: string }) {
  return (
    <p className="m-0 flex items-center gap-2.5">
      <span className="text-brand-deep font-mono text-[11px] font-semibold tabular-nums">{no}</span>
      <span className="text-hint text-[11px] font-semibold tracking-[0.16em]">{label}</span>
    </p>
  )
}

/** 큰 카피. {@code text-balance}로 마지막 낱말 하나가 떨어지는 것을 막는다 */
function Copy({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-fg m-0 text-[27px] leading-[1.38] font-bold tracking-[-0.02em] break-keep text-balance md:text-[34px]"
    >
      {children}
    </h2>
  )
}

/** 카피 안의 강조. 시안은 파랑, 여기서는 글자용 틸이다 — 밝은 틸은 글자로 서지 못한다 */
function Accent({ children }: { children: React.ReactNode }) {
  return <em className="text-brand-deep not-italic">{children}</em>
}

/**
 * 카피 아래 붙는 설명 문단.
 *
 * <p>{@code break-keep}이 필요하다. 이 저장소는 전역 {@code word-break}를 두지 않아서,
 * 없으면 브라우저가 <b>낱말 가운데를 자른다</b> — 측정에서 "코스 전체가 다 / 시 계산돼요",
 * "대안 관 / 광지", "계산돼 / 요"가 실제로 났다. 한국어 어절은 짧아 넘칠 걱정이 없다.
 */
function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-muted m-0 text-[14.5px] leading-[1.85] break-keep">{children}</p>
}

/**
 * 페이지에 <b>하나뿐인</b> 명제. 03절이 쓴다.
 *
 * <h3>셋에서 하나로 줄였다</h3>
 * 시안은 절마다 오른쪽에 같은 상자를 두는데, 그대로 옮겼더니 같은 민트 상자가 셋이 되어
 * <b>벽지처럼</b> 읽혔다. 기억할 문장이 셋이면 하나도 기억되지 않는다.
 * 나머지 둘은 문단의 마지막 문장으로 내려보냈다 — 02·05의 제목이 이미 그 절의 명제다.
 *
 * <p>안에 있던 로고 마크도 걷었다. 헤더에 진짜 로고가 있는데 본문에서 같은 마크가
 * 장식으로 세 번 더 서면, 마크가 뜻을 잃고 무늬가 된다.
 *
 * <p>점 셋(넘김 표시)은 애초에 옮기지 않았다 — 넘길 문장이 하나뿐인데 점을 두면
 * 거짓 조작이 된다.
 */
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-brand-tint text-fg rounded-card m-0 px-6 py-7 text-center text-[17px] leading-[1.55] font-bold break-keep text-balance md:text-[19px]">
      {children}
    </p>
  )
}

/** 예시임을 적는 한 줄. 화면의 숫자는 전부 예시라 빠짐없이 단다 */
function Example({ children }: { children: React.ReactNode }) {
  return <p className="text-hint m-0 text-[11.5px] leading-[1.6] break-keep">{children}</p>
}

/* ─────────────────────────────────────────────────────────────
   01 INTRO
   ───────────────────────────────────────────────────────────── */

/**
 * 히어로 뒤에 깔리는 바다. 홈 상단과 <b>같은 파일</b>이라 두 화면이 같은 공기로 열린다.
 *
 * <p>본문 좌우 여백만큼 <b>음수로 빠져나가</b> 끝까지 닿는다. {@code w-screen}은 쓰지 않는다 —
 * 100vw는 스크롤바 폭을 포함해 데스크톱에서 <b>가로 스크롤</b>을 만든다. 본문이 1180px로
 * 묶인 넓은 화면에서는 양옆이 칼로 자른 세로줄로 서므로, 마스크로 세 변을 흐린다.
 *
 * <p>모바일은 헤더가 투명이라 헤더 뒤까지 끌어올린다(헤더가 {@code z-10}이라 로고는 위에 선다).
 * lg는 헤더가 흰 막대라 그 아래에서 시작한다. 움직이지 않는다 — 스크롤 연동을 걸면
 * 마스크가 밀려 가로줄이 드러난다.
 */
function HeroPhoto() {
  const bleed = '-left-4.5 -right-4.5 md:-left-6 md:-right-6 lg:-left-8 lg:-right-8'
  const edgeFade =
    'linear-gradient(180deg, transparent 0, #000 28px), linear-gradient(90deg, transparent 0, #000 110px, #000 calc(100% - 110px), transparent 100%)'
  return (
    <>
      <span
        className={`pointer-events-none absolute ${bleed} -top-14 h-[440px] bg-cover bg-center bg-no-repeat lg:hidden`}
        style={{
          backgroundImage: "url('/images/hero-sea.jpg')",
          maskImage: 'linear-gradient(180deg, transparent 0, #000 36px)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 36px)',
        }}
        aria-hidden="true"
      />
      <span
        className={`from-bg/40 via-bg/85 to-bg pointer-events-none absolute ${bleed} -top-14 h-[440px] bg-gradient-to-b lg:hidden`}
        aria-hidden="true"
      />
      <span
        className={`pointer-events-none absolute ${bleed} -top-8 hidden h-[520px] bg-cover bg-center bg-no-repeat lg:block`}
        style={{
          backgroundImage: "url('/images/hero-sea-wide.jpg')",
          maskImage: edgeFade,
          WebkitMaskImage: edgeFade,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
        aria-hidden="true"
      />
      <span
        className={`from-bg/35 via-bg/80 to-bg pointer-events-none absolute ${bleed} -top-8 hidden h-[520px] bg-gradient-to-b lg:block`}
        aria-hidden="true"
      />
    </>
  )
}

function Intro() {
  const ref = useInView<HTMLElement>()
  return (
    <header
      ref={ref}
      className="reveal relative flex max-w-[36rem] flex-col gap-6 pt-10 md:pt-16 lg:min-h-[420px] lg:justify-center lg:pt-10"
    >
      <Eyebrow no="01" label="INTRO" />
      <h1 className="text-fg m-0 text-[32px] leading-[1.3] font-bold tracking-[-0.025em] break-keep text-balance md:text-[44px]">
        혼잡을 줄이고
        <br />
        <Accent>새로운 여행</Accent>을 <Accent>발견</Accent>하다
      </h1>
      <div className="flex flex-col gap-2.5">
        <p className="text-fg m-0 text-[17px] font-semibold md:text-[18px]">
          피하는 여행이 아니라, 발견하는 여행.
        </p>
        {/*
          ⚠️ 바로 위 강조("피하는 여행이 아니라, 발견하는 여행")와 <b>같은 말을 하지 않는다.</b>
          앞서 여기에 "'분산'을 요구하는 대신 '발견'하게 합니다"라고 적었는데, 뜻이 겹쳐
          한 번 할 말을 두 번 하고 있었다. 이 자리는 <b>실제로 무엇을 해 주는지</b>를 맡는다.
        */}
        <Lead>
          코스를 짜면 어디가 붐빌지 미리 알려드리고,
          <br className="hidden sm:block" /> 더 좋은 날짜와 새로운 장소를 찾아드려요.
        </Lead>
      </div>
      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
        <Link
          to="/plan"
          className={`${PRIMARY_BUTTON} inline-flex items-center justify-center gap-1.5 no-underline sm:w-auto sm:px-7`}
        >
          PEAKOFF 시작하기 <ArrowRight size={15} />
        </Link>
        <Link
          to="/recommend"
          className={`${SECONDARY_BUTTON} inline-flex items-center justify-center no-underline sm:px-6`}
        >
          어디로 갈지부터 찾아보기
        </Link>
      </div>
      <p className="text-hint m-0 text-[10.5px] font-semibold tracking-[0.2em]">
        DISCOVER A QUIETER TOMORROW
      </p>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────────
   02 THE PROBLEM
   ───────────────────────────────────────────────────────────── */

/**
 * 붐비는 곳과 여유로운 곳의 대비. 시안의 사진 두 장.
 *
 * <p>왼쪽은 홈 "가고 싶은 곳이 있어요"의 항구 마을, 오른쪽은 "새로운 여행을 발견할래요"의
 * 겨울 바다다. 저장소에 있던 두 장으로 <b>활기와 고요</b>가 정직하게 갈린다 —
 * 군중 사진을 새로 받아 오지 않는다. 배지는 앱의 말이라 사진에 얹어도 뜻이 이어진다.
 */
function ContrastPair() {
  const shots = [
    {
      src: '/images/card-plan.jpg',
      level: 'CROWDED',
      q: 27,
      title: '모두가 가는 곳',
      sub: '기다림이 여행이 되는 순간',
    },
    {
      src: '/images/card-discover.jpg',
      level: 'QUIET',
      q: 81,
      title: '조금 다른 선택',
      sub: '더 여유로운 여행의 순간',
    },
  ] as const

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[1fr_auto_1fr]">
        {shots.map((shot, i) => (
          <figure key={shot.title} className="contents">
            <div className="rounded-card shadow-raised relative aspect-[4/3] overflow-hidden">
              <span
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${shot.src}')` }}
                aria-hidden="true"
              />
              <span
                className="from-fg/75 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t to-transparent"
                aria-hidden="true"
              />
              <span className="absolute top-3 left-3">
                <CongestionBadge level={shot.level} quietness={shot.q} size="sm" />
              </span>
              <figcaption className="absolute inset-x-4 bottom-3.5 flex flex-col gap-0.5 text-white">
                <span className="text-[14.5px] font-bold">{shot.title}</span>
                <span className="text-[12px] opacity-85">{shot.sub}</span>
              </figcaption>
            </div>
            {i === 0 && (
              <span
                className="bg-surface text-fg shadow-rest mx-auto grid h-9 w-9 place-items-center rounded-full rotate-90 sm:rotate-0"
                aria-hidden="true"
              >
                <ArrowRight size={16} />
              </span>
            )}
          </figure>
        ))}
      </div>
      <Example>사진은 느낌을 보여주는 것이고, 배지 숫자는 예시예요</Example>
    </div>
  )
}

function Problem() {
  return (
    <Band
      id="about-problem"
      text={
        <>
          <Eyebrow no="02" label="THE PROBLEM" />
          <Copy id="about-problem">
            모두가 같은 곳으로 향할 때,
            <br />
            여행은 조금 덜 즐거워집니다.
          </Copy>
          <Lead>
            특정 날짜, 특정 관광지에 몰리는 여행. 같은 지역이라도 언제, 어디를 가느냐에 따라
            경험은 완전히 달라져요. 줄부터 서고 밥집은 한 시간 대기인 곳 바로 옆에,
            하루만 옮기면 한산한 곳과 <strong className="text-fg font-semibold">몰랐던 좋은 곳</strong>이
            있어요.
          </Lead>
          <Lead>
            <strong className="text-fg font-semibold">
              같은 여행지도, 조금만 다르게 고르면 훨씬 여유로워질 수 있어요.
            </strong>
          </Lead>
        </>
      }
      visual={<ContrastPair />}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   03 OUR APPROACH
   ───────────────────────────────────────────────────────────── */

/** {@code icons.tsx}의 그리기 규칙과 같다(20 viewBox · 1.6 stroke). 거기 없는 둘만 여기 둔다 */
const ICON = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function BarsIcon() {
  return (
    <svg {...ICON} width={22} height={22}>
      <path d="M4 16.5V11M10 16.5V6M16 16.5V8.5" />
      <path d="M3 17.5h14" />
    </svg>
  )
}

/** 한 점에서 여러 곳으로 흩어진다 — 분산 */
function ScatterIcon() {
  return (
    <svg {...ICON} width={22} height={22}>
      <circle cx="10" cy="10" r="1.8" />
      <circle cx="4.2" cy="5.2" r="1.4" />
      <circle cx="15.8" cy="5.2" r="1.4" />
      <circle cx="4.2" cy="14.8" r="1.4" />
      <circle cx="15.8" cy="14.8" r="1.4" />
      <path d="M8.7 8.7 5.4 6.4M11.3 8.7l3.3-2.3M8.7 11.3l-3.3 2.3M11.3 11.3l3.3 2.3" />
    </svg>
  )
}

/**
 * 네 걸음 사슬. 시안의 아이콘 네 장.
 *
 * <p>좁은 화면에서는 둘씩 두 줄이고 화살표를 숨긴다 — 넷을 한 줄에 세우면 글자가 쪼그라든다.
 * 순서는 번호가 지킨다. 넓은 화면에서 화살표가 돌아온다.
 * 셋째 걸음(자발적인 선택)만 브랜드색 — 사람이 <b>스스로 고르는 순간</b>이 이 서비스가
 * 실제로 손대는 자리다.
 *
 * <h3>⚠️ 카드에 담지 않는다</h3>
 * 처음에는 넷을 흰 카드에 하나씩 담았다. 그러면 <b>아이콘 + 제목 + 글이 든 같은 크기 카드
 * 넉 장</b>이 되는데, 그것은 어느 서비스 소개에나 있는 기본값이라 이 페이지의 것이 아니게 된다.
 * 카드를 걷으면 바탕 위에 동그라미 넷과 화살표만 남아 <b>사슬</b>이라는 뜻이 곧장 읽힌다.
 * 05절의 점 격자도 같은 이유로 카드를 걷었다.
 */
function ApproachChain() {
  const steps = [
    { icon: <BarsIcon />, k: '데이터 기반 추천', accent: false },
    { icon: <Heart size={22} />, k: '발견의 재미', accent: false },
    { icon: <User size={22} />, k: '자발적인 선택', accent: true },
    { icon: <ScatterIcon />, k: '관광 수요 분산', accent: false },
  ]
  return (
    <ol className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
      {steps.map((step, i) => (
        <li key={step.k} className="contents">
          <div className="flex flex-col items-center gap-2.5 px-2 py-3 text-center">
            <span
              className={`grid h-14 w-14 place-items-center rounded-full ${
                step.accent
                  ? 'bg-brand-tint text-brand-deep ring-brand/35 ring-2'
                  : 'bg-surface text-fg'
              }`}
            >
              {step.icon}
            </span>
            <span
              className={`text-[13.5px] leading-[1.4] font-semibold ${
                step.accent ? 'text-brand-deep' : 'text-fg'
              }`}
            >
              {step.k}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-hint hidden sm:block" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function Approach() {
  return (
    <Band
      wide
      id="about-approach"
      text={
        <>
          <Eyebrow no="03" label="OUR APPROACH" />
          <Copy id="about-approach">
            피하는 여행이 아니라,
            <br />
            <Accent>발견하는 여행.</Accent>
          </Copy>
          <Lead>
            PEAKOFF는 관광 데이터를 바탕으로 더 끌리는 선택지를 발견하게 하고, 그 선택이
            자연스럽게 관광 수요 분산으로 이어지게 해요. &ldquo;붐비니까 다른 데로
            가세요&rdquo;라고 요구하지 않아요.
          </Lead>
        </>
      }
      visual={
        <div className="flex flex-col gap-4">
          <ApproachChain />
          <div className="mx-auto w-full max-w-[34rem] pt-2">
            <Callout>데이터가 분산을 설계하고, 발견이 사람을 움직입니다.</Callout>
          </div>
        </div>
      }
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   04 OUR SERVICE — 세 가지 발견
   ───────────────────────────────────────────────────────────── */

/** 날짜 띠. 실제 화면의 표를 같은 색으로 줄였다. 막대는 월요일부터 차례로 자란다 */
function DateStrip() {
  const days = [
    { d: '월', tone: 'bg-moderate', on: false },
    { d: '화', tone: 'bg-quiet', on: false },
    { d: '수', tone: 'bg-quiet', on: true },
    { d: '목', tone: 'bg-moderate', on: false },
    { d: '금', tone: 'bg-moderate', on: false },
    { d: '토', tone: 'bg-crowded', on: false, now: true },
    { d: '일', tone: 'bg-crowded', on: false },
  ]
  return (
    <div className="flex gap-1.5">
      {days.map((day, i) => (
        <div key={day.d} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={`about-day h-1.5 w-full rounded-full ${day.tone}`}
            style={{ '--day-n': i } as CSSProperties}
            aria-hidden="true"
          />
          <span
            className={`text-[11px] ${
              day.on
                ? 'text-quiet-deep font-semibold'
                : day.now
                  ? 'text-crowded-deep font-semibold'
                  : 'text-hint'
            }`}
          >
            {day.d}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 기능 카드 안의 작은 화면. 시안의 기기 화면 자리 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg rounded-ui flex flex-col gap-3 p-3.5">
      <p className="text-hint m-0 text-[11px] font-semibold break-keep">{title}</p>
      {children}
    </div>
  )
}

function TimeOffPanel() {
  return (
    <Panel title="고른 날짜 앞뒤 3일 비교">
      <DateStrip />
      {/*
        ⚠️ "수로 옮기면"이라 적었다가 고쳤다 — <b>'水路'로도 읽힌다.</b>
        요일 한 글자에 조사가 붙으면 뜻이 갈리므로 여기서는 풀어 쓴다.
      */}
      <p className="text-muted m-0 text-[12px] break-keep">
        <span className="text-crowded-deep font-semibold">토요일</span> 대신{' '}
        <span className="text-quiet-deep font-semibold">수요일</span>로 옮기면 한적 지수{' '}
        <span className="text-quiet-deep font-semibold">+19</span>
      </p>
    </Panel>
  )
}

function PlaceOffPanel() {
  const rows = [
    { name: '경주 남산', level: 'QUIET', q: 78, km: '3.2km' },
    { name: '오릉', level: 'QUIET', q: 71, km: '1.4km' },
    { name: '서악동 고분군', level: 'MODERATE', q: 63, km: '2.8km' },
  ] as const
  return (
    <Panel title="불국사 대신 갈 만한 곳">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => (
          <li key={row.name} className="border-line/70 flex items-center gap-2.5 border-b py-2 last:border-b-0">
            <PlacePhotoFallback markClass="h-4 w-4" className="rounded-chip h-9 w-9 flex-none" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-fg truncate text-[13px] font-semibold">{row.name}</span>
              <span className="text-hint text-[11px]">원래 자리에서 {row.km}</span>
            </span>
            <CongestionBadge level={row.level} quietness={row.q} size="xs" />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function FullPanel() {
  return (
    <Panel title="어디로 갈지 물어보기 · 두 가지만 고르기">
      <div className="flex justify-end">
        <p className="bg-brand-tint text-fg m-0 max-w-[88%] rounded-ui px-3 py-2 text-[12.5px] leading-[1.55]">
          다음 주말 바다 보러 가고 싶은데, 안 붐비는 데 없을까?
        </p>
      </div>
      <div className="flex gap-2">
        {['통영', '태안'].map((r) => (
          <span key={r} className="bg-surface text-fg rounded-chip px-3 py-1.5 text-[12.5px] font-semibold">
            {r}
          </span>
        ))}
      </div>
      <div className="border-line flex flex-wrap gap-1.5 border-t pt-3">
        {['여유롭게', '알차게', '유명한 곳도', '한적한 곳 위주'].map((c, i) => (
          <span
            key={c}
            className={`rounded-chip px-2.5 py-1 text-[11.5px] font-semibold ${
              i === 0 || i === 3
                ? 'bg-brand-tint text-brand-deep'
                : 'border-line text-hint border'
            }`}
          >
            {c}
          </span>
        ))}
      </div>
    </Panel>
  )
}

/** 발견 하나. 셋이 같은 위계라 모양도 같다. 카드가 등장 상자이고 스크롤에 맞춰 자리를 잡는다 */
function Feature({
  no,
  name,
  title,
  to,
  cta,
  children,
  panel,
}: {
  no: string
  name: string
  title: string
  to: string
  cta: string
  children: React.ReactNode
  panel: React.ReactNode
}) {
  const ref = useInView<HTMLElement>()
  return (
    <article
      ref={ref}
      className={`reveal about-settle ${CARD} flex flex-col gap-4 p-5`}
      data-lead=""
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-brand-tint text-brand-deep grid h-6 w-6 place-items-center rounded-full font-mono text-[10.5px] font-semibold tabular-nums">
            {no}
          </span>
          <span className="text-fg text-[12px] font-bold tracking-[0.08em]">{name}</span>
        </div>
        <h3 className="text-fg m-0 text-[19px] leading-[1.4] font-bold tracking-[-0.01em] break-keep">{title}</h3>
      </div>
      <p className="text-muted m-0 flex-1 text-[13.5px] leading-[1.8] break-keep">{children}</p>
      <div className="reveal-visual">{panel}</div>
      {/*
        측정해 보니 이 줄의 높이가 19px이었다 — 손가락 표적의 최소치(44px)의 절반도 안 된다.
        {@code touch-hitbox}는 보이는 크기를 건드리지 않고 <b>보이지 않는 히트 영역만</b>
        44px로 키운다(index.css). 줄 높이를 키워 고치면 카드 아래가 벌어진다.
      */}
      <Link
        to={to}
        className="touch-hitbox text-brand-deep inline-flex w-fit items-center gap-1 text-[13px] font-semibold no-underline"
      >
        {cta} <ArrowRight size={14} />
      </Link>
    </article>
  )
}

function Service() {
  return (
    <Band
      wide
      id="about-service"
      text={
        <>
          <Eyebrow no="04" label="OUR SERVICE" />
          <Copy id="about-service">
            여행의 시작부터,
            <br />
            <Accent>세 가지 발견.</Accent>
          </Copy>
          <Lead>
            어디까지 정했든 상관없어요. 이미 코스가 있어도, 지역만 정했어도, 아무것도 안
            정했어도 — 더 좋은 날짜와 새로운 장소, 새로운 여행을 찾아드려요.
          </Lead>
        </>
      }
      visual={
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <Feature
              no="01"
              name="TIME OFF"
              title="더 좋은 날의 발견"
              to="/plan"
              cta="코스 짜고 진단해 보기"
              panel={<TimeOffPanel />}
            >
              가고 싶은 장소는 그대로 두고, 앞뒤 날짜의 혼잡도를 비교해 더 여유로운 날짜를
              제안해요. 날짜만 누르면 코스 전체가 다시 계산돼요.
            </Feature>
            <Feature
              no="02"
              name="PLACE OFF"
              title="새로운 장소의 발견"
              to="/plan"
              cta="코스 짜고 진단해 보기"
              panel={<PlaceOffPanel />}
            >
              가려던 여행의 흐름은 그대로 두고, 더 한적하면서 잘 어울리는 곳을 찾아드려요.
              왜 이곳인지도 함께 보여드려요.
            </Feature>
            <Feature
              no="03"
              name="FULL PEAKOFF"
              title="새로운 여행의 발견"
              to="/recommend"
              cta="설문으로 코스 만들기"
              panel={<FullPanel />}
            >
              아직 구체적인 계획이 없어도 괜찮아요. 어디로 갈지 말로 물어보거나, 두 가지만
              골라 코스 초안을 받아 보세요.
            </Feature>
          </div>
          <Example>화면의 장소·숫자·답변은 예시예요</Example>
        </div>
      }
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   05 HOW IT WORKS
   ───────────────────────────────────────────────────────────── */

/**
 * 점 격자 셋. 시안의 도해를 그대로 옮겼다 — 숫자 없이 <b>원리만</b>.
 * 색은 토큰이다(var(--c-*)). SVG 안이라 클래스 대신 변수로 칠한다.
 */
function DotGrid({ stage }: { stage: 1 | 2 | 3 }) {
  const dots: React.ReactNode[] = []
  const picked = new Set([6, 8, 12, 16, 18])
  const tones = ['var(--c-brand)', 'var(--c-quiet)', 'var(--c-moderate)']
  let toneIndex = 0
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c
      const isPick = picked.has(i)
      let fill = 'var(--c-line)'
      let radius = 4
      if (stage === 1 && isPick) fill = 'var(--c-fg)'
      if (stage === 2 && isPick) {
        fill = 'var(--c-brand)'
        radius = 4 + ((i * 7) % 3) * 1.6
      }
      if (stage === 3 && isPick) {
        fill = tones[toneIndex % tones.length]
        toneIndex++
      }
      dots.push(<circle key={i} cx={12 + c * 19} cy={12 + r * 19} r={radius} fill={fill} />)
    }
  }
  return (
    <svg viewBox="0 0 100 100" width="112" height="112" aria-hidden="true">
      {dots}
    </svg>
  )
}

function HowSteps() {
  const steps = [
    { stage: 1 as const, k: '데이터로 적합한 후보를 먼저 고르고' },
    { stage: 2 as const, k: '충분히 좋은 후보 안에서 여러 곳을 섞어' },
    { stage: 3 as const, k: '사람마다 다른 결과로 추천을 나눠요' },
  ]
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
      {steps.map((step, i) => (
        <li key={step.stage} className="contents">
          <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
            <DotGrid stage={step.stage} />
            <span className="text-fg text-[13px] leading-[1.5] font-semibold break-keep">
              {step.k}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-hint mx-auto rotate-90 sm:rotate-0" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function HowItWorks() {
  return (
    <Band
      id="about-how"
      text={
        <>
          <Eyebrow no="05" label="HOW IT WORKS" />
          {/* 어절 단위로 두면 "분산이 또 다른 / 집중이"로 갈려 '또 다른 집중'이 쪼개진다 */}
          <Copy id="about-how">
            분산이 또 다른 집중이
            <br />
            되지 않도록.
          </Copy>
          <Lead>
            PEAKOFF는 단순히 &lsquo;한적한 곳&rsquo;을 추천하지 않아요. 데이터로 적합한 후보를
            먼저 고른 뒤, 충분히 좋은 후보 안에서 추천을 나눠 모든 사용자에게 같은 곳만
            추천되지 않도록 만들었어요. 그래서 다시 뽑으면 다른 곳이 나와요.
          </Lead>
          <Lead>
            <strong className="text-fg font-semibold">
              분산이 곧, 더 많은 사람의 특별한 여행으로.
            </strong>
          </Lead>
        </>
      }
      visual={<HowSteps />}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   06 THE IMPACT
   ───────────────────────────────────────────────────────────── */

/** 사진 위에 원안·개선안. 결과 화면에서 실제로 나란히 보게 되는 두 수다 */
function ImpactVisual() {
  return (
    <div className="rounded-card shadow-raised relative aspect-[16/10] overflow-hidden">
      <span
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/card-discover.jpg')" }}
        aria-hidden="true"
      />
      <span
        className="from-fg/60 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent"
        aria-hidden="true"
      />
      <div className={`${CARD} absolute right-4 bottom-4 left-4 flex items-center gap-4 p-4 sm:left-auto sm:w-[19rem]`}>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-hint text-[10.5px] font-semibold tracking-[0.06em]">원안</span>
          <span className="text-fg font-mono text-[26px] leading-none font-bold tabular-nums">41</span>
          <CongestionBadge level="MODERATE" size="xs" />
        </div>
        <span className="text-hint" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-brand-deep text-[10.5px] font-semibold tracking-[0.06em]">개선안</span>
          <span className="text-fg font-mono text-[26px] leading-none font-bold tabular-nums">
            68 <span className="text-quiet-deep text-[13px]">+27</span>
          </span>
          <CongestionBadge level="QUIET" size="xs" />
        </div>
      </div>
    </div>
  )
}

/**
 * 결과 화면이 실제로 세는 셋. 값은 예시.
 *
 * <p>카드로 담지 않는다 — 아이콘 + 제목 + 설명 + 큰 숫자를 카드에 넣으면
 * <b>어느 대시보드에나 있는 지표 타일</b>이 된다. 위 사진 카드가 이미 이 절의 그림이라,
 * 여기까지 카드로 두면 카드 안에 카드가 늘어선 꼴이기도 하다.
 * 선으로 나눈 줄이면 <b>결과 화면이 알려주는 목록</b>이라는 사실이 더 곧게 읽힌다.
 */
function ImpactMetrics() {
  /*
   * 셋의 품사를 맞춘다. 앞의 둘은 명사구인데 셋째만 "붐비는 자리가 줄었어요"라는
   * 문장이라 목록이 흐트러졌다. 값도 마찬가지 — "−2곳"은 <b>마이너스 이 곳</b>으로 읽힌다.
   * 이름이 "줄어든 붐빔"이면 값은 "2곳"으로 충분하고, 부호가 없어야 오히려 정확하다.
   */
  const items = [
    { icon: <BarsIcon />, k: '한적함의 변화', v: '원래 계획과 견준 한적 지수', n: '+27' },
    { icon: <Heart size={22} />, k: '새롭게 발견한 장소', v: '생각지 못했던 여행지', n: '4곳' },
    { icon: <ScatterIcon />, k: '줄어든 붐빔', v: '붐빔에서 벗어난 자리', n: '2곳' },
  ]
  return (
    <ul className="border-line m-0 flex list-none flex-col border-t p-0">
      {items.map((item) => (
        <li key={item.k} className="border-line flex items-center gap-3.5 border-b py-3.5">
          <span className="bg-surface text-fg grid h-10 w-10 flex-none place-items-center rounded-full">
            {item.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-fg text-[13.5px] font-semibold">{item.k}</span>
            <span className="text-muted text-[12px] leading-[1.5] break-keep">{item.v}</span>
          </span>
          <span className="text-quiet-deep flex-none font-mono text-[17px] font-semibold tabular-nums">
            {item.n}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Impact() {
  return (
    <Band
      id="about-impact"
      text={
        <>
          <Eyebrow no="06" label="THE IMPACT" />
          <Copy id="about-impact">
            나에게는 더 나은 여행,
            <br />
            지역에는 <Accent>한 걸음의 분산.</Accent>
          </Copy>
          <Lead>
            추천 결과에서 다음과 같은 변화를 확인할 수 있어요. 처음 짠 코스와 바꾼 코스를
            나란히 놓고, 마음에 들면 저장해 두었다가 다음에 다시 진단할 수도 있어요.
          </Lead>
        </>
      }
      visual={
        <div className="flex flex-col gap-3">
          <ImpactVisual />
          <ImpactMetrics />
          <Example>숫자는 예시예요 · 실제 값은 여행 코스마다 달라요</Example>
        </div>
      }
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   07 FOR A BETTER TOMORROW
   ───────────────────────────────────────────────────────────── */

/**
 * 맺음. 어두운 면은 결과 화면 히어로와 같은 짜임이다 — 둘 다 도착한 자리.
 * 모서리 원은 넣지 않는다(결과 히어로 한 곳에만 남기기로 한 장치).
 * 마크는 {@code tone="dark"}. 두 버튼은 div로 감싼다 — 감싸지 않으면 등장 transition이
 * .press의 눌림을 덮어쓴다.
 */
function Ending() {
  return (
    <section aria-labelledby="about-ending" className="flex flex-col gap-6">
      <Reveal className="bg-fg rounded-card flex flex-col items-center gap-7 px-6 py-14 text-center md:py-20">
        <p className="m-0 flex items-center gap-2.5">
          <span className="text-brand font-mono text-[11px] font-semibold tabular-nums">07</span>
          <span className="text-[11px] font-semibold tracking-[0.16em] text-white/60">FOR A BETTER TOMORROW</span>
        </p>
        <h2
          id="about-ending"
          className="m-0 text-[26px] leading-[1.45] font-bold tracking-[-0.02em] break-keep text-balance text-white md:text-[34px]"
        >
          혼잡의 PEAK를 낮추고,
          <br />
          새로운 여행의
          <br className="sm:hidden" />
          <span className="max-sm:hidden"> </span>순간을 발견하다.
        </h2>
        <span className="flex items-center gap-1.5">
          <BrandMark tone="dark" size={28} className="about-drift" />
          <span className="text-[13px] font-bold tracking-[0.2em] text-white">PEAKOFF</span>
        </span>
        <p className="m-0 text-[14px] leading-[1.7] text-white/75">
          발견이 만드는 더 나은 내일,
          <br />
          지금 PEAKOFF와 함께해요.
        </p>
        <div className="flex w-full max-w-[19rem] flex-col gap-2.5 pt-1">
          <Link
            to="/plan"
            className={`${PRIMARY_BUTTON} inline-flex items-center justify-center gap-1.5 no-underline`}
          >
            PEAKOFF 시작하기 <ArrowRight size={15} />
          </Link>
          <Link
            to="/recommend"
            className={`${SECONDARY_BUTTON} grid w-full place-items-center no-underline`}
          >
            어디로 갈지부터 찾아보기
          </Link>
        </div>
      </Reveal>
      <Reveal>
        <p className="text-hint m-0 text-center text-[12px] leading-[1.8]">
          혼잡 예측은 통계·예측값이라 실제와 다를 수 있어요
        </p>
      </Reveal>
    </section>
  )
}
