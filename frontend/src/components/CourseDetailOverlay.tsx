import { useEffect, useState } from 'react'
import { Close } from './icons'
import { LEVEL_COLOR_VAR, LEVEL_TINT } from './levelStyles'
import { fetchSavedCourse } from '../services/api'
import type { SavedCourseDetail } from '../types/api'
import { formatDateRange, formatNights, isPastDate } from '../utils/date'

interface Props {
  /** 펼쳐 볼 코스. 1개면 상세, 2개면 나란히 비교 */
  courseIds: number[]
  onClose: () => void
  /** 코스를 흐름에 올려 다시 진단한다. 1개일 때, 지난 여행이 아닐 때만 쓴다 */
  onOpenInFlow: (course: SavedCourseDetail) => void
}

type Phase =
  | { status: 'loading' }
  | { status: 'loaded'; courses: SavedCourseDetail[] }
  | { status: 'error' }

/**
 * 저장한 코스를 펼쳐 보는 겹창.
 *
 * <p>상세와 비교가 같은 컴포넌트다. 둘의 차이는 <b>몇 개를 나란히 놓느냐</b>뿐이고,
 * 카드 안에 그리는 내용은 같다. 따로 만들면 한쪽만 고쳐지는 날이 온다.
 *
 * <p>모바일에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 뜨는 창이다.
 * 모바일에서 가운데 띄우면 좌우 여백이 낭비되고 닫기 버튼이 엄지에서 멀어진다.
 *
 * <h3>장소별 점수가 없는 이유</h3>
 * 저장할 때 남긴 것은 <b>코스 총점 하나</b>다. 장소마다의 한적도를 보려면 진단을 다시
 * 돌려야 하는데, 지난 여행은 예측 데이터가 없어 값이 나오지 않는다. 목록에 지난 여행이
 * 섞여 있는 화면에서 어떤 카드는 점수가 뜨고 어떤 카드는 안 뜨면 더 헷갈린다.
 * 여기서는 저장 시점의 총점과 담긴 장소만 보여주고, 장소별 진단은
 * "다시 진단하기"로 흐름에 올려 진단 화면에서 본다.
 */
export function CourseDetailOverlay({ courseIds, onClose, onOpenInFlow }: Props) {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    Promise.all(courseIds.map((id) => fetchSavedCourse(id, controller.signal)))
      .then((courses) => setPhase({ status: 'loaded', courses }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setPhase({ status: 'error' })
      })

    return () => controller.abort()
    // courseIds는 매 렌더 새 배열이라 그대로 넣으면 무한히 다시 부른다. 내용으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseIds.join(',')])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const comparing = courseIds.length > 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-h-[82svh] lg:max-w-[720px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-detail-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="border-line bg-surface flex flex-none items-center justify-between border-b px-4.5 py-3.5 lg:px-6 lg:py-5">
          <h2
            id="course-detail-title"
            className="text-fg m-0 text-[17px] font-bold tracking-[-0.015em] lg:text-[18px]"
          >
            {comparing ? '코스 비교' : '코스 상세'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted hover:bg-line/40 grid h-8.5 w-8.5 cursor-pointer place-items-center rounded-[11px] bg-transparent text-base transition-colors"
          >
            <Close />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {phase.status === 'loading' && (
            <div className={`grid gap-3 ${comparing ? 'lg:grid-cols-2' : ''}`}>
              {courseIds.map((id) => (
                <div key={id} className="bg-surface shadow-rest rounded-[20px] p-5">
                  <div className="skeleton mb-3 h-4.5 w-40" />
                  <div className="skeleton mb-4 h-3 w-28" />
                  <div className="skeleton h-16 w-full rounded-[14px]" />
                </div>
              ))}
            </div>
          )}

          {phase.status === 'error' && (
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              코스를 불러오지 못했어요.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          )}

          {phase.status === 'loaded' && (
            <div className={`grid gap-3 ${comparing ? 'lg:grid-cols-2' : ''}`}>
              {phase.courses.map((course) => (
                <article
                  key={course.id}
                  className="bg-surface shadow-rest flex flex-col gap-3.5 rounded-[20px] p-4.5 lg:p-5"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-fg text-[16.5px] font-bold tracking-[-0.01em]">
                      {course.name}
                    </span>
                    <span className="text-hint text-[12.5px]">
                      {course.regionName.replace(/^.*\s/, '')} · {formatNights(course.nights)} ·{' '}
                      {formatDateRange(course.startDate, course.nights)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/*
                      원형 게이지. 색은 CSS 변수로 넘긴다 — 값이 실행 중에 정해져
                      클래스로 만들 수 없지만, 색 정의는 여전히 index.css 한 곳에만 남는다.
                    */}
                    {/*
                      점수가 없으면 <b>게이지를 비워 둔다.</b> 0%로 그리면 텅 빈 고리가
                      "매우 붐빔"으로 읽히고, 100%로 채우면 반대 거짓말이 된다.
                      테두리 색(--c-line)만 남겨 "아직 재지 않았다"를 모양으로 말한다.
                    */}
                    <div
                      className="grid h-[92px] w-[92px] flex-none place-items-center rounded-full p-2"
                      style={{
                        background:
                          course.level === null || course.totalQuietness === null
                            ? 'var(--c-line)'
                            : `conic-gradient(${LEVEL_COLOR_VAR[course.level]} ${course.totalQuietness}%, var(--c-line) 0)`,
                      }}
                    >
                      <div className="bg-surface flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full">
                        <span
                          className={`font-mono text-[26px] leading-none font-semibold ${
                            course.totalQuietness === null ? 'text-hint' : 'text-fg'
                          }`}
                        >
                          {course.totalQuietness ?? '—'}
                        </span>
                        <span className="text-hint text-[10.5px]">한적 지수</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-1.5">
                      <span
                        className={`rounded-full px-2.75 py-1 text-[12.5px] font-semibold ${
                          course.level === null ? 'bg-bg text-hint' : LEVEL_TINT[course.level]
                        }`}
                      >
                        {course.levelLabel ?? '아직 진단 전'}
                      </span>
                      <span className="text-muted text-[12.5px]">
                        담긴 장소 {course.places.length}곳
                      </span>
                    </div>
                  </div>

                  <ul className="border-line/60 m-0 flex list-none flex-col gap-1.75 border-t pt-3.5 pl-0">
                    {course.places.map((saved) => (
                      <li
                        key={`${saved.day}-${saved.order}-${saved.placeId}`}
                        className="flex items-center gap-2.25"
                      >
                        <span className="text-hint w-7 flex-none font-mono text-[11px]">
                          {saved.day}-{saved.order}
                        </span>
                        {/*
                          저장 시점의 이름을 그대로 쓴다. 장소 API에 다시 묻지 않으므로
                          "정보를 찾을 수 없는 장소"가 나올 일이 없다 — 이름을 우리가 갖고 있다.
                        */}
                        <span className="text-fg truncate text-[13.5px] font-medium">
                          {saved.placeName}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/*
                    재계산은 <b>사용자가 누를 때만</b> 한다. 예측 데이터가 갱신되므로 열 때마다
                    자동으로 다시 돌리면 저장해둔 숫자가 열 때마다 흔들린다 — 위에 보이는 것은
                    항상 저장 시점의 스냅샷이고, 이 버튼이 유일한 재계산 입구다.

                    지난 여행에는 버튼을 두지 않는다. 예측 데이터가 미래만 다루므로
                    지난 날짜로 다시 진단하면 값이 나오지 않는다. 버튼을 비활성으로 두는 대신
                    문장으로 이유를 말한다 — 잠긴 버튼은 "왜 안 되는지"를 설명하지 못한다.
                  */}
                  {!comparing &&
                    (isPastDate(course.endDate) ? (
                      <p className="bg-bg text-hint rounded-ui m-0 mt-1 px-3.5 py-3 text-center text-[12.5px] leading-[1.6]">
                        지난 여행이에요.
                        <br />
                        저장할 때의 진단 결과를 보여드리고 있어요.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenInFlow(course)}
                        className="border-line bg-surface text-fg hover:bg-bg rounded-ui mt-1 h-12 cursor-pointer border text-sm font-semibold transition-colors"
                      >
                        수정하기
                      </button>
                    ))}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
