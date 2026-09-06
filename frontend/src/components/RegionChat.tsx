import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiRequestError, askRegionChat, fetchChatStatus } from '../services/api'
import type { ChatAnswer } from '../types/api'
import { BrandMark } from './BrandMark'
import { ChevronRight } from './icons'

/**
 * 홈의 "어디로 갈지 물어보기".
 *
 * <h3>이 자리가 채우는 구멍</h3>
 * 지금까지 서비스는 <b>사용자가 지역을 이미 정했다고 전제</b>했다. 그런데 여행 계획의
 * 첫 결정은 "어디 갈까"다. 지역이 열하나가 되면서 이 자리가 의미를 갖는다.
 *
 * <p>⚠️ <b>REGION OFF가 아니다.</b> 이미 지역을 정한 사람에게 "다른 데 가라"고 하지 않는다.
 * 아직 정하지 않은 사람을 위한 진입점이다.
 *
 * <h3>여러 개를 나란히 놓는 것이 핵심이다</h3>
 * 하나만 추천하면 그냥 여행지 추천이 된다. 둘~셋을 나란히 놓으면 <b>한적한 정도의 차이가
 * 눈에 보여</b> 오버투어리즘이 말 없이 드러나고, 고르는 것은 사용자다.
 *
 * <h3>⚠️ 숫자는 한적도가 아니라 비율이다</h3>
 * 카드의 %는 "이번 주 예측 중 한적한 관측의 몫"이다. 지역 평균 한적도는 열한 곳이
 * 전부 "보통"이라 배지가 서지 않았다(OPEN_DECISIONS 11-2). <b>3단계 배지를 붙이지 말 것</b> —
 * 65/35 경계는 한적도의 경계라 이 값에는 뜻이 없다.
 *
 * <h3>■ 메신저의 문법을 그대로 빌린다 (2026-09-06)</h3>
 * 처음에는 <b>검색창</b>이었다 — 입력칸 하나에 버튼 하나, 답이 오면 그 자리를 결과가
 * 통째로 덮고 "다시 물어보기"로 되돌아가는 구조. 물어보라고 말은 하는데 <b>주고받은
 * 자취가 남지 않아</b>, 방금 무엇을 물었는지도 화면이 한 줄로 되비춰 줘야 했다.
 *
 * <p>대화창으로 바꾸면 그 되비추기가 필요 없다. 내가 한 말이 오른쪽에, 답이 왼쪽에
 * 쌓이는 것을 모르는 사람이 없다 — <b>설명이 필요 없는 것이 이 문법의 값어치</b>다.
 * 말풍선·꼬리 잘린 모서리·프로필·시각·바닥에 붙은 입력 막대까지, 메신저에서 눈에 익은
 * 배치를 그대로 따른다.
 *
 * <p>⚠️ <b>색까지 빌려오지는 않는다.</b> 노란 말풍선을 쓰면 남의 브랜드가 우리 홈에
 * 앉는다. 내 말풍선은 브랜드 틸이고 글자는 잉크다({@code text-fg}) — 밝은 틸 위에
 * 흰 글자는 2.2:1이라 읽히지 않는다(CLAUDE.md 팔레트 규칙).
 *
 * <h3>⚠️ 다시 그려질 때 다시 묻지 않는다</h3>
 * 주고받은 말을 상태에 담아 둔다. 서버가 매번 새로 뽑으므로, 리렌더마다 물으면
 * <b>사용자가 방금 본 지역을 다시 찾지 못한다.</b> 새로 뽑는 것은 사용자가
 * 직접 한 번 더 물었을 때뿐이다.
 */

/**
 * 무엇을 물어볼 수 있는지 알려주면서 서비스 성격도 함께 전한다.
 *
 * <p><b>둘만 둔다</b> (2026-09-06). 셋이었을 때는 입력칸 위가 칩으로 꽉 차서,
 * 예시가 <b>고르는 메뉴</b>처럼 보였다 — 직접 물어보라고 만든 자리인데 물어볼 마음이
 * 들기 전에 목록부터 눈에 들어온다.
 *
 * <p>남긴 둘이 이 서비스가 답할 수 있는 <b>양 끝</b>이다 — 관심사가 있는 질문(바다)과
 * 관심사 없이 한적한 곳만 찾는 질문. 그 사이는 사용자가 알아서 채운다.
 */
const EXAMPLES = ['사람 적은 바다 여행지 없나요?', '이번 주 어디가 제일 한산해요?']

/**
 * 답을 받은 뒤 입력을 잠그는 시간(초).
 *
 * <p>서버 제한만 있으면 <b>눌렀는데 에러가 떠서</b> 경험이 나쁘다. 막힐 것을 미리 막는다.
 * 3초는 "연달아 누르는 것"만 걸리고 "생각하고 다시 묻는 것"은 안 걸리는 선이다.
 */
const COOLDOWN_SECONDS = 3

/**
 * 주고받은 말 한 마디.
 *
 * <p>카드 답도 <b>같은 목록에 담는다.</b> 결과를 따로 두면 대화가 끊겨 "답이 화면을
 * 덮는" 예전 구조로 되돌아간다 — 카드는 말풍선의 한 종류일 뿐이다.
 */
type Message =
  | { id: number; role: 'user'; at: string; kind: 'text'; text: string }
  | { id: number; role: 'bot'; at: string; kind: 'text'; text: string }
  | { id: number; role: 'bot'; at: string; kind: 'cards'; answer: ChatAnswer }

/** 메신저처럼 <b>오전/오후 h:mm</b>. 초는 적지 않는다 — 대화에서 초는 뜻이 없다. */
function stamp(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

let nextId = 0

function textMessage(role: 'user' | 'bot', text: string): Message {
  nextId += 1
  return { id: nextId, role, at: stamp(), kind: 'text', text }
}

export function RegionChat() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  /* 인사말은 처음 한 번만 만든다. 매 렌더마다 새로 만들면 시각이 계속 갱신된다. */
  const [messages, setMessages] = useState<Message[]>(() => [
    textMessage('bot', '안녕하세요! 이번 주 예측을 보고 한적한 여행지를 찾아드려요.'),
    textMessage('bot', '어떤 여행을 하고 싶으세요?'),
  ])
  /** 남은 잠금 시간(초). 0이면 풀린 상태다. */
  const [cooldown, setCooldown] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  /* 챗봇을 켤 수 있는지는 처음 한 번만 묻는다. 글을 치는 도중에 화면이 바뀌면 안 된다. */
  useEffect(() => {
    const controller = new AbortController()
    fetchChatStatus(controller.signal)
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false))
    return () => controller.abort()
  }, [])

  /* 잠금이 1초씩 풀린다. 남은 초를 화면에 적어 사용자가 기다릴 이유를 알게 한다. */
  useEffect(() => {
    if (cooldown <= 0) {
      return
    }
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  /*
   * 새 말이 붙으면 바닥으로 따라 내려간다. 메신저에서 <b>가장 최근 말이 안 보이는 것</b>은
   * 고장으로 읽힌다 — 답이 왔는데 화면은 그대로인 것처럼 보인다.
   */
  useEffect(() => {
    const log = logRef.current
    if (log) {
      log.scrollTop = log.scrollHeight
    }
  }, [messages, asking])

  const ask = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || asking || cooldown > 0) {
      return
    }
    setAsking(true)
    setQuestion('')
    setMessages((prev) => [...prev, textMessage('user', trimmed)])
    try {
      const answer = await askRegionChat(trimmed)
      nextId += 1
      const id = nextId
      setMessages((prev) => [...prev, { id, role: 'bot', at: stamp(), kind: 'cards', answer }])
      setCooldown(COOLDOWN_SECONDS)
    } catch (error) {
      /*
       * 429면 서버가 몇 초 뒤에 되는지 알려준다. 그 초만큼 잠근다 —
       * 화면이 짐작하면 너무 일찍 풀려 다시 막히거나, 너무 늦게 풀려 쓸 수 있는데 막아 둔다.
       */
      const throttled = error instanceof ApiRequestError && error.code === 'TOO_MANY_REQUESTS'
      setCooldown(
        throttled ? ((error as ApiRequestError).retryAfterSeconds ?? 60) : COOLDOWN_SECONDS,
      )
      setMessages((prev) => [
        ...prev,
        textMessage(
          'bot',
          throttled
            ? '질문이 몰리고 있어요. 잠시 뒤에 다시 물어봐 주세요.'
            : '지금은 답을 찾지 못했어요. 잠시 뒤에 다시 물어봐 주세요.',
        ),
      ])
    } finally {
      setAsking(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  /* 아직 모르는 동안에는 자리만 잡아 둔다. 깜빡이며 나타났다 사라지지 않게. */
  if (enabled === null) {
    return <section className="min-h-40" aria-hidden="true" />
  }

  /*
   * 챗봇이 꺼져 있다. 인증키가 없거나 하루 상한에 닿았다 — 사용자가 할 수 있는 일은
   * 어느 쪽이나 같으므로 이유를 가르지 않고 <b>기존 설문으로 안내</b>한다.
   *
   * <p>꺼져 있어도 <b>대화창 모양은 지킨다.</b> 입력 막대만 없을 뿐이라, 왜 말을 못 거는지가
   * 화면 자체로 설명된다.
   */
  if (!enabled) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Header />
        <div className="bg-bg flex min-h-[236px] flex-1 flex-col gap-3 rounded-[18px] p-3">
          <BotRow head tail at={stamp()}>
            <Bubble side="bot">지금은 질문을 받을 수 없어요.</Bubble>
            <Bubble side="bot">대신 몇 가지 물음에 답해 주시면 코스를 만들어 드릴게요.</Bubble>
          </BotRow>
          <Link
            to="/recommend"
            className="press bg-brand hover:bg-brand-hover text-fg rounded-ui mt-auto inline-flex h-11 items-center justify-center px-4 text-[14px] font-semibold no-underline"
          >
            설문으로 코스 만들기
          </Link>
        </div>
      </div>
    )
  }

  const busy = asking || cooldown > 0
  /* 예시는 <b>아직 말을 안 건 사람</b>에게만 보인다. 대화가 시작되면 자리를 비운다. */
  const fresh = messages.every((message) => message.role === 'bot')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Header />

      {/*
        대화창. 바탕을 회백(--c-bg)으로 깔아 <b>흰 말풍선이 뜨게</b> 한다 —
        흰 카드 위에 흰 말풍선을 얹으면 테두리로만 갈려 대화로 읽히지 않는다.
      */}
      <div className="bg-bg flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px]">
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          /*
            ⚠️ <b>높이에 천장을 둔다.</b> 없으면 답 카드 셋이 붙는 순간 이 칸이 길어지고,
            나란한 격자라 <b>옆의 두 칸이 함께 늘어나</b> 아래가 통째로 흰 여백이 된다.
            천장을 두면 대화가 안에서 밀려 올라간다 — 메신저가 원래 그렇게 생겼다.

            <p>세로로 미는 상자는 괜찮다. 금지된 것은 <b>가로</b>다(CLAUDE.md).
          */
          className="no-scrollbar flex max-h-[440px] min-h-[236px] flex-1 flex-col gap-2 overflow-y-auto p-3 lg:min-h-[264px]"
        >
          {messages.map((message, index) => {
            /*
              연달아 오는 말은 <b>한 덩어리</b>로 묶는다. 프로필은 첫 줄에만, 시각은
              마지막 줄에만 붙인다 — 메신저가 다 그렇게 하고, 안 그러면 좁은 칸에서
              같은 얼굴과 같은 시각이 세 번씩 반복돼 말보다 부속이 더 눈에 띈다.
            */
            const head = index === 0 || messages[index - 1].role !== message.role
            const tail = index === messages.length - 1 || messages[index + 1].role !== message.role

            if (message.role === 'user') {
              return (
                <div key={message.id} className="chat-in flex items-end justify-end gap-1.5 pl-8">
                  {tail && <time className="text-hint flex-none text-[10px]">{message.at}</time>}
                  <Bubble side="user">{message.text}</Bubble>
                </div>
              )
            }

            return (
              <BotRow key={message.id} head={head} tail={tail} at={message.at}>
                {message.kind === 'text' ? (
                  <Bubble side="bot">{message.text}</Bubble>
                ) : (
                  <AnswerBubbles answer={message.answer} />
                )}
              </BotRow>
            )
          })}

          {/* 답을 기다리는 중. 말풍선 자리에서 점 셋이 뛴다 — 메신저의 "입력 중"이다. */}
          {asking && (
            <BotRow head tail={false}>
              <div className="bg-surface shadow-rest flex w-fit items-center gap-1 rounded-[16px] rounded-tl-[5px] px-3.5 py-3">
                <Dot delay={0} />
                <Dot delay={160} />
                <Dot delay={320} />
                <span className="sr-only">답을 찾고 있어요</span>
              </div>
            </BotRow>
          )}
        </div>

        {/*
          입력 막대. <b>대화 바탕 위에 그대로 앉는다.</b>
          ⚠️ 화면 바닥이 아니라 <b>카드 안쪽 바닥</b>이다 — position:fixed를 쓰지 않으므로
          모바일 브라우저의 도구막대와 자리를 다투지 않는다(CLAUDE.md).

          <p>■ <b>흰 띠였다가 걷어냈다</b> (2026-09-06)

          <p>메신저처럼 바닥에 흰 띠를 깔았더니, 그 흰색이 <b>카드(흰색)와 이어져</b>
          대화창의 아래 모서리가 사라졌다 — 위는 둥근데 아래는 직각으로 잘린 것처럼 보였다.
          둥글리기는 멀쩡히 걸려 있었고, <b>같은 색끼리 만나 경계가 없어진 것</b>이다.

          <p>바탕을 비우면 회백이 그대로 비쳐 대화창이 <b>한 덩어리</b>로 닫힌다.
          대신 입력칸 자체를 흰색으로 올려 세운다 — 회백 위의 흰 칸은 그 자체로
          "여기에 쓴다"로 읽히고, 회백 위의 회백(fill)은 눌린 자국처럼만 보였다.

          <p>⚠️ <b>구분선을 긋지 않는다.</b> 흰 칸이 이미 제 윤곽으로 서 있어서, 선까지
          더하면 한 덩어리로 닫아 놓은 대화창을 다시 둘로 자른다.
        */}
        <div className="flex flex-col gap-2 p-2.5 pt-0">
          {/*
            예시 질문. 빈 입력창만 두면 무엇을 물어도 되는지 알 수 없다.
            ⚠️ 옆으로 미는 띠가 아니라 <b>줄바꿈</b>이다 — 가로 스크롤 상자는 끝까지 민
            제스처가 페이지로 이어진다(CLAUDE.md).
          */}
          {fresh && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(example)}
                    className="press border-line bg-surface text-muted hover:bg-bg disabled:text-hint cursor-pointer rounded-full border px-3 py-1.5 text-[12px] disabled:cursor-not-allowed"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              placeholder={
                cooldown > 0 ? `${cooldown}초 뒤에 다시 물어볼 수 있어요` : '메시지를 입력하세요'
              }
              aria-label="여행지 질문"
              /*
                회백 바탕 위라 <b>흰 칸</b>이다. 예전에는 fill(회백보다 한 톤 진한 회색)이라
                바탕과 거의 붙어, 쓰는 자리가 아니라 눌린 자국처럼 보였다.
              */
              className="bg-surface border-line text-fg placeholder:text-hint focus-visible:border-brand-deep h-10 min-w-0 flex-1 rounded-full border px-4 text-[13.5px] transition-colors"
            />
            {/*
              동그란 보내기 버튼. 글자 대신 화살표를 쓰는 것도 메신저의 문법이라
              "물어보기"라고 적어 둘 이유가 없다 — 대신 aria-label로 이름을 남긴다.
            */}
            <button
              type="submit"
              disabled={busy || question.trim().length === 0}
              aria-label={asking ? '답을 찾는 중' : '보내기'}
              className="press bg-brand hover:bg-brand-hover text-fg disabled:bg-line disabled:text-hint grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-full disabled:cursor-not-allowed"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-col gap-0.75 px-1">
      <h2 className="text-fg m-0 text-[18px] font-bold tracking-[-0.02em] lg:text-[17px] lg:tracking-[-0.015em]">
        어디로 갈지 물어보세요
      </h2>
      {/*
        ⚠️ "지금"이 아니라 "이번 주"다. 공사 자료는 실시간이 아니라 예측·통계값이라
        시점을 잘못 말하면 심사에서 바로 지적받는다(CLAUDE.md 절대 규칙).
      */}
      <span className="text-hint text-[12.5px]">이번 주 예측을 기준으로 찾아드려요</span>
    </div>
  )
}

interface BotRowProps {
  /** 연속된 봇 발언의 첫 줄인가. 프로필과 이름은 첫 줄에만 선다 */
  head: boolean
  /** 마지막 줄인가. 시각은 마지막 줄에만 붙는다 */
  tail: boolean
  at?: string
  children: ReactNode
}

/**
 * 왼쪽(상대) 줄 — 프로필 · 이름 · 말풍선 · 시각.
 *
 * <p>프로필 자리는 <b>첫 줄이 아니어도 비워 둔다.</b> 폭까지 없애면 이어지는 말풍선이
 * 왼쪽으로 밀려 한 사람의 말이 두 줄로 갈라져 보인다.
 */
function BotRow({ head, tail, at, children }: BotRowProps) {
  return (
    /*
     * ⚠️ 오른쪽 여백을 <b>비워 두지 않는다.</b> pr-5로 20px을 늘 남겨 두었더니, 좁은 칸에서
     * 한 문장이 <b>네 줄로 쪼개졌다</b> — 프로필 32px + 사이 8px에 그 20px까지 더해
     * 말풍선이 쓸 수 있는 폭이 60px 가까이 깎였다.
     *
     * <p>시각은 이미 {@code flex-none}이라 <b>필요할 때만</b> 제 폭을 가져간다.
     * 없는 줄까지 미리 자리를 비워 둘 이유가 없었다.
     */
    <div className="chat-in flex items-end gap-2 pr-1">
      <div className="w-8 flex-none self-start">
        {head && (
          /* 프로필은 로고 마크다. 캐릭터를 따로 만들면 정체성 장치가 하나 더 늘어난다 */
          <div className="bg-brand-tint grid h-8 w-8 place-items-center rounded-[11px]">
            <BrandMark size={20} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {head && <span className="text-hint px-0.5 text-[11px]">PEAKOFF</span>}
        {children}
      </div>
      {tail && at && <time className="text-hint flex-none text-[10px]">{at}</time>}
    </div>
  )
}

interface BubbleProps {
  side: 'bot' | 'user'
  children: ReactNode
}

/**
 * 말풍선.
 *
 * <p>꼬리는 <b>모서리 하나만 각지게</b> 해서 낸다. 삼각형을 덧붙이는 방법도 있지만
 * 그러면 말풍선마다 자리를 맞춰야 하고, 폭이 다른 카드가 끼면 어긋난다.
 */
function Bubble({ side, children }: BubbleProps) {
  return side === 'user' ? (
    <p className="bg-brand text-fg m-0 w-fit rounded-[16px] rounded-tr-[5px] px-3.5 py-2.5 text-[13px] leading-[1.55] break-keep break-words">
      {children}
    </p>
  ) : (
    <p className="bg-surface text-fg shadow-rest m-0 w-fit rounded-[16px] rounded-tl-[5px] px-3.5 py-2.5 text-[13px] leading-[1.55] break-keep break-words">
      {children}
    </p>
  )
}

/** 점 하나. 지연을 달리 줘서 셋이 물결처럼 뛴다. */
function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="chat-dot bg-hint block h-1.5 w-1.5 rounded-full"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.6 7.9 13 3l-4.3 10.2-1.5-4.2-4.6-1.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 답 말풍선들.
 *
 * <p>먼저 <b>말 한 마디</b>가 서고 그 아래 지역 카드가 붙는다. 카드만 툭 오면
 * 대화 중에 표가 하나 떨어진 것처럼 보인다.
 */
function AnswerBubbles({ answer }: { answer: ChatAnswer }) {
  if (answer.status !== 'OK' || answer.cards.length === 0) {
    /*
     * 여행지를 고르는 질문이 아니거나(OFF_TOPIC), 챗봇이 답할 수 없는 상태다.
     * ⚠️ <b>혼내지 않는다.</b> 무엇을 물으면 되는지만 알려주고 물러난다.
     */
    return (
      <Bubble side="bot">
        {answer.status === 'OFF_TOPIC'
          ? '여행지를 고르는 질문에 답할 수 있어요. "사람 적은 바다 여행지 없나요?"처럼 물어보세요.'
          : '지금은 답을 찾지 못했어요. 잠시 후 다시 시도해 주세요.'}
      </Bubble>
    )
  }

  return (
    <>
      {/*
        ⚠️ 기준(basis)과 관심사(interest)는 <b>서버가 준 말</b>이다. 화면이 "지금"이라고
        지어 말하지 않도록 서버가 함께 내려보내는 값이라, 여기서 문구를 만들어 덮지 않는다.
      */}
      <Bubble side="bot">
        {answer.interest
          ? `${answer.basis} 예측으로 ${answer.interest} 여행하기 좋은 곳을 골라봤어요.`
          : `${answer.basis} 예측으로 한적한 곳을 골라봤어요.`}
        {/*
          막대가 무엇인지 <b>여기서 한 번만</b> 말한다. 카드마다 설명을 붙이면 같은 말이
          셋이 되고, 정작 견주라고 만든 막대가 그 사이에 묻힌다. 말로 먼저 알려주고
          그림을 보여주는 것이 대화의 순서이기도 하다.
        */}
        {' 막대가 길수록 한적한 곳이 많아요.'}
      </Bubble>

      {answer.cards.map((card, index) => (
        /*
          링크 카드. 메신저의 공유 카드처럼 <b>아래에 버튼이 붙은</b> 형태다 —
          말풍선 안에 링크 글자만 두면 손가락으로 누를 자리가 너무 좁다.
        */
        <article
          key={card.region}
          className="bg-surface shadow-rest w-full overflow-hidden rounded-[16px] rounded-tl-[5px]"
        >
          <div className="flex flex-col gap-1.5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-fg text-[14.5px] font-semibold tracking-[-0.01em]">
                {card.regionName}
              </span>
              {/*
                ⚠️ 이 값은 <b>한적도가 아니라 비율</b>이라 3단계 배지를 붙이지 않는다.
                대신 한적을 뜻하는 색(quiet)으로 칠해 무엇에 대한 숫자인지 읽히게 한다.
                모수를 함께 적는 이유: 비율만 내걸면 몇 곳을 보고 한 말인지 알 수 없다.
              */}
              <span className="flex-none text-[12px] font-semibold whitespace-nowrap">
                {/*
                  ⚠️ <b>고정폭 글꼴을 한글에 씌우지 않는다.</b> 자간이 벌어져 "한적"이
                  <b>"한 적"</b> 두 낱말로 읽힌다. 숫자만 고정폭으로 두면 카드끼리
                  자릿수가 맞아 세로로 견주기 쉽다.
                */}
                <span className="text-quiet-deep">한적 </span>
                <span className="text-quiet-deep font-mono">{card.quietShare}%</span>
                <span className="text-hint ml-1 font-normal">/ {card.forecastSize}곳</span>
              </span>
            </div>

            {/*
              ■ <b>이 막대가 이 화면의 메시지다.</b>

              하려는 말은 "통영 66%"가 아니라 <b>"통영은 66%인데 제주시는 22%"</b>다.
              숫자만 오른쪽에 세워 두면 그 차이를 <b>읽어야</b> 알지만, 막대가 세로로
              나란히 서면 <b>보인다.</b> 카드를 여럿 놓기로 한 이유가 여기서 완성된다.

              긍정 신호는 브랜드색이 아니라 한적색이 맡는다(CLAUDE.md) — 비밀번호 강도
              막대와 같은 자리다. 브랜드 틸로 칠하면 "강조"와 "등급"이 섞인다.

              ⚠️ 눈금은 <b>0~100 고정</b>이다. 카드 중 가장 큰 값을 꽉 채우는 방식으로
              그리면 66%와 22%가 "가득 참 대 3분의 1"로 과장된다 — 실제 차이가 이미
              충분히 크므로 부풀릴 이유가 없다.

              숫자를 글로 읽는 사람에게는 바로 위 "한적 66%"가 같은 말을 한다.
              그래서 이 막대는 <b>보조</b>이고, 화면 낭독에서는 빠진다.
            */}
            <div
              className="bg-line h-1.5 w-full overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bar-grow bg-quiet h-full rounded-full"
                style={{ width: `${card.quietShare}%`, animationDelay: `${index * 70}ms` }}
              />
            </div>

            <p className="text-muted m-0 text-[12.5px] leading-[1.5] break-keep">{card.line}</p>
          </div>

          {/*
            여기서 기존 흐름으로 넘어간다. 챗봇은 <b>진입점</b>이지 새 흐름이 아니다 —
            지역만 정해 주고 나머지는 이미 있는 코스 만들기가 맡는다.
          */}
          {/*
            ⚠️ 화살표를 <b>글자(→)로 그리지 않는다.</b> 이 저장소의 화살표는 전부
            {@code icons.tsx}의 SVG라, 여기만 유니코드를 쓰면 굵기와 크기가 옆 화면들과
            어긋난다. 글꼴에 따라 모양이 바뀌기도 한다.
          */}
          <Link
            to={`/recommend?region=${card.region}`}
            className="press border-line/70 text-brand-deep hover:bg-bg flex items-center justify-center gap-0.5 border-t px-3 py-2.5 text-[12.5px] font-semibold no-underline"
          >
            이 지역에서 코스 발견하기
            <ChevronRight size={14} />
          </Link>
        </article>
      ))}
    </>
  )
}
