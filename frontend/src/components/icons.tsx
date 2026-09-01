/**
 * 그려서 쓰는 아이콘.
 *
 * <p><b>유니코드 글자를 아이콘 자리에 쓰지 않는다.</b> `×`나 `›` 같은 글자는 글꼴에 따라
 * 굵기·크기·세로 위치가 제각각이라, 버튼 한가운데 놓아도 광학적으로 맞지 않고
 * 기기마다 다르게 보인다. 획을 직접 그리면 굵기와 크기를 한 곳에서 정할 수 있다.
 *
 * <p>규격은 {@link ./Nav}가 쓰는 것과 같다 — 20×20 좌표계, 획 1.6, 둥근 끝.
 * 색은 {@code currentColor}라 감싼 글자의 색을 그대로 따라간다.
 * (Nav는 이 파일보다 먼저 자기 것을 들고 있다. 화면 이동이 걸린 곳이라 그대로 뒀다.)
 *
 * <p>여기엔 <b>지금 쓰이는 것만</b> 둔다. 언젠가 쓸 것 같은 아이콘을 미리 채워두면
 * 어느 것이 살아 있는지 알 수 없어진다.
 */

/** 모든 아이콘이 공유하는 획 규격. 여기만 고치면 전부 함께 바뀐다. */
const ICON = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

interface Props {
  /** 기본값은 쓰임마다 다르다. 닫기는 작게, 장식은 크게 */
  size?: number
  className?: string
}

/** 닫기. 누르는 자리(28px)보다 표시를 작게 두어 조용히 남는다 */
export function Close({ size = 14, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" />
    </svg>
  )
}

/**
 * 하트. 찜한 곳에 <b>색이 찬다.</b>
 *
 * <p>⚠️ <b>이 아이콘만 좌표계가 24×24다.</b> 다른 것들은 획 몇 개라 20×20에 그렸지만
 * 하트는 곡선이 이어진 하나의 형태라, 널리 쓰이는 24 기준 경로를 그대로 옮기는 편이
 * 손으로 다시 그리는 것보다 정확하다. 획 굵기도 같은 비율(1.6 × 24/20)로 키워야
 * 다른 아이콘 옆에서 같은 두께로 보인다.
 *
 * <p><b>켜고 끄는 것은 채움뿐</b>이다. 크기·위치·획이 그대로라 눌러도 자리가 흔들리지 않는다 —
 * 아이콘을 통째로 갈아끼우면 두 그림의 여백이 달라 하트가 튄다.
 */
export function Heart({ size = 20, className = '', filled = false }: Props & { filled?: boolean }) {
  return (
    <svg
      {...ICON}
      viewBox="0 0 24 24"
      strokeWidth={1.9}
      fill={filled ? 'currentColor' : 'none'}
      width={size}
      height={size}
      className={className}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

/** 오른쪽 꺾쇠. "누르면 이어진다"는 뜻으로만 쓴다 */
export function ChevronRight({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M8 5.5 12.5 10 8 14.5" />
    </svg>
  )
}

/**
 * 아래 꺾쇠. <b>펼쳐지는 것</b>에만 붙인다 — 오른쪽 꺾쇠(이어서 간다)와 뜻이 갈린다.
 *
 * <p>열렸을 때 180도 돌려 쓴다. 위·아래 두 그림을 갈아끼우면 두 경로의 여백이 달라
 * 꺾쇠가 미세하게 튄다.
 */
export function ChevronDown({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M5.5 8 10 12.5 14.5 8" />
    </svg>
  )
}

/**
 * 달력. 날짜를 고르는 칸 앞에 선다.
 *
 * <p>고리 두 개를 위로 세워 그린다. 상자만 그리면 창문·카드와 구별되지 않는다 —
 * 달력을 달력으로 읽히게 하는 것은 이 두 획이다.
 */
export function Calendar({ size = 18, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.8v3.2M13 2.8v3.2" />
    </svg>
  )
}

/** 왼쪽 꺾쇠. 되돌아가는 링크 앞에 붙는다 */
export function ChevronLeft({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M12 5.5 7.5 10 12 14.5" />
    </svg>
  )
}

/** 위로 옮기기 */
export function ArrowUp({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M10 15.5V4.5M5.5 9 10 4.5 14.5 9" />
    </svg>
  )
}

/** 아래로 옮기기 */
export function ArrowDown({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M10 4.5v11M14.5 11 10 15.5 5.5 11" />
    </svg>
  )
}

/**
 * 오른쪽 화살표. 최종 비교 화면에서 <b>원안 → 개선안</b>을 잇는다.
 *
 * <p>꺾쇠가 아니라 화살표인 이유: 꺾쇠는 "이어서 간다"는 이동 신호이고,
 * 이 자리는 "이것이 저것으로 바뀌었다"는 변환을 말한다. 뜻이 다르면 모양도 달라야 한다.
 */
export function ArrowRight({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M4.5 10h11M11 5.5 15.5 10 11 14.5" />
    </svg>
  )
}

/**
 * 담아 넣기. 저장 시트와 빈 상태의 아이콘 자리에 쓴다.
 *
 * <p>선 위로 화살표가 내려오는 모양이라 "여기에 담긴다"가 읽힌다.
 * 그냥 아래 화살표(↓)는 스크롤이나 정렬로도 읽혀 뜻이 흐려진다.
 */
export function ArrowDownToLine({ size = 20, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M10 3.5v8M6.5 8.5 10 12l3.5-3.5M4.5 16h11" />
    </svg>
  )
}

/**
 * 알림. 동그라미 안의 느낌표.
 *
 * <p>느낌표를 <b>획 두 개로</b> 그린다 — 세로 막대와 아래 점. 점을 아주 짧은 선으로 두면
 * {@code strokeLinecap: round} 덕에 동그란 점이 되어, 원 하나를 따로 그리는 것보다
 * 다른 아이콘과 굵기가 정확히 같아진다.
 */
export function Alert({ size = 15, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.6v4" />
      <path d="M10 13.4v0" />
    </svg>
  )
}

/**
 * 코스 — <b>점 둘을 잇는 길</b>.
 *
 * <p>지도 핀이 아니라 <b>경로</b>를 그린다. 이 서비스에서 코스는 장소 하나가 아니라
 * 순서대로 이은 여러 곳이고, 핀 하나는 "장소"를 뜻해 찜과 갈리지 않는다.
 * 위와 아래 점, 그 사이를 굽어 잇는 선 — 여행 카드의 날짜 축이 쓰는 그림과 같은 뜻이다.
 */
export function Route({ size = 20, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <circle cx="5.5" cy="5" r="2.1" />
      <circle cx="14.5" cy="15" r="2.1" />
      <path d="M7.6 5h4.15a2.6 2.6 0 0 1 0 5.2H8.25a2.6 2.6 0 0 0 0 5.2h4.15" />
    </svg>
  )
}

/**
 * 여행 — <b>손잡이 달린 가방</b>.
 *
 * <p>코스 여럿을 하나로 묶은 것이 여행이다. 가방은 "담는 그릇"을 곧바로 말하고,
 * 위의 {@link Route}(길)와 생김새가 겹치지 않는다 — 둘이 이 화면에서 나란히 선다.
 */
export function Bag({ size = 20, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <rect x="2.6" y="6.4" width="14.8" height="10" rx="2.4" />
      <path d="M7.2 6.4V5.1a1.7 1.7 0 0 1 1.7-1.7h2.2a1.7 1.7 0 0 1 1.7 1.7v1.3" />
    </svg>
  )
}

/** 계정 — 어깨와 머리. 프로필 그림({@code ProfileAvatar})과 같은 형태를 획으로만 그린다 */
export function User({ size = 20, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <circle cx="10" cy="6.6" r="3.1" />
      <path d="M3.9 16.6a6.1 6.1 0 0 1 12.2 0" />
    </svg>
  )
}
