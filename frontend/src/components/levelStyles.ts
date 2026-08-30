import type { CongestionLevel } from '../types/api'

/**
 * 한적도 3단계에 대응하는 클래스 표.
 *
 * <b>완성된 문자열로 적어둔다.</b> `bg-${level}`처럼 조립하면 안 된다.
 * Tailwind는 소스를 글자 그대로 훑어 쓰인 클래스만 CSS로 만들기 때문에,
 * 조립한 이름은 빌드에 포함되지 않아 개발 중에는 보이다가 배포하면
 * 색이 사라지는 식으로 어긋난다.
 *
 * 화면마다 필요한 쓰임이 달라(점·글자·배경·왼쪽 띠) 역할별로 나눠 둔다.
 */

/** 점·번호 원처럼 색 자체가 신호인 자리 */
export const LEVEL_SOLID: Record<CongestionLevel, string> = {
  QUIET: 'bg-quiet',
  MODERATE: 'bg-moderate',
  CROWDED: 'bg-crowded',
}

/** 배지·안내 상자의 옅은 배경 + 글자색 한 쌍 */
export const LEVEL_TINT: Record<CongestionLevel, string> = {
  QUIET: 'bg-quiet-tint text-quiet-deep',
  MODERATE: 'bg-moderate-tint text-moderate-deep',
  CROWDED: 'bg-crowded-tint text-crowded-deep',
}

/**
 * 색 위에 <b>글자가 얹히는</b> 자리의 배경 + 글자색 한 쌍.
 * 지도 마커, 진단·추천 화면의 순서 번호 원, 채운 경고 버튼이 여기에 해당한다.
 *
 * LEVEL_SOLID를 쓰면 안 된다. solid는 명도 서열(보통>한적>붐빔)을 지켜야 해서 셋 다 밝고,
 * 밝은 색은 흰 글자를 받지 못한다 — 실제로 순서 원의 흰 번호가 2.2~4.0:1로 묻어 있었다.
 * 그래서 배경은 한 단계 진한 -strong을 쓴다. 지도 타일 위에서 대비가 죽는 문제도 같이 풀린다.
 *
 * 셋 다 흰 글자를 받는다(4.9~7.6:1). solid 단계에서는 보통이 너무 밝아 검정 글자가
 * 필요했지만, strong까지 내리면 세 단계가 하나로 통일된다 — 그러면서도 명도 서열은
 * 그대로다(보통 0.17 > 한적 0.15 > 붐빔 0.10).
 */
export const LEVEL_ON_SOLID: Record<CongestionLevel, string> = {
  QUIET: 'bg-quiet-strong text-white',
  MODERATE: 'bg-moderate-strong text-white',
  CROWDED: 'bg-crowded-strong text-white',
}

/**
 * 어두운 면(bg-fg) 위에 <b>등급을 색으로</b> 말해야 하는 글자.
 *
 * -deep은 잉크에 가까워 네이비 위에서 묻고, solid는 등급 서열을 지키느라 셋 다 밝다.
 * soft가 어두운 면 위의 칸이다 — CLAUDE.md의 다섯 칸 중 "보조 단계·어두운 면 위".
 * 셋 다 --c-fg 위에서 대형 글자 기준을 지난다 (한적 6.71 · 보통 7.41 · 붐빔 4.79).
 */
export const LEVEL_SOFT: Record<CongestionLevel, string> = {
  QUIET: 'text-quiet-soft',
  MODERATE: 'text-moderate-soft',
  CROWDED: 'text-crowded-soft',
}

/**
 * 밝은 면(카드·회백 바탕) 위에 <b>등급을 색으로</b> 말해야 하는 글자.
 *
 * LEVEL_TINT에서 글자색만 떼어낸 것이다. 배경 없이 숫자만 물들이는 자리에 쓴다 —
 * 코스 총점, 변경 내역의 한적도. 흰 카드에서 6.85~8.31, 회백 바탕에서 6.28~7.62이라
 * 본문 기준(4.5)도 지난다.
 */
export const LEVEL_DEEP: Record<CongestionLevel, string> = {
  QUIET: 'text-quiet-deep',
  MODERATE: 'text-moderate-deep',
  CROWDED: 'text-crowded-deep',
}

/**
 * 인라인 style로 넘겨야 하는 자리(원형 게이지의 conic-gradient, 막대 너비 등).
 *
 * 값이 실행 중에 정해져 클래스로 만들 수 없다. CSS 변수를 넘기면
 * 색 정의는 여전히 index.css 한 곳에만 남는다.
 */
export const LEVEL_COLOR_VAR: Record<CongestionLevel, string> = {
  QUIET: 'var(--c-quiet)',
  MODERATE: 'var(--c-moderate)',
  CROWDED: 'var(--c-crowded)',
}

/*
 * 카드 왼쪽 색 띠(LEVEL_EDGE)는 뺐다.
 *
 * 진단 카드는 등급을 이미 세 번 말한다 — 순서 번호 원의 색(LEVEL_SOLID),
 * 한적도 배지, 그리고 붐빌 때만 채워지는 대안 버튼. 띠는 네 번째였고 새 정보가 없었다.
 *
 * 특히 번호 원이 카드 왼쪽 끝에 있는 색 신호라, "목록을 훑으면 붐비는 곳이 보인다"는
 * 띠의 역할을 그대로 한다. 같은 말을 한 번 더 하는 색은 정보가 아니라 장식으로 읽힌다.
 */
