/**
 * 여러 화면에서 똑같이 쓰이는 클래스 묶음.
 *
 * 컴포넌트로 감싸지 않고 문자열로 둔 이유: 버튼마다 type·동작·링크 여부가 달라서
 * 감싸면 그걸 다시 props로 뚫어줘야 한다. 여기서는 모양만 공유하는 편이 단순하다.
 *
 * 조립하지 않고 완성된 문자열로 적는다. Tailwind는 소스를 글자 그대로 훑기 때문이다.
 */

/** 화면당 하나뿐인 주요 행동 버튼. 모바일에서 엄지로 누를 수 있는 높이(52px)를 지킨다. */
export const PRIMARY_BUTTON =
  'min-h-13 w-full cursor-pointer rounded-card bg-brand-strong font-bold text-white hover:bg-brand disabled:cursor-not-allowed disabled:opacity-45'

/** 목록·카드를 감싸는 기본 테두리 */
export const CARD = 'rounded-card border border-line'

/** 내용이 없거나 불러오는 중일 때 자리를 채우는 안내 */
export const NOTICE = 'bg-surface rounded-card p-4 text-center text-[13px]'
