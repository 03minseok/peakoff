import { LEVEL_SOLID, LEVEL_TINT } from './levelStyles'
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

const SIZE_CLASS = {
  md: 'gap-1.5 px-3 py-1.5 text-[13px]',
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  /* 사진 위에 얹히는 자리(홈의 한적한 곳 카드)용. 카드 폭이 132px이라 sm은 폭을 너무 먹는다 */
  xs: 'gap-1 px-2 py-0.5 text-[11px]',
}

const DOT_SIZE = {
  md: 'h-1.75 w-1.75',
  sm: 'h-1.5 w-1.5',
  xs: 'h-1.25 w-1.25',
}

interface Props {
  level: CongestionLevel
  /** 서버가 준 levelLabel. 없으면 기본 문구를 쓴다 */
  label?: string
  /** 함께 보여줄 한적도 점수 (0~100). 생략하면 등급만 표시 */
  quietness?: number
  size?: 'xs' | 'sm' | 'md'
}

/**
 * 한적도 3단계 배지 — 시안의 pill 형태.
 *
 * 색만으로 등급을 구분하지 않고 <b>항상 글자를 함께</b> 넣는다.
 * 색각 이상이 있는 사용자에게 그린틸과 앰버는 구분되지 않을 수 있고,
 * 심사 환경의 빔프로젝터에서도 색 차이가 뭉개진다.
 *
 * 점(dot)은 같은 등급의 진한 색이다. 옅은 배경만으로는 멀리서 등급이 안 읽혀서,
 * 색 신호를 한 번 더 준다.
 */
export function CongestionBadge({ level, label, quietness, size = 'md' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${LEVEL_TINT[level]} ${SIZE_CLASS[size]}`}
    >
      <span
        className={`flex-none rounded-full ${LEVEL_SOLID[level]} ${DOT_SIZE[size]}`}
        aria-hidden="true"
      />
      {label ?? FALLBACK_LABEL[level]}
      {quietness !== undefined && (
        <span className="font-mono font-semibold">
          {/*
            화면에서는 숫자만 보이고, 스크린리더는 무슨 숫자인지 듣는다.
            이름은 <b>화면이 쓰는 말</b>로 부른다 — 다른 화면들이 이 값을 "한적 지수"라
            적어두고 여기서만 "한적도"라 읽어주면, 듣는 사람에게는 다른 값이 된다.
          */}
          <span className="sr-only">한적 지수 </span>
          {quietness}
        </span>
      )}
    </span>
  )
}
