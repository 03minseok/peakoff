import { LEVEL_TINT } from './levelStyles'
import { Close } from './icons'
import type { SavedCourseSummary } from '../types/api'
import { formatDateRange, formatNights, formatRelativeTime, isPastDate } from '../utils/date'

interface Props {
  course: SavedCourseSummary
  onOpen: () => void
  onDelete: () => void
}

/** 지역·기간처럼 짧은 정보를 다는 알약 */
const META_CHIP =
  'rounded-[8px] bg-bg px-2.25 py-1 text-xs font-medium text-muted max-md:px-2 max-md:py-0.75 max-md:text-[11px]'

/**
 * 마이페이지 목록의 코스 카드 한 장.
 *
 * <p>모바일과 데스크톱이 같은 컴포넌트를 쓴다. 다른 것은 바깥 격자뿐이라
 * (모바일 1열 · 데스크톱 3열) 카드를 두 벌 만들 이유가 없다.
 *
 * <h3>좁은 화면에서만 한 치수 작다</h3>
 * 홈의 카드가 모두 작아지면서(120px 타일 · 12~14.5px 글자) 이 화면만 큰 글씨로 남아,
 * 같은 앱의 두 화면이 <b>서로 다른 축척</b>으로 보였다. 여백·모서리·글자를 홈에 맞춰 내렸다.
 *
 * <p>⚠️ <b>{@code max-md:}로만 내린다.</b> 기본 클래스를 고치면 넓은 화면까지 함께 움직인다 —
 * 그쪽은 3열이라 카드 폭이 이미 좁고, 지금 크기가 맞다. 경계값은 마이페이지의
 * 모바일·데스크톱이 갈리는 자리(탭이 사라지는 {@code md})를 그대로 쓴다.
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
export function SavedCourseCard({ course, onOpen, onDelete }: Props) {
  const past = isPastDate(course.endDate)

  return (
    // relative: 제목 버튼의 ::after가 이 상자를 기준으로 늘어난다
    <div
      className={`bg-surface shadow-rest relative flex flex-col gap-3 rounded-[20px] border-[1.5px] border-transparent p-4.5 transition-colors max-md:gap-2 max-md:rounded-[16px] max-md:p-3.5 ${
        past ? 'opacity-65' : ''
      }`}
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
            onClick={onOpen}
            className="text-fg block w-full min-w-0 cursor-pointer bg-transparent text-left text-[16.5px] font-bold tracking-[-0.01em] max-md:text-[14.5px] after:absolute after:inset-0 after:rounded-[20px] after:content-[''] max-md:after:rounded-[16px]"
          >
            <span className="block truncate">{course.name}</span>
          </button>
        </div>

        {/* z-10: 제목 버튼이 늘려둔 클릭 영역 위로 올라와야 삭제가 눌린다 */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${course.name} 삭제`}
          className="text-line hover:bg-crowded-tint hover:text-crowded relative z-10 grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-[10px] bg-transparent text-[15px] transition-colors max-md:h-7 max-md:w-7 max-md:text-[13px]"
        >
          <Close />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 max-md:gap-1.5">
        <span className={META_CHIP}>{course.regionName.replace(/^.*\s/, '')}</span>
        <span className={META_CHIP}>{formatNights(course.nights)}</span>
        <span className={META_CHIP}>{course.placeCount}곳</span>
      </div>

      <div className="text-muted flex items-center gap-1.75 font-mono text-[13px] max-md:text-[12px]">
        <span className="bg-line h-1.5 w-1.5 flex-none rounded-full" aria-hidden="true" />
        {formatDateRange(course.startDate, course.nights)}
      </div>

      {/*
        점수 상자. 배경색이 등급을 한 번 더 말해준다 — 배지 글자를 안 읽어도 눈에 들어온다.

        <b>점수가 없는 코스는 등급색을 쓰지 않는다.</b> 여행일이 예측 창 밖이라 아직
        진단되지 않았거나, 밥집만 담아 영영 진단되지 않는 코스다. 아무 등급색이나 입히면
        재보지도 않은 코스에 "붐빔"이나 "한적"을 붙이게 된다.
      */}
      <div
        className={`flex items-center justify-between rounded-[14px] px-3.5 py-3 max-md:rounded-[12px] max-md:px-3 max-md:py-2 ${
          course.level === null ? 'bg-bg text-hint' : LEVEL_TINT[course.level]
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] opacity-70 max-md:text-[10.5px]">예상 한적 지수</span>
          <span className="text-[12px] font-bold max-md:text-[11.5px]">
            {course.levelLabel ?? '아직 진단 전'}
          </span>
          {/*
            그 점수가 <b>몇 곳을 근거로 한 값인지</b> 밝힌다. 카드가 여럿 늘어서는 화면이라
            근거가 얇은 점수와 두꺼운 점수가 같은 크기로 나란히 서면 견줄 수가 없다.

            옛 코스는 모수가 없다(null). 그때는 아무 말도 하지 않는다 —
            0으로 채우면 "근거가 하나도 없는 점수"라는 거짓말이 된다.
          */}
          {course.forecastTargetCount !== null && course.diagnosedCount !== null && (
            <span className="text-[11px] opacity-60 max-md:text-[10.5px]">
              관광지 {course.forecastTargetCount}곳 중 {course.diagnosedCount}곳 기준
            </span>
          )}
        </div>
        <span className="font-mono text-[26px] leading-none font-semibold tracking-[-0.02em] max-md:text-[20px]">
          {/* 0으로 채우지 않는다. 0은 "매우 붐빔"으로 읽혀 없는 것과 뜻이 정반대다 */}
          {course.totalQuietness ?? '—'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-hint text-xs max-md:text-[11px]">
          {formatRelativeTime(course.createdAt)} 저장
        </span>
        <span
          className="text-brand-deep text-[13px] font-semibold max-md:text-[12px]"
          aria-hidden="true"
        >
          상세 보기
        </span>
      </div>
    </div>
  )
}
