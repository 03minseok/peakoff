/**
 * 그려서 쓰는 아이콘.
 *
 * <p><b>유니코드 글자를 아이콘 자리에 쓰지 않는다.</b> `×`나 `›` 같은 글자는 글꼴에 따라
 * 굵기·크기·세로 위치가 제각각이라, 버튼 한가운데 놓아도 광학적으로 맞지 않고
 * 기기마다 다르게 보인다. 획을 직접 그리면 굵기와 크기를 한 곳에서 정할 수 있다.
 *
 * <p>규격은 {@link ./BottomNav}가 쓰던 것과 같다 — 20×20 좌표계, 획 1.6, 둥근 끝.
 * 색은 {@code currentColor}라 감싼 글자의 색을 그대로 따라간다.
 * (BottomNav는 이 파일보다 먼저 자기 것을 들고 있다. 화면 이동이 걸린 곳이라 그대로 뒀다.)
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

/** 오른쪽 꺾쇠. "누르면 이어진다"는 뜻으로만 쓴다 */
export function ChevronRight({ size = 16, className = '' }: Props) {
  return (
    <svg {...ICON} width={size} height={size} className={className}>
      <path d="M8 5.5 12.5 10 8 14.5" />
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
