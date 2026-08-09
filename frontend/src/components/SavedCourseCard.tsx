import { LEVEL_TINT } from './levelStyles'
import { ChevronRight, Close } from './icons'
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
 *
 * <h3>카드 전체를 누를 수 있게 만든 방법</h3>
 * 카드 자체는 {@code <div>}다. 안에 진짜 버튼 두 개(제목·삭제)가 들어 있고,
 * 제목 버튼이 {@code ::after}를 카드 크기로 늘려 <b>클릭 영역만</b> 카드 전체로 확장한다.
 *
 * <p>카드를 {@code <button>}으로 만들면 삭제 버튼을 그 안에 넣을 수 없다 —
 * 버튼 안의 버튼은 HTML에서 허용되지 않는다. 그렇다고 {@code role="button"}을 붙인
 * {@code span}으로 흉내 내면 키보드·보조기술 동작을 전부 손으로 재현해야 하고,
 * 그중 하나만 빠뜨려도 그 사람에게는 눌리지 않는 버튼이 된다.
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
    // relative: 제목 버튼의 ::after가 이 상자를 기준으로 늘어난다
    <div
      className={`bg-surface relative flex flex-col gap-3 rounded-[20px] p-4.5 transition-colors ${
        selected
          ? 'border-brand shadow-raised border-[1.5px]'
          : 'shadow-rest border-[1.5px] border-transparent'
      } ${past ? 'opacity-65' : ''}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1.25">
          {past && (
            <span className="text-hint bg-bg self-start rounded-full px-2 py-0.5 text-[10.5px] font-semibold">
              지난 여행
            </span>
          )}

          {/*
            버튼에 truncate(overflow:hidden)를 걸면 ::after까지 잘려 확장이 무효가 된다.
            자르는 일은 안쪽 span이 맡는다.
          */}
          <button
            type="button"
            onClick={selecting ? onToggleSelect : onOpen}
            aria-pressed={selecting ? selected : undefined}
            className="text-fg block w-full min-w-0 cursor-pointer bg-transparent text-left text-[16.5px] font-bold tracking-[-0.01em] after:absolute after:inset-0 after:rounded-[20px] after:content-['']"
          >
            <span className="block truncate">{course.name}</span>
          </button>
        </div>

        {selecting ? (
          <span
            className={`grid h-6.5 w-6.5 flex-none place-items-center rounded-full text-[13px] font-bold ${
              selected ? 'bg-brand text-fg' : 'border-line text-line border-[1.5px]'
            }`}
            aria-hidden="true"
          >
            ✓
          </span>
        ) : (
          /* z-10: 제목 버튼이 늘려둔 클릭 영역 위로 올라와야 삭제가 눌린다 */
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${course.name} 삭제`}
            className="text-line hover:bg-crowded-tint hover:text-crowded relative z-10 grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-[10px] bg-transparent text-[15px] transition-colors"
          >
            <Close />
          </button>
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
        <span className="text-hint text-xs">{formatRelativeTime(course.createdAt)} 저장</span>
        {!selecting && (
          <span className="text-brand-deep text-[13px] font-semibold" aria-hidden="true">
            상세 보기 <ChevronRight size={13} />
          </span>
        )}
      </div>
    </div>
  )
}
