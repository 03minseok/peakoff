/**
 * 여러 화면에서 똑같이 쓰이는 클래스 묶음.
 *
 * 컴포넌트로 감싸지 않고 문자열로 둔 이유: 버튼마다 type·동작·링크 여부가 달라서
 * 감싸면 그걸 다시 props로 뚫어줘야 한다. 여기서는 모양만 공유하는 편이 단순하다.
 *
 * 조립하지 않고 완성된 문자열로 적는다. Tailwind는 소스를 글자 그대로 훑기 때문이다.
 */

/**
 * 화면당 하나뿐인 주요 행동 버튼.
 *
 * 높이 54px. 시안의 모바일 최소 터치 높이(48px)보다 넉넉하게 잡아,
 * 엄지로 누를 때 빗나가지 않게 한다.
 *
 * press는 index.css에 있는 클래스다. 눌렀을 때 살짝 줄어드는 반응과 색 전환을 함께 맡는다 —
 * hover가 없는 모바일에서 "눌렸다"를 알려주는 것은 이것뿐이다.
 * transition-colors를 같이 쓰지 않는다(둘이 같은 속성을 두고 부딪힌다. index.css의 .press 주석 참고).
 */
export const PRIMARY_BUTTON =
  'press min-h-13.5 w-full cursor-pointer rounded-ui bg-brand text-base font-semibold text-fg shadow-cta hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-hint disabled:shadow-none'

/** 주요 버튼 옆에 서는 보조 버튼. 테두리만 두고 배경은 카드와 같게 둔다. */
export const SECONDARY_BUTTON =
  'press min-h-13 cursor-pointer rounded-ui border border-line bg-surface text-[15px] font-semibold text-fg hover:bg-bg'

/**
 * 카드 안에 들어가는 작은 행동 버튼 (교체·추가 등).
 *
 * hover에서 <b>같은 색조 안에서만</b> 진해진다. 색조가 건너뛰면 손을 올렸을 때
 * "다른 버튼으로 바뀐 것"처럼 읽힌다.
 *
 * tint 다음 칸은 point(--c-brand)가 아니라 soft다. point까지 가면 글자색(deep)이
 * 2.7:1로 무너져 hover에서 글자가 안 읽힌다 — soft는 같은 글자색을 5.0:1로 받는다.
 */
export const CHIP_BUTTON =
  'press min-h-9 cursor-pointer rounded-chip bg-brand-tint px-3.5 text-[13px] font-semibold text-brand-deep hover:bg-brand-soft'

/** 목록·내용을 담는 기본 카드. 배경 위에 놓인 상태 */
export const CARD = 'rounded-card bg-surface shadow-rest'

/** 눈길이 먼저 닿아야 하는 카드. 배경에서 한 겹 떠 있다 */
export const CARD_RAISED = 'rounded-card bg-surface shadow-raised'

/** 내용이 없거나 불러오는 중일 때 자리를 채우는 안내 */
export const NOTICE =
  'rounded-card bg-surface p-4 text-center text-[13px] shadow-rest'

/**
 * 글자를 직접 입력받는 칸. 날짜·이메일·비밀번호가 같은 높이로 선다.
 *
 * 높이 52px은 주요 버튼(54px)보다 살짝 낮다. 같은 높이로 두면 폼 맨 아래에서
 * 입력칸과 버튼이 한 덩어리로 붙어 보여, 누를 곳이 어디인지 한눈에 안 들어온다.
 */
/*
 * 초점이 오면 <b>테두리와 링이 같은 색</b>으로 함께 선다.
 *
 * 링만 남겨봤더니 회색 테두리 밖에 링이 떠서 입력칸과 따로 노는 느낌이 났고,
 * 테두리를 brand(밝은 틸)로 바꿔봤더니 어두운 링과 색이 갈려 두 겹으로 보였다.
 * 예전 청록 시절이 자연스러웠던 이유는 <b>둘이 한 색</b>이어서다 — 그 구조를 brand-deep으로 재현한다.
 */
export const TEXT_INPUT =
  'h-13 w-full rounded-ui border border-line bg-surface px-3.5 font-sans text-base text-fg transition-colors'

/**
 * 값이 규칙에 어긋난 칸.
 *
 * 테두리만 바꾸고 배경은 건드리지 않는다 — 입력한 글자가 계속 잘 읽혀야 한다.
 * 진한 붉은색(crowded) 대신 옅은 값(crowded-soft)을 쓴다. 입력칸 전체를 강한 색으로
 * 두르면 "붐빔" 배지와 같은 무게로 보여, 화면에서 어느 쪽이 위험 신호인지 헷갈린다.
 */
/* 틀린 칸은 테두리·링을 함께 붉게 — 위와 같은 한 색 구조를 경고색으로 반복한다 */
export const TEXT_INPUT_INVALID =
  'h-13 w-full rounded-ui border border-crowded-soft bg-surface px-3.5 font-sans text-base text-fg transition-colors focus-visible:border-crowded focus-visible:outline-crowded'

/**
 * 화면 껍데기 안에서 본문을 다시 좁히는 열.
 *
 * 껍데기는 1180px까지 넓지만 본문까지 따라 넓히지는 않는다.
 * 데스크톱에서 가운데로 모아 모바일과 같은 리듬으로 읽히게 하려는 것이다.
 */
export const READ_COLUMN = 'mx-auto w-full max-w-read'

/** 입력 폼 화면의 본문 폭. 읽는 화면보다 더 좁다 */
export const FORM_COLUMN = 'mx-auto w-full max-w-form'
