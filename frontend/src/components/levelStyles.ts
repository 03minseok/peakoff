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

/**
 * 카드 왼쪽에 세우는 띠.
 *
 * 배지를 끝까지 읽지 않아도 목록을 훑는 것만으로 어디가 붐비는지 보이게 한다.
 */
export const LEVEL_EDGE: Record<CongestionLevel, string> = {
  QUIET: 'border-l-4 border-l-quiet',
  MODERATE: 'border-l-4 border-l-moderate',
  CROWDED: 'border-l-4 border-l-crowded',
}
