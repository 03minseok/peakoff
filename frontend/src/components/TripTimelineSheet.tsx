import { useEffect, useState } from 'react'
import { Close } from './icons'
import { fetchSavedCourse } from '../services/api'
import type { SavedCourseDetail, Trip } from '../types/api'
import { addDays, daysBetween, formatMonthDay, formatWeekday } from '../utils/date'
import { useScrollLock } from '../hooks/useScrollLock'
import { regionNameOf } from '../constants/regions'

/** 하루치. 같은 날에 두 코스가 걸치면 {@code blocks}가 둘이 된다 */
interface Day {
  date: string
  /** 여행 첫날부터 몇 번째 날인가 */
  nth: number
  blocks: { courseId: number; courseName: string; region: string; places: string[] }[]
}

type Phase =
  { status: 'loading' } | { status: 'loaded'; days: Day[]; missing: number } | { status: 'error' }

/**
 * 여행에 담긴 코스를 <b>날짜 하나로 이어</b> 펴는 겹창.
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
export function TripTimelineSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })

  useScrollLock()

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
  }, [trip])

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
  const placeCount = days.reduce(
    (sum, day) => sum + day.blocks.reduce((inner, block) => inner + block.places.length, 0),
    0,
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-h-[82svh] lg:max-w-[560px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-timeline-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="border-line bg-surface flex flex-none items-start justify-between gap-3 border-b px-4.5 py-3.5 lg:px-6 lg:py-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2
              id="trip-timeline-title"
              className="text-fg m-0 truncate text-[17px] font-bold tracking-[-0.015em] lg:text-[18px]"
            >
              {trip.name}
            </h2>
            {/* 모수를 적는다. 무엇을 이어 붙인 화면인지 한 줄로 말한다 */}
            {phase.status === 'loaded' && (
              <span className="text-hint text-[12.5px]">
                코스 {trip.courses.length}개 · {days.length}일 · 장소 {placeCount}곳
              </span>
            )}
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {phase.status === 'loading' && (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="bg-surface shadow-rest rounded-[18px] p-4.5">
                  <div className="skeleton mb-3 h-3.5 w-28" />
                  <div className="skeleton h-4 w-40" />
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

          {phase.status === 'loaded' && (
            <div className="flex flex-col gap-2.5">
              {phase.missing > 0 && (
                <p
                  className="bg-crowded-tint text-crowded-deep rounded-ui m-0 px-3.5 py-2.5 text-[12.5px]"
                  role="alert"
                >
                  코스 {phase.missing}개를 불러오지 못해 빠져 있어요.
                </p>
              )}

              {days.map((day, index) => {
                const previous = index > 0 ? days[index - 1] : null
                const empty = previous ? daysBetween(previous.date, day.date) - 1 : 0

                return (
                  <div key={day.date} className="flex flex-col gap-2.5">
                    {/*
                      비어 있는 날은 한 줄로 접는다. 빈 칸을 날짜 수만큼 세우면
                      일정보다 공백이 커진다.
                    */}
                    {empty > 0 && (
                      <p className="text-hint m-0 px-1 py-0.5 text-[12px]">{empty}일 비어 있어요</p>
                    )}

                    <section className="bg-surface shadow-rest flex flex-col gap-3 rounded-[18px] p-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-fg text-[14.5px] font-bold">{day.nth}일차</span>
                        <span className="text-muted text-[13px]">
                          {formatMonthDay(day.date)} ({formatWeekday(day.date)})
                        </span>
                      </div>

                      {day.blocks.map((block) => (
                        <div key={block.courseId} className="flex flex-col gap-1.5">
                          {/*
                            어느 코스에서 온 줄인지 적는다. 날짜로 이어 붙이면 코스 경계가
                            사라지는데, <b>앞 코스가 끝나는 날 다음 코스가 시작하면</b>
                            한 날짜 아래 두 코스가 선다 — 그때 이 줄이 유일한 구분이다.
                          */}
                          <span className="text-hint text-[11.5px] font-semibold">
                            {regionNameOf(block.region)} · {block.courseName}
                          </span>
                          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                            {block.places.map((place, order) => (
                              <li key={`${place}-${order}`} className="flex items-center gap-2.5">
                                <span
                                  className="bg-fill text-muted grid h-5.5 w-5.5 flex-none place-items-center rounded-full text-[11px] font-bold"
                                  aria-hidden="true"
                                >
                                  {order + 1}
                                </span>
                                <span className="text-fg min-w-0 flex-1 truncate text-[14px]">
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
  return dates.map((date) => ({
    date,
    nth: daysBetween(first, date) + 1,
    blocks: byDate.get(date) ?? [],
  }))
}
