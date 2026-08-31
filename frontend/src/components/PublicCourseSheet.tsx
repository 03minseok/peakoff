import { useEffect } from 'react'
import { Close } from './icons'
import { LEVEL_COLOR_VAR, LEVEL_TINT } from './levelStyles'
import type { PublicCourse, PublicPlace } from '../types/api'
import { formatDateRange, formatNights, isPastDate } from '../utils/date'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props {
  course: PublicCourse
  onClose: () => void
  /** 이 코스를 그대로 내 편집 화면에 담는다 */
  onCopyToFlow: (course: PublicCourse) => void
}

/**
 * 다른 사람이 저장한 코스를 펼쳐 보는 시트.
 *
 * <h3>{@code CourseDetailOverlay}와 따로 둔 이유</h3>
 * 저쪽은 <b>코스 번호로 서버에 다시 묻는다.</b> 남의 코스에는 번호가 없다 — 번호를 주면
 * 그것을 훑어 하나씩 여는 통로가 생기므로 응답에서 뺐고, 대신 목록이 내용을 이미 들고 온다.
 * 그래서 이 시트는 <b>아무것도 부르지 않는다.</b> 받은 것을 그리기만 한다.
 *
 * <p>내용도 갈린다. 코스 이름이 없고(자기만 볼 줄 알고 지은 이름이라 감춘다),
 * "수정하기" 대신 "이 코스로 나도 짜보기"가 선다. 내 것이 아니니 고칠 수 없고,
 * 베껴 오는 것이 여기서 할 수 있는 일이다.
 *
 * <p>시트 껍데기(어두운 막·패널·닫기)를 공용 컴포넌트로 빼지 않은 것은 이 저장소의
 * 기존 방식을 따른 것이다 — {@code AlternativeSheet}·{@code ConfirmSheet}·{@code FormSheet}
 * 모두 자기 껍데기를 갖고 있다.
 */
export function PublicCourseSheet({ course, onClose, onCopyToFlow }: Props) {
  // 뒤 화면 잠금. ⚠️ body가 아니라 html에 건다 — 이유는 useScrollLock 주석에
  useScrollLock()
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  /*
   * 일차별로 묶는다.
   *
   * 마이페이지 겹창은 `1-1`, `1-2`처럼 번호를 앞에 달아 한 줄로 늘어놓는데, 그쪽은
   * <b>내가 짠 코스라 이미 아는 일정</b>이다. 여기는 처음 보는 남의 여행이라
   * "며칠짜리를 어떻게 나눴나"가 먼저 읽혀야 한다.
   */
  const byDay: PublicPlace[][] = Array.from({ length: course.days }, () => [])
  course.places.forEach((place) => {
    byDay[place.day - 1]?.push(place)
  })

  const past = isPastDate(course.endDate)
  // "경상북도 경주시" → "경주시". 카드가 좁아 앞쪽 도명까지는 들어가지 않는다.
  const shortRegion = course.regionName.replace(/^.*\s/, '')

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
        aria-labelledby="public-course-title"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="border-line bg-surface flex flex-none items-center justify-between border-b px-4.5 py-3.5 lg:px-6 lg:py-5">
          <h2
            id="public-course-title"
            className="text-fg m-0 text-[17px] font-bold tracking-[-0.015em] lg:text-[18px]"
          >
            다른 사람의 여행
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
          <article className="bg-surface shadow-rest flex flex-col gap-3.5 rounded-[20px] p-4.5 lg:p-5">
            {/* 홈 카드와 같은 제목을 쓴다. 눌러서 열었는데 제목이 달라지면 같은 코스로 안 읽힌다 */}
            <div className="flex flex-col gap-1">
              <span className="text-fg text-[16.5px] font-bold tracking-[-0.01em]">
                {course.nickname}님의 {course.regionShortName}
              </span>
              <span className="text-hint text-[12.5px]">
                {shortRegion} {formatNights(course.nights)} ·{' '}
                {formatDateRange(course.startDate, course.nights)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* 마이페이지 겹창과 같은 원형 게이지 — 같은 값이 화면마다 다르게 보이면 안 된다 */}
              <div
                className="grid h-[92px] w-[92px] flex-none place-items-center rounded-full p-2"
                style={{
                  background: `conic-gradient(${LEVEL_COLOR_VAR[course.level]} ${course.totalQuietness}%, var(--c-line) 0)`,
                }}
              >
                <div className="bg-surface flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full">
                  <span className="text-fg font-mono text-[26px] leading-none font-semibold">
                    {course.totalQuietness}
                  </span>
                  <span className="text-hint text-[10.5px]">한적 지수</span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-1.5">
                <span
                  className={`rounded-full px-2.75 py-1 text-[12.5px] font-semibold ${LEVEL_TINT[course.level]}`}
                >
                  {course.levelLabel}
                </span>
                <span className="text-muted text-[12.5px]">
                  담긴 장소 {course.places.length}곳
                </span>
                {/*
                  저장 시점의 점수라는 것을 밝힌다. 예측은 매일 갱신되므로 지금 다시 계산하면
                  다른 값이 나온다 — 계산하지 않은 것을 지금 값처럼 말하지 않는다.
                */}
                <span className="text-hint text-[11.5px]">저장할 때의 점수예요</span>
              </div>
            </div>

            <div className="border-line/60 flex flex-col gap-3 border-t pt-3.5">
              {byDay.map((places, index) => (
                <div key={index} className="flex flex-col gap-1.75">
                  <span className="text-hint text-[11.5px] font-semibold">
                    {index + 1}일차
                  </span>
                  {places.length === 0 ? (
                    // 빈 일차를 건너뛰지 않는다. 건너뛰면 2박 3일인데 이틀만 있는 것처럼 보인다.
                    <span className="text-hint pl-1 text-[13px]">담긴 장소가 없어요</span>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-1.75 pl-0">
                      {places.map((place) => (
                        <li
                          key={`${place.day}-${place.order}-${place.placeId}`}
                          className="flex items-center gap-2.25"
                        >
                          <span className="bg-bg text-hint grid h-5 w-5 flex-none place-items-center rounded-full font-mono text-[10.5px] font-semibold">
                            {place.order}
                          </span>
                          <span className="text-fg truncate text-[13.5px] font-medium">
                            {place.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/*
              남의 코스는 고칠 수 없다. 할 수 있는 것은 <b>베껴 와서 내 것으로 짜는 일</b>이고,
              그러면 편집 화면으로 간다 — 진단 화면이 아니다. 남의 일정을 그대로 진단해 봐야
              내 여행이 아니고, 대개 날짜부터 갈아야 한다.
            */}
            <button
              type="button"
              onClick={() => onCopyToFlow(course)}
              className="border-brand bg-surface text-fg hover:bg-bg rounded-ui mt-1 h-12 cursor-pointer border-[1.5px] text-sm font-semibold transition-colors"
            >
              이 코스로 나도 짜보기
            </button>
            {past && (
              /*
                지난 날짜 그대로 담으면 진단이 통째로 비어 나온다(예측은 앞으로 24일치뿐).
                담기 전에 미리 말해 준다 — 담고 나서 숫자가 안 나오면 고장으로 읽힌다.
              */
              <p className="text-hint m-0 text-center text-[11.5px] leading-[1.6]">
                지난 날짜의 여행이라 장소만 담고
                <br />
                날짜는 새로 골라 드려요.
              </p>
            )}
          </article>
        </div>
      </div>
    </div>
  )
}
