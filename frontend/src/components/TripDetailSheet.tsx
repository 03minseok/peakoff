import { useEffect, useState } from 'react'
import { Close } from './icons'
import { orderCourses, seamsOf, TripCourseList } from './TripCourseList'
import { fetchSavedCourse } from '../services/api'
import type { SavedCourseDetail, Trip } from '../types/api'
import { addDays, daysBetween, formatMonthDay, formatWeekday } from '../utils/date'
import { useScrollLock } from '../hooks/useScrollLock'
import { regionNameOf } from '../constants/regions'

type Pane = 'courses' | 'days'

/** 하루치. 같은 날에 두 코스가 걸치면 {@code blocks}가 둘이 된다 */
interface Day {
  date: string
  /** 여행 첫날부터 몇 번째 날인가 */
  nth: number
  blocks: {
    courseId: number
    courseName: string
    region: string
    places: string[]
    /**
     * 코스 이름을 적을지. <b>직전 블록과 코스가 다를 때만</b> 적는다.
     *
     * <p>이틀짜리 코스는 이틀 내내 같은 이름을 이고 있었다 — "제주시 · 제주 오름 이틀"이
     * 1일차와 2일차에 똑같이. 코스가 바뀌는 자리에서만 이름이 서면 그 줄이
     * <b>"여기서 코스가 넘어간다"</b>는 뜻을 갖는다.
     */
    showLabel: boolean
  }[]
}

type Phase =
  { status: 'loading' } | { status: 'loaded'; days: Day[]; missing: number } | { status: 'error' }

/**
 * 여행 하나를 펼쳐 보는 겹창. <b>두 갈래</b>다 — 담긴 코스 목록과, 날짜 하나로 이어 붙인 일정.
 *
 * <h3>왜 카드에서 떼어 왔나</h3>
 * 여행 카드가 담긴 코스를 전부 세우고 있었더니 <b>코스 수만큼 카드 높이가 달라져</b>
 * 목록이 들쭉날쭉했다. 카드는 앞의 몇 개만 보여 주고 나머지는 여기서 본다 —
 * 카드는 훑는 자리이고 이 창이 들여다보는 자리다.
 *
 * <p>코스 목록은 <b>카드와 같은 {@link TripCourseList}</b>를 그린다. 카드에서 보던 것과
 * 펼쳐 본 것이 다르게 생기면 같은 여행으로 읽히지 않는다.
 *
 * <h3>왜 코스별이 아니라 날짜별인가</h3>
 * 여행 카드는 이미 코스별로 보여준다. 이 창이 더할 것이 있다면 <b>코스 경계를 지운 하나의
 * 일정</b>이다 — "9월 10일에 나는 어디에 있나"는 코스 목록으로는 답이 안 나온다.
 * 지역이 달라 한 코스에 못 담던 곳들이 여기서 같은 날짜 축 위에 선다.
 *
 * <p>그래서 <b>날짜로 묶는다.</b> 코스마다의 "1일차"가 아니라 실제 날짜로 옮겨 붙이므로,
 * 앞 코스가 끝나는 날 다음 코스가 시작하면 그 날짜 아래 두 코스가 나란히 선다 —
 * 억지로 하나로 합치지 않고 <b>있는 그대로 이어 붙인다.</b>
 *
 * <p>비어 있는 날은 <b>한 줄로 접는다.</b> 사흘이 비었다고 빈 칸 셋을 세우면 일정보다
 * 공백이 커진다. 며칠이 비었는지만 말하고 넘어간다.
 *
 * <h3>⚠️ 겹치는 코스가 있으면 이 창이 열리지 않는다</h3>
 * 이틀 넘게 겹치는 것은 같은 시간에 두 곳에 있겠다는 뜻이라, 이어 붙이면 화면이
 * <b>있을 수 없는 일정</b>을 사실처럼 그린다. 여는 버튼이 잠기고 붉은 표시가 어디가
 * 문제인지 가리킨다.
 *
 * <h3>점수를 적지 않는다</h3>
 * 코스마다의 총점은 <b>그 코스의 관광지들로 낸 평균</b>이라 서로 이어 붙일 수 없다.
 * 여행 전체의 한적도라는 값은 존재하지 않는다 — 여기서 숫자를 내걸면 만들어낸 값이 된다.
 * 점수는 코스 카드가 각자 제 것을 갖고 있다.
 */
export function TripDetailSheet({
  trip,
  onClose,
  onOpenCourse,
  onRemoveCourse,
}: {
  trip: Trip
  onClose: () => void
  onOpenCourse: (courseId: number) => void
  onRemoveCourse: (courseId: number) => void
}) {
  const [pane, setPane] = useState<Pane>('courses')
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })

  const ordered = orderCourses(trip.courses)
  const regions = [...new Set(ordered.map((course) => regionNameOf(course.region)))]
  const seams = seamsOf(ordered)
  const blocked = seams.some((seam) => seam?.tone === 'danger')

  useScrollLock()

  /*
   * ⚠️ 코스 목록은 <b>서버에 다시 묻지 않는다.</b> {@code trip}이 이미 들고 있고,
   * 상세를 부르는 것은 <b>날짜별 일정</b>에만 필요하다(장소 목록이 거기서만 쓰인다).
   * 두 탭이 같은 호출을 나눠 쓰면 코스 목록만 볼 사람에게도 코스 수만큼 호출이 나간다.
   */
  useEffect(() => {
    const controller = new AbortController()
    const ids = trip.courses.map((course) => course.id)

    /*
     * ⚠️ <b>allSettled다.</b> Promise.all로 묶으면 코스 하나가 실패할 때 나머지 아홉이
     * 함께 사라져 창이 통째로 오류가 된다 — 아홉을 보여주고 "한 코스를 못 불러왔다"고
     * 말하는 편이 낫다. 못 받은 수를 함께 들고 나간다.
     */
    Promise.allSettled(ids.map((id) => fetchSavedCourse(id, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) {
          return
        }
        const loaded = results
          .filter(
            (result): result is PromiseFulfilledResult<SavedCourseDetail> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value)
        if (loaded.length === 0) {
          setPhase({ status: 'error' })
          return
        }
        setPhase({ status: 'loaded', days: buildDays(loaded), missing: ids.length - loaded.length })
      })
      .catch(() => setPhase({ status: 'error' }))

    return () => controller.abort()
    // 코스 <b>구성</b>이 바뀔 때만 다시 부른다. trip은 다른 이유로도 새 객체가 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.courses.map((course) => course.id).join(',')])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const days = phase.status === 'loaded' ? phase.days : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-surface relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-h-[82svh] lg:max-w-[560px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-timeline-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        {/*
          머리는 <b>한 덩어리</b>다. 제목 줄과 탭 줄이 각각 흰 면에 경계선을 갖고 있었더니
          껍데기가 두 층으로 두꺼워져, 390px에서 상단 150px이 내용이 아니었다.
        */}
        <div className="border-line bg-surface flex flex-none flex-col gap-3 border-b px-4.5 pt-3.5 pb-3 lg:px-6 lg:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2
                id="trip-timeline-title"
                className="text-fg m-0 truncate text-[17px] font-bold tracking-[-0.015em] lg:text-[18px]"
              >
                {trip.name}
              </h2>
              {/*
                ⚠️ <b>불러오기에 기대지 않는 요약</b>이다. 예전에는 "코스 4개"로 떴다가
                일정을 받은 뒤 "· 8일 · 장소 12곳"이 붙어 <b>글자가 늘어났고</b>,
                그 "8일"이 카드의 "11일간"과 어긋나 하나가 틀린 것처럼 읽혔다
                (하나는 일정 있는 날, 하나는 여행 폭이다). 지역은 {@code trip}이 이미
                들고 있어 늘어나지 않고, 이 여행이 어디를 도는지도 함께 말한다.
              */}
              <span className="text-hint truncate text-[12.5px]">
                코스 {trip.courses.length}개{regions.length > 0 && ` · ${regions.join(' · ')}`}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="text-muted hover:bg-line/40 grid h-8.5 w-8.5 flex-none cursor-pointer place-items-center rounded-[11px] bg-transparent text-base transition-colors"
            >
              <Close />
            </button>
          </div>

          {/*
            ■ 두 갈래를 <b>같은 자리에서 갈아끼운다.</b>

            코스 목록과 날짜별 일정은 같은 여행을 두 가지로 본 것이다 — 위아래로 쌓으면
            맞대어 보라고 만든 화면에서 스크롤로 기억해 비교하게 된다.

            <p>⚠️ <b>한 덩어리 스위치로 묶는다</b>(2026-09-01). 켜진 쪽만 어두운 알약이고
            꺼진 쪽은 배경 없는 글자였더니, 하나는 버튼이고 하나는 링크처럼 보여
            <b>둘이 한 쌍이라는 것이 읽히지 않았다.</b> 홈통을 깔면 "여기서 둘 중 하나를
            고른다"가 모양으로 드러난다.
          */}
          <div className="bg-fill inline-flex w-fit gap-0.5 rounded-[12px] p-1">
            {[
              { key: 'courses' as const, label: '코스 목록' },
              { key: 'days' as const, label: '날짜별 일정' },
            ].map((option) => {
              const active = pane === option.key
              /*
                ⚠️ 붉은 이음새가 있으면 <b>일정 쪽을 잠근다.</b> 이틀 넘게 겹치는 일정을
                날짜 축에 올리면 있을 수 없는 하루가 사실처럼 그려진다.
              */
              const locked = option.key === 'days' && blocked
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-current={active}
                  disabled={locked}
                  onClick={() => setPane(option.key)}
                  className={`h-8 cursor-pointer rounded-[9px] border-0 px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${
                    active
                      ? 'bg-surface text-fg shadow-rest'
                      : 'text-muted hover:text-fg disabled:text-hint bg-transparent'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {/*
          ■ 본문은 <b>흰 면 그대로</b>다.

          회색 바탕 위에 흰 카드를 얹고 있었는데, 창 자체가 이미 그릇이라
          <b>그릇 안의 그릇</b>이 됐다. 특히 날짜별 일정은 <b>하루에 카드 한 장</b>이라
          장소 한둘을 담은 카드가 세로로 끝없이 이어졌다 — 그릇이 내용보다 컸다.
          한 면에 눕히고 <b>가는 선</b>으로만 날을 가른다.
        */}
        <div className="bg-surface flex-1 overflow-y-auto px-4.5 py-4 lg:px-6 lg:py-5">
          {pane === 'courses' ? (
            ordered.length === 0 ? (
              <p className="text-hint m-0 py-8 text-center text-[13px] leading-[1.6]">
                아직 여행에 아무 코스도 없어요.
                <br />
                코스를 담으면 여기에 순서대로 모여요.
              </p>
            ) : (
              <>
                <TripCourseList
                  ordered={ordered}
                  seams={seams}
                  onOpenCourse={onOpenCourse}
                  onRemove={onRemoveCourse}
                />
                {blocked && (
                  <p className="text-crowded-deep m-0 pt-1 text-center text-[12px] leading-[1.5]">
                    날짜가 겹치는 코스가 있어 날짜별 일정은 볼 수 없어요.
                  </p>
                )}
              </>
            )
          ) : (
            <>
              {phase.status === 'loading' && (
                <div className="flex flex-col gap-5">
                  {[0, 1, 2].map((row) => (
                    <div key={row}>
                      <div className="skeleton mb-3 h-3.5 w-32" />
                      <div className="skeleton h-4 w-44" />
                    </div>
                  ))}
                </div>
              )}

              {phase.status === 'error' && (
                <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
                  일정을 불러오지 못했어요.
                  <br />
                  잠시 후 다시 시도해 주세요.
                </p>
              )}

              {phase.status === 'loaded' &&
                (days.length === 0 ? (
                  <p className="text-hint m-0 py-8 text-center text-[13px] leading-[1.6]">
                    담긴 코스에 아직 장소가 없어요.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {phase.missing > 0 && (
                      <p
                        className="bg-crowded-tint text-crowded-deep rounded-ui m-0 mb-4 px-3.5 py-2.5 text-[12.5px]"
                        role="alert"
                      >
                        코스 {phase.missing}개를 불러오지 못해 빠져 있어요.
                      </p>
                    )}

                    {days.map((day, index) => {
                      const previous = index > 0 ? days[index - 1] : null
                      const gapFrom = previous ? addDays(previous.date, 1) : null
                      const gapTo = addDays(day.date, -1)
                      const empty = previous ? daysBetween(previous.date, day.date) - 1 : 0

                      return (
                        <div key={day.date}>
                          {/*
                            비어 있는 날은 <b>날짜를 그대로 적는다.</b> "1일 비어 있어요"로는
                            일차가 왜 건너뛰는지가 설명되지 않았다 — 3일차가 사라진 것처럼
                            보인다. 비는 날을 이름 대면 그 자리가 왜 비었는지를 스스로 말한다.
                          */}
                          {empty > 0 && gapFrom && (
                            <div className="flex items-center gap-3 py-3" role="separator">
                              <span
                                className="border-line flex-1 border-t border-dashed"
                                aria-hidden="true"
                              />
                              <span className="text-hint flex-none text-[12px]">
                                {empty === 1
                                  ? formatMonthDay(gapFrom) + ' 비어 있어요'
                                  : formatMonthDay(gapFrom) +
                                    ' ~ ' +
                                    formatMonthDay(gapTo) +
                                    ' 비어 있어요'}
                              </span>
                              <span
                                className="border-line flex-1 border-t border-dashed"
                                aria-hidden="true"
                              />
                            </div>
                          )}

                          {/* 첫 날이 아니고 비지도 않았으면 가는 선 하나로 가른다 */}
                          {index > 0 && empty === 0 && (
                            <span className="border-line block border-t" aria-hidden="true" />
                          )}

                          <section className="flex flex-col gap-2 py-3.5">
                            {/*
                              <b>날짜가 앞서고 일차가 따라온다</b>(2026-09-01). 일차가 앞에
                              섰을 때 "2일차 다음이 4일차"가 <b>3일차를 잃어버린 것</b>처럼
                              읽혔다 — 사람들은 "일차"를 일정 있는 날의 순번으로 읽는데,
                              여기서는 여행 첫날부터의 달력 일수다. 달력이 앞에 서면
                              건너뜀이 자연스럽고, 일차는 거드는 값이 된다.
                            */}
                            <div className="flex items-baseline gap-2">
                              <span className="text-fg text-[14px] font-bold">
                                {formatMonthDay(day.date)}
                              </span>
                              <span className="text-muted text-[12.5px]">
                                {formatWeekday(day.date)}
                              </span>
                              <span className="text-hint ml-auto flex-none text-[12px]">
                                {day.nth}일차
                              </span>
                            </div>

                            {day.blocks.map((block) => (
                              <div key={block.courseId} className="flex flex-col gap-1.5">
                                {/*
                                  코스 이름은 <b>바뀔 때만</b> 적는다. 이틀짜리 코스가 이틀
                                  내내 같은 이름을 이고 있으면 그 줄은 소음이고, 바뀌는
                                  자리에서만 서면 "여기서 코스가 넘어간다"는 뜻을 갖는다.
                                */}
                                {block.showLabel && (
                                  <span className="text-brand-deep text-[11.5px] font-semibold">
                                    {regionNameOf(block.region)} · {block.courseName}
                                  </span>
                                )}
                                <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {block.places.map((place, order) => (
                                    <li
                                      key={place + '-' + order}
                                      className="flex items-center gap-2.5"
                                    >
                                      <span
                                        className="bg-fill text-muted grid h-5.5 w-5.5 flex-none place-items-center rounded-full text-[11px] font-bold"
                                        aria-hidden="true"
                                      >
                                        {order + 1}
                                      </span>
                                      <span className="text-fg min-w-0 flex-1 truncate text-[14.5px]">
                                        {place}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </section>
                        </div>
                      )
                    })}
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 코스 여럿을 <b>실제 날짜</b> 하나의 축으로 옮겨 붙인다.
 *
 * <p>코스의 {@code day}는 그 코스 안에서의 순번이라 코스끼리 이어붙일 수 없다.
 * {@code 시작일 + (day - 1)}로 실제 날짜를 구해야 서로 다른 코스가 같은 자를 쓴다.
 *
 * <p>같은 날짜에 두 코스가 걸리면 <b>먼저 시작한 코스가 먼저</b> 선다. 그래야 여행이
 * 흘러온 순서대로 읽힌다.
 */
function buildDays(courses: SavedCourseDetail[]): Day[] {
  const byDate = new Map<string, Day['blocks']>()

  for (const course of [...courses].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const grouped = new Map<number, string[]>()
    for (const place of [...course.places].sort((a, b) =>
      a.day === b.day ? a.order - b.order : a.day - b.day,
    )) {
      const bucket = grouped.get(place.day) ?? []
      bucket.push(place.placeName)
      grouped.set(place.day, bucket)
    }

    for (const [day, places] of grouped) {
      const date = addDays(course.startDate, day - 1)
      const blocks = byDate.get(date) ?? []
      blocks.push({
        courseId: course.id,
        courseName: course.name,
        region: course.region,
        places,
        showLabel: true,
      })
      byDate.set(date, blocks)
    }
  }

  const dates = [...byDate.keys()].sort()
  /*
   * "N일차"는 <b>여행 첫날 기준</b>이다. 빈 날이 있어도 날짜만큼 세어 나가므로,
   * 사흘 비고 나면 다음이 4일차가 아니라 7일차다 — 달력과 어긋나지 않게 한다.
   */
  const first = dates[0]
  const built = dates.map((date) => ({
    date,
    nth: daysBetween(first, date) + 1,
    blocks: byDate.get(date) ?? [],
  }))

  // 코스가 <b>바뀌는 자리</b>에서만 이름을 적는다. 날짜를 건너뛰며 한 번에 훑는다.
  let previousCourseId: number | null = null
  for (const day of built) {
    for (const block of day.blocks) {
      block.showLabel = block.courseId !== previousCourseId
      previousCourseId = block.courseId
    }
  }
  return built
}
