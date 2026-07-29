import type { CongestionLevel } from '../types/api'
import './CongestionBadge.css'

/**
 * 서버가 levelLabel을 함께 내려주지만, 그것 없이도 배지를 그릴 수 있어야 한다.
 * (아직 진단하지 않은 장소를 미리 보여주는 경우 등)
 */
const FALLBACK_LABEL: Record<CongestionLevel, string> = {
  QUIET: '한적',
  MODERATE: '보통',
  CROWDED: '붐빔',
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
  const text = label ?? FALLBACK_LABEL[level]

  return (
    <span className={`badge badge--${level.toLowerCase()} badge--${size}`}>
      <span className="badge-text">{text}</span>
      {quietness !== undefined && (
        <span className="badge-score">
          {/* 화면에서는 숫자만 보이고, 스크린리더는 무슨 숫자인지 듣는다 */}
          <span className="sr-only">한적도 </span>
          {quietness}
        </span>
      )}
    </span>
  )
}
