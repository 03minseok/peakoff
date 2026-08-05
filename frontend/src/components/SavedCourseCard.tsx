import { LEVEL_TINT } from './levelStyles'
import type { SavedCourseSummary } from '../types/api'
import { formatDateRange, formatNights, formatRelativeTime, isPastDate } from '../utils/date'

interface Props {
  course: SavedCourseSummary
  /** 비교할 코스를 고르는 중인가. 이때는 카드를 눌러도 상세로 가지 않는다 */
  selecting: boolean
  selected: boolean
  onOpen: () => void
  onToggleSelect: () => void
  onDelete: () => void
}

/** 지역·기간처럼 짧은 정보를 다는 알약 */
const META_CHIP = 'rounded-[8px] bg-bg px-2.25 py-1 text-xs font-medium text-muted'

/**
 * 마이페이지 목록의 코스 카드 한 장.
 *
 * <p>모바일과 데스크톱이 같은 컴포넌트를 쓴다. 다른 것은 바깥 격자뿐이라
 * (모바일 1열 · 데스크톱 3열) 카드를 두 벌 만들 이유가 없다.
 *
 * <p><b>지난 여행은 흐리게 둔다.</b> 지우지 않는 이유는 기록이기 때문이고,
 * 흐리게 두는 이유는 지금 계획할 수 있는 코스와 섞여 보이면 목록을 훑기 어려워서다.
 */
export function SavedCourseCard({
  course,
  selecting,
  selected,
  onOpen,
  onToggleSelect,
  onDelete,
}: Props) {
  const past = isPastDate(course.endDate)

  return (
    /*
     * div가 아니라 button이다. 카드를 누르는 것이 주요 동작이라
     * 키보드로도 닿아야 하고 스크린리더에도 누를 수 있는 것으로 읽혀야 한다.
     */
    <button
      type="button"
      onClick={selecting ? onToggleSelect : onOpen}
      className={`bg-surface flex cursor-pointer flex-col gap-3 rounded-[20px] p-4.5 text-left transition-colors ${
        selected ? 'border-brand shadow-raised border-[1.5px]' : 'shadow-rest border-[1.5px] border-transparent'
      } ${past ? 'opacity-65' : ''}`}
      aria-pressed={selecting ? selected : undefined}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1.25">
          {past && (
            <span className="text-hint bg-bg self-start rounded-full px-2 py-0.5 text-[10.5px] font-semibold">
              지난 여행
            </span>
          )}
          <span className="text-fg truncate text-[16.5px] font-bold tracking-[-0.01em]">
            {course.name}
          </span>
        </div>

        {selecting ? (
          <span
            className={`grid h-6.5 w-6.5 flex-none place-items-center rounded-full text-[13px] font-bold ${
              selected ? 'bg-brand text-white' : 'border-line text-line border-[1.5px]'
            }`}
            aria-hidden="true"
          >
            ✓
          </span>
        ) : (
          /*
           * 삭제는 카드 안의 버튼이다. 중첩 button은 HTML에서 허용되지 않으므로
           * span에 역할을 주고 클릭 전파를 막는다 — 카드를 열지 않고 삭제만 일어나야 한다.
           */
          <span
            role="button"
            tabIndex={0}
            aria-label={`${course.name} 삭제`}
            className="text-line hover:bg-crowded-tint hover:text-crowded grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-[10px] text-[15px] transition-colors"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                onDelete()
              }
            }}
          >
            ×
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={META_CHIP}>{course.regionName.replace(/^.*\s/, '')}</span>
        <span className={META_CHIP}>{formatNights(course.nights)}</span>
        <span className={META_CHIP}>{course.placeCount}곳</span>
      </div>

      <div className="text-muted flex items-center gap-1.75 font-mono text-[13px]">
        <span className="bg-line h-1.5 w-1.5 flex-none rounded-full" aria-hidden="true" />
        {formatDateRange(course.startDate, course.nights)}
      </div>

      {/* 점수 상자. 배경색이 등급을 한 번 더 말해준다 — 배지 글자를 안 읽어도 눈에 들어온다 */}
      <div
        className={`flex items-center justify-between rounded-[14px] px-3.5 py-3 ${LEVEL_TINT[course.level]}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] opacity-70">예상 한적 지수</span>
          <span className="text-[12px] font-bold">{course.levelLabel}</span>
        </div>
        <span className="font-mono text-[26px] leading-none font-semibold tracking-[-0.02em]">
          {course.totalQuietness}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-hint text-xs">
          {formatRelativeTime(course.createdAt)} 저장
        </span>
        {!selecting && (
          <span className="text-brand text-[13px] font-semibold" aria-hidden="true">
            상세 보기 ›
          </span>
        )}
      </div>
    </button>
  )
}
