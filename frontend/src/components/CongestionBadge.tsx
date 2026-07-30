import type { CongestionLevel } from '../types/api'

/**
 * 서버가 levelLabel을 함께 내려주지만, 그것 없이도 배지를 그릴 수 있어야 한다.
 * (아직 진단하지 않은 장소를 미리 보여주는 경우 등)
 */
const FALLBACK_LABEL: Record<CongestionLevel, string> = {
  QUIET: '한적',
  MODERATE: '보통',
  CROWDED: '붐빔',
}

/**
 * 등급별 클래스를 <b>완성된 문자열로</b> 적어둔다.
 *
 * `text-${level}` 처럼 조립하면 안 된다. Tailwind는 소스를 글자 그대로 훑어
 * 쓰인 클래스만 CSS로 만들기 때문에, 조립한 이름은 빌드에 포함되지 않아
 * 개발 중에는 보이다가 배포하면 색이 사라지는 식으로 어긋난다.
 */
const LEVEL_CLASS: Record<CongestionLevel, string> = {
  QUIET: 'text-quiet bg-quiet-bg border-quiet-line',
  MODERATE: 'text-moderate bg-moderate-bg border-moderate-line',
  CROWDED: 'text-crowded bg-crowded-bg border-crowded-line',
}

const SIZE_CLASS = {
  md: 'px-2.5 py-[5px] text-[13px]',
  sm: 'px-2 py-[3px] text-xs',
}

interface Props {
  level: CongestionLevel
  /** 서버가 준 levelLabel. 없으면 기본 문구를 쓴다 */
  label?: string
  /** 함께 보여줄 한적도 점수 (0~100). 생략하면 등급만 표시 */
  quietness?: number
  size?: 'sm' | 'md'
}

/**
 * 한적도 3단계 배지.
 *
 * 색만으로 등급을 구분하지 않고 <b>항상 글자를 함께</b> 넣는다.
 * 색각 이상이 있는 사용자에게 청록과 앰버는 구분되지 않을 수 있고,
 * 심사 환경의 빔프로젝터에서도 색 차이가 뭉개진다.
 */
export function CongestionBadge({ level, label, quietness, size = 'md' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold leading-none ${LEVEL_CLASS[level]} ${SIZE_CLASS[size]}`}
    >
      {label ?? FALLBACK_LABEL[level]}
      {quietness !== undefined && (
        <span className="font-mono font-medium opacity-75">
          {/* 화면에서는 숫자만 보이고, 스크린리더는 무슨 숫자인지 듣는다 */}
          <span className="sr-only">한적도 </span>
          {quietness}
        </span>
      )}
    </span>
  )
}
