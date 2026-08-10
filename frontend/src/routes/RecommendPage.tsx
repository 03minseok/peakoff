import { Link } from 'react-router'
import { ChevronRight } from '../components/icons'
import { CARD, PRIMARY_BUTTON } from '../components/styles'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'

/**
 * 설문으로 코스를 추천받는 자리. <b>아직 만들지 않았다.</b>
 *
 * <p>화면을 먼저 둔 이유: 홈에 진입점을 얹었기 때문이다. 누를 곳이 있는데 갈 곳이 없으면
 * 그게 가장 나쁜 상태다 — 사용자는 눌러본 뒤에야 없다는 것을 알게 된다.
 *
 * <p>그래서 이 화면은 <b>막다른 길이 되지 않는 것</b>만 책임진다. 무엇이 올지 말하고,
 * 지금 할 수 있는 일(직접 짜기)로 보낸다. 가짜 설문을 흉내 내지 않는다 —
 * 답을 받아놓고 아무것도 하지 않는 화면은 없는 것보다 신뢰를 더 깎는다.
 *
 * <p><b>제출 전에는 실제로 만들거나, 홈의 진입점과 함께 감춰야 한다.</b>
 * "준비 중"이 심사 화면에 남아 있는 것은 감점 요인이다.
 */
export function RecommendPage() {
  const regionName = REGIONS.find((option) => option.slug === DEFAULT_REGION)?.name ?? ''

  return (
    // 위 여백을 더 얹지 않는다 — Layout이 이미 준다. /plan과 같은 이유다
    <div className="mx-auto flex w-full max-w-form flex-col gap-5 pb-10">
      <div className="flex flex-col gap-2.5">
        <span className="bg-brand-tint text-brand-deep w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold">
          준비 중
        </span>
        <h1 className="text-fg m-0 text-[27px] leading-[1.3] font-bold tracking-[-0.025em]">
          코스를 대신
          <br />
          짜드릴 준비를 하고 있어요
        </h1>
        <p className="m-0 text-[14.5px] leading-[1.65] text-pretty">
          몇 가지 질문에 답하면 취향에 맞으면서 덜 붐비는 {regionName} 코스를 만들어 드릴
          거예요. 지금은 직접 담은 코스만 진단할 수 있어요.
        </p>
      </div>

      {/*
        무엇을 물어볼지 미리 밝힌다. "준비 중" 한 마디만 있으면 사용자는 이 기능이
        무엇인지 모른 채 나가고, 다시 들어올 이유도 생기지 않는다.
      */}
      <section className={`${CARD} flex flex-col gap-3 p-4.5`}>
        <span className="text-fg text-sm font-semibold">이런 것들을 여쭤볼 거예요</span>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {/* CLAUDE.md 필수 기능 6의 4~5문항과 같은 축이어야 한다: 스타일·활동량·동행·혼잡 민감도 */}
          {[
            '어떤 곳을 좋아하는지 — 유적·자연·먹거리',
            '하루에 몇 곳쯤 돌고 싶은지',
            '누구와 함께 가는지 — 혼자·둘이서·가족',
            '사람 많은 곳도 괜찮은지, 조용한 곳이 좋은지',
          ].map((item, index) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="bg-brand text-fg mt-px grid h-5 w-5 flex-none place-items-center rounded-full font-mono text-[11px] font-semibold"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="text-muted text-[13.5px] leading-[1.55]">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-hint m-0 text-[12px] leading-[1.6]">
          답을 바탕으로 붐비지 않는 곳 위주로 골라 코스를 짜고, 지금처럼 한적 지수와 추천
          근거를 함께 보여드릴 거예요.
        </p>
      </section>

      <div className="flex flex-col gap-2.5">
        <Link to="/plan" className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}>
          직접 코스 짜러 가기
        </Link>
        <Link
          to="/"
          className="text-hint hover:text-muted flex items-center justify-center gap-1 text-center text-[13.5px] font-medium no-underline"
        >
          홈으로 <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
