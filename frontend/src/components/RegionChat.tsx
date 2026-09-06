import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiRequestError, askRegionChat, fetchChatStatus } from '../services/api'
import type { ChatAnswer } from '../types/api'

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
 * <h3>⚠️ 다시 그려질 때 다시 묻지 않는다</h3>
 * 받은 답을 상태에 담아 둔다. 서버가 매번 새로 뽑으므로, 리렌더마다 물으면
 * <b>사용자가 방금 본 지역을 다시 찾지 못한다.</b> 새로 뽑는 것은 사용자가
 * "다시 물어보기"를 눌렀을 때뿐이다.
 */

/** 무엇을 물어볼 수 있는지 알려주면서 서비스 성격도 함께 전한다. */
const EXAMPLES = [
  '사람 적은 바다 여행지 없나요?',
  '이번 주 어디가 제일 한산해요?',
  '식도락 여행하기 좋은 곳',
]

/**
 * 답을 받은 뒤 버튼을 잠그는 시간(초).
 *
 * <p>서버 제한만 있으면 <b>눌렀는데 에러가 떠서</b> 경험이 나쁘다. 막힐 것을 미리 막는다.
 * 3초는 "연달아 누르는 것"만 걸리고 "생각하고 다시 묻는 것"은 안 걸리는 선이다.
 */
const COOLDOWN_SECONDS = 3

export function RegionChat() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<ChatAnswer | null>(null)
  const [asked, setAsked] = useState('')
  /** 남은 잠금 시간(초). 0이면 풀린 상태다. */
  const [cooldown, setCooldown] = useState(0)
  const [failed, setFailed] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  /* 챗봇을 켤 수 있는지는 처음 한 번만 묻는다. 글을 치는 도중에 화면이 바뀌면 안 된다. */
  useEffect(() => {
    const controller = new AbortController()
    fetchChatStatus(controller.signal)
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false))
    return () => controller.abort()
  }, [])

  /* 잠금이 1초씩 풀린다. 남은 초를 버튼에 적어 사용자가 기다릴 이유를 알게 한다. */
  useEffect(() => {
    if (cooldown <= 0) {
      return
    }
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const ask = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || asking || cooldown > 0) {
      return
    }
    setAsking(true)
    setFailed(false)
    setAsked(trimmed)
    try {
      setAnswer(await askRegionChat(trimmed))
      setCooldown(COOLDOWN_SECONDS)
    } catch (error) {
      /*
       * 429면 서버가 몇 초 뒤에 되는지 알려준다. 그 초만큼 잠근다 —
       * 화면이 짐작하면 너무 일찍 풀려 다시 막히거나, 너무 늦게 풀려 쓸 수 있는데 막아 둔다.
       */
      if (error instanceof ApiRequestError && error.code === 'TOO_MANY_REQUESTS') {
        setCooldown(error.retryAfterSeconds ?? 60)
      } else {
        setCooldown(COOLDOWN_SECONDS)
      }
      setFailed(true)
      setAnswer(null)
    } finally {
      setAsking(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  const reset = () => {
    setAnswer(null)
    setFailed(false)
    setQuestion('')
    inputRef.current?.focus()
  }

  /* 아직 모르는 동안에는 자리만 잡아 둔다. 깜빡이며 나타났다 사라지지 않게. */
  if (enabled === null) {
    return <section className="min-h-40" aria-hidden="true" />
  }

  /*
   * 챗봇이 꺼져 있다. 인증키가 없거나 하루 상한에 닿았다 — 사용자가 할 수 있는 일은
   * 어느 쪽이나 같으므로 이유를 가르지 않고 <b>기존 설문으로 안내</b>한다.
   */
  if (!enabled) {
    return (
      <div className="flex flex-col gap-2.5">
        <Header />
        <p className="text-hint m-0 text-[12.5px] leading-[1.6]">
          지금은 질문을 받을 수 없어요. 몇 가지 물음에 답하면 코스를 만들어 드릴게요.
        </p>
        <Link
          to="/recommend"
          className="press bg-brand hover:bg-brand-hover text-fg rounded-ui inline-flex h-11 items-center justify-center px-4 text-[14px] font-semibold no-underline"
        >
          설문으로 코스 만들기
        </Link>
      </div>
    )
  }

  const busy = asking || cooldown > 0

  return (
    <div className="flex flex-col gap-3">
      <Header />

      {answer === null ? (
        <>
          <form onSubmit={submit} className="flex flex-col gap-2">
            {/*
              ⚠️ 입력창과 버튼을 <b>위아래로</b> 둔다. 칸이 350px이라 나란히 놓으면
              입력창이 200px 아래로 줄어 예시 질문 하나도 안 들어간다.
            */}
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              placeholder="어떤 여행을 하고 싶으세요?"
              aria-label="여행지 질문"
              className="border-line bg-surface text-fg placeholder:text-hint focus-visible:border-brand-deep h-11 w-full rounded-ui border px-3 text-[14px] transition-colors"
            />
            <button
              type="submit"
              disabled={busy || question.trim().length === 0}
              className="press bg-brand hover:bg-brand-hover text-fg disabled:bg-line disabled:text-hint rounded-ui h-11 cursor-pointer text-[14px] font-semibold disabled:cursor-not-allowed"
            >
              {asking ? '찾는 중…' : cooldown > 0 ? `${cooldown}초 뒤에 다시` : '물어보기'}
            </button>
          </form>

          {failed && (
            <p className="text-hint m-0 text-[12.5px] leading-[1.6]">
              잠시 후 다시 시도해주세요.
            </p>
          )}

          {/* 예시 질문. 빈 입력창만 두면 무엇을 물어도 되는지 알 수 없다. */}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setQuestion(example)
                    void ask(example)
                  }}
                  className="press bg-bg hover:bg-fill text-muted disabled:text-hint w-full cursor-pointer rounded-[12px] border-none px-3 py-2 text-left text-[12.5px] disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Answer answer={answer} asked={asked} onReset={reset} />
      )}
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

interface AnswerProps {
  answer: ChatAnswer
  asked: string
  onReset: () => void
}

function Answer({ answer, asked, onReset }: AnswerProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* 무엇을 물었는지 되비춘다. 카드만 남으면 무엇에 대한 답인지 알 수 없다. */}
      <p className="text-muted bg-bg m-0 rounded-[12px] px-3 py-2 text-[12.5px] leading-[1.5]">
        {asked}
      </p>

      {answer.status === 'OK' ? (
        answer.cards.map((card) => (
          <article
            key={card.region}
            className="border-line flex flex-col gap-1.5 rounded-[14px] border p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-fg text-[15px] font-semibold tracking-[-0.01em]">
                {card.regionName}
              </span>
              {/*
                ⚠️ 이 값은 <b>한적도가 아니라 비율</b>이라 3단계 배지를 붙이지 않는다.
                대신 한적을 뜻하는 색(quiet)으로 칠해 무엇에 대한 숫자인지 읽히게 한다.
                모수를 함께 적는 이유: 비율만 내걸면 몇 곳을 보고 한 말인지 알 수 없다.
              */}
              <span className="flex-none text-[12.5px] font-semibold whitespace-nowrap">
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

            <p className="text-muted m-0 text-[12.5px] leading-[1.5]">{card.line}</p>

            {/*
              여기서 기존 흐름으로 넘어간다. 챗봇은 <b>진입점</b>이지 새 흐름이 아니다 —
              지역만 정해 주고 나머지는 이미 있는 코스 만들기가 맡는다.
            */}
            <Link
              to={`/recommend?region=${card.region}`}
              className="text-brand-deep hover:text-fg self-start text-[12.5px] font-semibold no-underline"
            >
              이 지역에서 코스 발견하기 →
            </Link>
          </article>
        ))
      ) : (
        /*
         * 여행지를 고르는 질문이 아니거나(OFF_TOPIC), 챗봇이 답할 수 없는 상태다.
         * ⚠️ <b>혼내지 않는다.</b> 무엇을 물으면 되는지만 알려주고 물러난다.
         */
        <p className="text-muted bg-bg m-0 rounded-[12px] p-3 text-[12.5px] leading-[1.6]">
          {answer.status === 'OFF_TOPIC'
            ? '여행지를 고르는 질문에 답할 수 있어요. "사람 적은 바다 여행지 없나요?"처럼 물어보세요.'
            : '지금은 답을 찾지 못했어요. 잠시 후 다시 시도해 주세요.'}
        </p>
      )}

      <button
        type="button"
        onClick={onReset}
        className="press border-line text-fg hover:bg-bg rounded-ui h-10 cursor-pointer border bg-transparent text-[13px] font-semibold"
      >
        다시 물어보기
      </button>
    </div>
  )
}
