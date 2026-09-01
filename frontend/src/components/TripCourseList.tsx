import { CongestionBadge } from './CongestionBadge'
import { HintDot, type HintTone } from './HintDot'
import { Close } from './icons'
import { regionNameOf } from '../constants/regions'
import type { SavedCourseSummary } from '../types/api'
import { addDays, daysBetween, formatMonthDay } from '../utils/date'

/** 앞 코스와 이 코스 사이에 걸린 사정 */
export interface Seam {
  tone: HintTone
  text: string
}

/**
 * 앞 코스와 이 코스 사이의 <b>이음새</b>.
 *
 * <p>{@code gap}은 앞 코스 마지막 날에서 이 코스 첫날까지의 일수다.
 * 1이면 바로 다음 날이라 딱 이어진다. 2 이상이면 사이가 비고, 0 이하면 겹친다.
 *
 * <h3>⚠️ 등급이 둘이다 — 여기서 갈린다</h3>
 * <b>앰버(알아두면 되는 것)</b>: 사이가 비었거나, 앞 코스가 끝나는 날 다음 코스가
 * 시작하는 것. 둘 다 <b>있을 수 있는 일정</b>이다 — 이동일이 하루 비는 것도, 마지막 날
 * 오후에 다음 지역으로 넘어가는 것도 여행에서는 흔하다.
 *
 * <p><b>붉은색(고쳐야 하는 것)</b>: 이틀 넘게 겹치는 것. 같은 시간에 두 곳에 있겠다는
 * 뜻이라 일정으로 성립하지 않는다. 이때만 날짜별 일정이 잠긴다 — 이어 붙이면 화면이
 * <b>있을 수 없는 일정</b>을 사실처럼 그리게 된다.
 *
 * <p>계산을 화면 안이 아니라 여기 두는 이유: 목록의 표시와 일정 탭의 잠금이 <b>같은 값</b>을
 * 봐야 한다. 두 곳에서 따로 세면 붉은 표시가 떴는데 일정이 열려 있는 날이 온다.
 */
export function seamBetween(previous: SavedCourseSummary, course: SavedCourseSummary): Seam | null {
  const gap = daysBetween(previous.endDate, course.startDate)
  if (gap === 1) {
    return null
  }
  if (gap > 1) {
    /*
     * 쪽지 안이라 <b>날짜를 그대로 적는다.</b> 겉으로 보일 때는 "1일 비어 있어요"로
     * 짧아야 했지만, 열어서 읽는 말이라면 <b>어느 날이 비었는지</b>가 훨씬 쓸모 있다 —
     * 그 날을 채울지 말지가 다음 판단이다.
     */
    const first = formatMonthDay(addDays(previous.endDate, 1))
    const last = formatMonthDay(addDays(course.startDate, -1))
    return {
      tone: 'warn',
      text: gap === 2 ? `${first}이 비어 있어요` : `${first} ~ ${last}이 비어 있어요`,
    }
  }
  if (gap === 0) {
    return {
      tone: 'warn',
      text: `앞 코스가 끝나는 ${formatMonthDay(course.startDate)}에 시작해요`,
    }
  }
  return { tone: 'danger', text: `앞 코스와 ${1 - gap}일 겹쳐요` }
}

/** 시작일순으로 세운다. 여행은 폴더가 아니라 시간표다 */
export function orderCourses(courses: SavedCourseSummary[]): SavedCourseSummary[] {
  return [...courses].sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** 이음새를 한 번에 센다. 목록과 잠금 판단이 같은 값을 본다 */
export function seamsOf(ordered: SavedCourseSummary[]): (Seam | null)[] {
  return ordered.map((course, index) =>
    index === 0 ? null : seamBetween(ordered[index - 1], course),
  )
}

/**
 * 여행에 담긴 코스의 <b>날짜 축</b>.
 *
 * <h3>왜 한 곳에 뒀나</h3>
 * 여행 카드와 상세 창이 <b>같은 목록</b>을 그린다 — 카드는 앞의 몇 개만, 상세는 전부.
 * 두 벌로 적으면 한쪽만 고쳐지는 날이 오고, "카드에서 보던 것"과 "펼쳐 본 것"이
 * 서로 다르게 생긴다. 사용자에게는 같은 목록이어야 한다.
 *
 * <h3>축이 말하는 것은 시간이다</h3>
 * 예전에는 코스가 그냥 목록이었고 날짜는 각 줄 밑에 묻혀 있었다. 점과 선으로 축을 세우면
 * <b>훑는 것만으로 순서와 사이가</b> 읽힌다.
 *
 * <p>⚠️ 점에 혼잡 색을 칠하지 않는다. 축이 말하는 것은 <b>시간</b>이고 점수는 오른쪽
 * 배지가 맡는다 — 한 신호를 두 곳에서 말하면 어느 쪽을 믿어야 할지 흐려진다.
 */
export function TripCourseList({
  ordered,
  seams,
  limit,
  onOpenCourse,
  onRemove,
}: {
  /** 이미 {@link orderCourses}로 세운 목록 */
  ordered: SavedCourseSummary[]
  seams: (Seam | null)[]
  /** 앞에서 몇 개까지만 그릴지. 없으면 전부 */
  limit?: number
  onOpenCourse: (courseId: number) => void
  onRemove: (courseId: number) => void
}) {
  const shown = limit === undefined ? ordered : ordered.slice(0, limit)
  const hidden = ordered.length - shown.length

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {shown.map((course, index) => {
        const seam = seams[index]
        /*
         * 잘린 목록에서는 <b>마지막 줄도 선을 잇는다.</b> 끊어 두면 거기서 여행이
         * 끝난 것처럼 보이는데, 실제로는 아래에 더 있다 — 이어진 선이 "계속된다"를 말한다.
         */
        const isLast = index === shown.length - 1 && hidden === 0

        return (
          <li key={course.id} className="flex flex-col">
            <div className="flex gap-3">
              {/* 축. 점 하나와 다음 점까지 잇는 선 */}
              <div className="flex w-2 flex-none flex-col items-center">
                <span
                  className="border-brand bg-surface mt-1.5 h-2 w-2 flex-none rounded-full border-2"
                  aria-hidden="true"
                />
                {!isLast && <span className="bg-line mt-0.5 w-px flex-1" aria-hidden="true" />}
              </div>

              <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pb-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/*
                    이음새 표시가 <b>이름 옆</b>에 붙는다. 축에 따로 한 줄을 두었더니
                    코스마다 줄이 하나씩 늘어 카드가 그만큼 길어졌고, 정작 그 줄은
                    대부분의 여행에 없다 — 있을 때만 이름 뒤에 조용히 따라붙는 편이
                    짧고, 어느 코스의 사정인지도 분명하다.
                  */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {/*
                      이름을 누르면 <b>코스 상세</b>가 열린다. 저장 목록의 카드와
                      <b>같은 {@code CourseDetailOverlay}</b>다 — 여행에서 누른 코스가
                      다른 화면을 보여줄 이유가 없다.

                      <p>클릭 영역을 줄 전체로 늘리지 <b>않는다.</b> 같은 줄에 이음새
                      표시와 빼기 버튼이 서 있어, 겹쳐 깔면 그 둘을 누르려다 상세가 열린다.

                      <p>{@code truncate}는 <b>안쪽 span</b>이 맡는다. 버튼에 걸면
                      초점 링까지 잘린다.
                    */}
                    <button
                      type="button"
                      title={course.name}
                      className="text-fg hover:text-brand-deep min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[15px] font-semibold transition-colors"
                      onClick={() => onOpenCourse(course.id)}
                    >
                      <span className="block truncate">{course.name}</span>
                    </button>
                    {seam && <HintDot label={seam.text} tone={seam.tone} />}
                  </span>
                  <span className="text-hint text-[12px]">
                    {regionNameOf(course.region)} · {formatMonthDay(course.startDate)} –{' '}
                    {formatMonthDay(course.endDate)}
                  </span>
                </div>

                <div className="flex flex-none items-center gap-0.5">
                  {/* 점수는 코스가 자기 것을 갖는다. 진단 전이면 그렇게 말한다 */}
                  {course.level !== null && course.totalQuietness !== null ? (
                    <CongestionBadge
                      level={course.level}
                      label={course.levelLabel ?? undefined}
                      quietness={course.totalQuietness}
                      size="sm"
                    />
                  ) : (
                    <span className="text-hint text-[11.5px]">진단 전</span>
                  )}
                  <button
                    type="button"
                    aria-label={`${course.name} 여행에서 빼기`}
                    className="text-hint hover:text-fg hover:bg-fill flex-none cursor-pointer rounded-full border-0 bg-transparent p-1.5 transition-colors"
                    onClick={() => onRemove(course.id)}
                  >
                    <Close size={13} />
                  </button>
                </div>
              </div>
            </div>
          </li>
        )
      })}

      {/*
        잘린 만큼을 <b>축 위에서</b> 말한다. 목록 밖에 따로 적으면 그 줄이 어디에
        딸린 말인지 흐려진다 — 점 대신 선이 이어져 내려오다 문장 하나로 끝난다.
      */}
      {hidden > 0 && (
        <li className="flex gap-3">
          <div className="flex w-2 flex-none justify-center">
            <span className="bg-line h-3 w-px" aria-hidden="true" />
          </div>
          <span className="text-hint pb-1 text-[12.5px]">코스 {hidden}개가 더 있어요</span>
        </li>
      )}
    </ul>
  )
}
