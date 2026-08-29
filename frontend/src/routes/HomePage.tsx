import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BrandLockup } from '../components/BrandMark'
import { ChevronRight } from '../components/icons'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { HeaderAuthAction, HeaderNav, MobileMenu } from '../components/Nav'
import { LEVEL_COLOR_VAR, LEVEL_SOLID, LEVEL_TINT } from '../components/levelStyles'
import { PublicCourseSheet } from '../components/PublicCourseSheet'
import { CARD_RAISED } from '../components/styles'
import { DEFAULT_REGION, hasMultipleRegions, nextRegion, regionNameOf } from '../constants/regions'
import { useHomeData } from '../hooks/useHomeData'
import { fetchRecentCourses } from '../services/api'
import type { ForecastDay, HeadlineSpot } from '../hooks/useHomeData'
import type { PublicCourse } from '../types/api'
import { useTrip } from '../state/tripContext'
import {
  daysFromToday,
  formatCompactDate,
  formatKoreanDate,
  formatNights,
  formatWeekday,
  isPastDate,
  today,
} from '../utils/date'

/**
 * 화면 폭.
 *
 * 모바일은 한 줄로 읽고, lg부터 대시보드처럼 좌우로 편다.
 * 680px에서 멈춰 두면 1440px 화면에서 양옆 380px씩이 그냥 빈다.
 */
const SHELL = 'mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-app'

const SECTION_TITLE = 'text-fg m-0 text-[17px] font-bold tracking-[-0.015em]'

/**
 * 벤토 칸 하나.
 *
 * <p>{@code min-w-0}이 핵심이다. 그리드 칸의 기본값은 {@code min-width:auto}라
 * <b>안쪽 내용보다 좁아지지 않는다.</b> 이번 주 섹션의 가로 스크롤 상자가 이 칸에 들어가는데,
 * 그대로 두면 카드 7장(≈820px)만큼 칸이 벌어지고 그만큼이 페이지 가로 스크롤이 된다.
 * 좁은 화면에서 같은 사고를 이미 한 번 겪은 자리다.
 */
const CELL = 'flex min-w-0 flex-col gap-5 lg:gap-4'

/**
 * 고른 날짜로 넘어가는 버튼의 <b>모양</b>. 색은 쓰는 쪽이 붙인다.
 *
 * <p>둘로 나눈 이유: 두 버튼은 크기·높이·비활성 처리가 같아야 하고 <b>면 처리만</b> 다르다
 * (하나는 채움, 하나는 테두리). 각자 전부 적어두면 나중에 한쪽 높이만 고쳐져
 * 나란히 선 두 버튼이 어긋난다.
 *
 * <p>비활성이 되면 <b>둘 다 색이 빠진다</b> — 채움은 회색 면으로, 테두리는 회색 선으로
 * 내려앉는다. 누를 수 없는 상태에서까지 주·보조를 구분해 봐야 고를 것이 없다.
 *
 * <p>{@code disabled:} 값을 여기 함께 둔다. 색을 붙이는 쪽에서 {@code bg-*}를 얹어도
 * 비활성 색이 이기는데, 이는 Tailwind가 변형(disabled:)을 기본 유틸리티보다
 * <b>뒤에</b> 출력하기 때문이다. 순서에 기대는 부분이라 한곳에 모아 둔다.
 */
const DATE_ACTION =
  'min-h-13 w-full cursor-pointer rounded-ui text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:border-line/60 disabled:bg-bg disabled:text-hint'

function HeadlineRow({ spot, last }: { spot: HeadlineSpot; last: boolean }) {
  return (
    <div
      /*
        줄 사이 선은 <b>패널 바탕보다 진해야</b> 한다. 예전에는 border-bg(회백)였는데,
        패널이 흰 카드에서 회백으로 내려오면서 바탕과 같은 색이 되어 통째로 사라졌다.
        묶음을 가르는 선(bg-line)보다는 옅게 둬야 층위가 유지된다.
      */
      className={`flex items-center gap-3 py-2.75 ${last ? '' : 'border-line/60 border-b'}`}
    >
      {/*
        사진과 색점을 함께 둔다.

        사진은 <b>어디인지</b>를, 색점은 <b>얼마나 붐비는지</b>를 말한다. 사진만 두면
        훑을 때 등급이 안 읽히고, 색점만 두면 이름을 모르는 곳이 글자로만 남는다.
        색점을 사진 위에 얹지 않는 이유: 사진이 밝은지 어두운지에 따라 묻는 자리가 생긴다.
      */}
      <PlaceThumbnail
        name={spot.place.name}
        imageUrl={spot.place.imageUrl}
        size="sm"
        className="rounded-[10px]"
      />
      <span
        className={`h-2.25 w-2.25 flex-none rounded-full ${LEVEL_SOLID[spot.level]}`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-fg truncate text-[15px] font-semibold tracking-[-0.01em]">
          {spot.place.name}
        </span>
        <span className="text-hint text-xs">{spot.place.categoryName}</span>
      </div>
      <span
        className={`flex-none rounded-full px-2.75 py-1.25 text-center font-mono text-xs font-semibold ${LEVEL_TINT[spot.level]}`}
      >
        {spot.levelLabel} {spot.quietness}
      </span>
    </div>
  )
}

/**
 * "오늘의 OO" 카드 안의 한 덩이. 붐빔 쪽과 한적 쪽이 같은 모양을 쓴다.
 *
 * <p>소제목을 다는 이유: 줄마다 색점과 배지가 이미 등급을 말하지만, 그건 <b>줄 하나의</b>
 * 등급이다. "이 세 곳이 오늘 가장 붐빈다"는 묶음의 뜻은 제목이 있어야 전해진다.
 *
 * <p>제목 색을 등급색으로 칠하지 않는다. 이 카드에서 색은 3단계 신호이고, 제목은
 * 신호가 아니라 이름표다. 색을 쓰면 "붐빌 것으로 예상"이라는 글자 자체가 배지처럼 읽히고,
 * 줄마다 이미 배지가 하나씩 서 있어 배지 위에 배지가 얹힌다.
 *
 * <p>대신 <b>굵기와 진하기로 세운다.</b> 처음에는 11.5px 흐린 회색이었는데, 안에 담긴
 * 장소 이름(15px 진한 글자)보다 약해서 묶음의 제목으로 읽히지 않았다. 제목이 자기 내용보다
 * 작고 흐리면 그냥 주석처럼 보인다. 크기는 이름보다 작게 두되(목록의 주인공은 장소다)
 * 색과 굵기는 이름과 같은 급으로 올린다.
 *
 * <p>앞에 붙이던 색점은 뺐다. 어느 묶음인지는 <b>두 덩이를 가르는 선</b>과 제목 글자가
 * 이미 말하고 있어서, 점은 신호를 하나 더 얹는 대신 줄 시작을 들쭉날쭉하게 만들었다 —
 * 제목만 점 하나만큼 오른쪽으로 밀려 아래 장소 이름들과 왼쪽 끝이 어긋났다.
 */
function HeadlineGroup({
  label,
  spots,
  className = '',
  labelHidden = false,
}: {
  label: string
  spots: HeadlineSpot[]
  /** 카드 안에서 이 덩이가 차지할 자리. 넓은 화면에서 절반씩 나눠 갖는 데 쓴다 */
  className?: string
  /**
   * 소제목을 눈에서만 감춘다. 좁은 화면에서는 바로 위 스위치가 같은 말을 하고 있어,
   * 그대로 두면 "붐빌 것으로 예상"이 두 줄 연속으로 선다.
   *
   * <b>지우지 않고 감추는</b> 이유: 화면 낭독기에게는 이 묶음이 무엇인지 여전히 필요하다.
   */
  labelHidden?: boolean
}) {
  if (spots.length === 0) {
    return null
  }
  return (
    <div className={`flex flex-col ${className}`}>
      <span
        className={
          labelHidden
            ? 'sr-only'
            : 'text-fg px-0.5 pb-1.5 text-[13px] font-bold tracking-[-0.01em]'
        }
      >
        {label}
      </span>
      {spots.map((spot, index) => (
        <HeadlineRow key={spot.place.id} spot={spot} last={index === spots.length - 1} />
      ))}
    </div>
  )
}

/**
 * 좁은 화면의 하루 한 줄. <b>요일·날짜와 점수만</b> 세운다.
 *
 * <h3>가로로 미는 카드를 걷어낸 이유 (2026-08-25)</h3>
 * 예전에는 7일을 세로 막대 카드로 만들어 <b>옆으로 미는 띠</b>에 담았다.
 * 그런데 그 띠가 화면에 하나뿐인 가로 스크롤 상자였고, <b>휴대폰에서 페이지가 옆으로
 * 밀리는 원인</b>이었다 — 띠를 잡고 민 제스처가 더 갈 곳이 없으면 문서로 이어진다.
 *
 * <p>진단 도구로 재 보니 화면 밖으로 <b>안 잘리고</b> 삐져나온 요소는 하나도 없었는데도
 * 실물에서는 계속 밀렸다. 넘치는 요소를 찾는 방향이 처음부터 틀렸던 것이고,
 * 범인은 "넘친 것"이 아니라 "미는 것"이었다.
 *
 * <p>세로로 쌓으면 미는 상자 자체가 사라진다. 7일이 한 화면에 들어가는 것은 덤이고,
 * 옆으로 밀어야 나머지가 보이던 예전 띠보다 오히려 한눈에 읽힌다.
 *
 * <h3>막대를 뺀 이유</h3>
 * 좁은 화면에서 막대까지 넣으면 한 줄에 요일·날짜·막대·점수·배지가 다 들어가 빽빽해진다.
 * 여기서 필요한 것은 "어느 날이 나은가"이고 그건 <b>숫자와 배지</b>가 이미 말한다.
 * 막대는 자리가 넉넉한 넓은 화면({@link ForecastRow})이 맡는다.
 */
function ForecastCompactRow({
  day,
  selected,
  onSelect,
}: {
  day: ForecastDay
  selected: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-left transition-colors ${
        selected ? 'bg-quiet-tint ring-quiet-soft ring-1' : 'hover:bg-fill'
      }`}
    >
      {/* 주말은 색으로 구분한다 — 붐빌 확률이 높은 날을 훑을 때 먼저 눈에 들어와야 한다 */}
      <span
        className={`w-4 flex-none text-[13px] font-semibold ${
          weekday === '일' ? 'text-crowded' : weekday === '토' ? 'text-quiet' : 'text-hint'
        }`}
      >
        {weekday}
      </span>
      <span className="text-fg flex-none font-mono text-[14px] font-semibold tracking-[-0.01em]">
        {formatCompactDate(day.date)}
      </span>

      {/*
        점수 막대. 남는 폭을 전부 가져간다 — 날짜·점수·배지가 폭이 정해진 덩이라
        여기만 flex-1로 두면 화면이 넓어질수록 막대가 길어져 날짜별 차이가 더 잘 보인다.

        숫자를 막대 <b>안</b>에 넣지 않았다. 넓은 화면 줄({@link ForecastRow})은 그렇게 하지만
        거기는 막대가 400px쯤이라 짧은 막대도 두 자리를 담는다. 좁은 화면에서는 140px 남짓이라
        점수가 낮은 날은 채운 부분이 20px도 안 돼 숫자가 잘린다.

        빈 부분은 흰색이다. 패널이 회백이라 예전 회백 트랙은 바탕에 묻힌다.
      */}
      <div className="bg-surface h-5 min-w-0 flex-1 overflow-hidden rounded-[6px]">
        <div
          className="h-full rounded-[6px]"
          style={{
            // 0점인 날도 막대가 보여야 "값이 없다"로 오해되지 않는다.
            width: `${Math.max(8, day.quietness)}%`,
            background: LEVEL_COLOR_VAR[day.level],
          }}
        />
      </div>

      {/* 점수와 배지를 오른쪽에 나란히. 세로로 훑을 때 숫자 열이 한 줄로 맞는다 */}
      <span
        className={`flex-none font-mono text-[16px] font-semibold tracking-[-0.02em] ${
          day.level === 'QUIET'
            ? 'text-quiet-deep'
            : day.level === 'MODERATE'
              ? 'text-moderate-deep'
              : 'text-crowded-deep'
        }`}
      >
        {day.quietness}
      </span>
      <span
        className={`w-11 flex-none rounded-full py-0.75 text-center text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
      >
        {day.levelLabel}
      </span>
    </button>
  )
}

/**
 * 넓은 화면의 하루 한 줄.
 *
 * <p>같은 7일을 <b>가로 막대</b>로 눕힌다. 세로 막대 카드({@link ForecastCard})를 그대로
 * 넓은 칸에 늘리면 카드 하나가 지나치게 커지고, 막대 높이는 그대로라 날짜별 차이가
 * 오히려 안 보인다. 가로로 눕히면 길이 차이가 한눈에 읽히고, 세로로 쌓아도
 * 7일이 한 화면에 들어간다.
 *
 * <p>모바일과 나눠 그리는 이유: 하나의 마크업으로 두 방향을 다 만들려면 막대의
 * 축(height ↔ width)이 반대라 스타일이 조건문 범벅이 된다. 읽을 수 있는 쪽을 택했다.
 */
function ForecastRow({
  day,
  selected,
  onSelect,
}: {
  day: ForecastDay
  /** 사용자가 고른 날. 가장 한적한 날과는 무관하다 */
  selected: boolean
  onSelect: () => void
}) {
  const weekday = formatWeekday(day.date).charAt(0)

  return (
    /*
      줄 하나가 곧 고르는 버튼이다. 누르면 <b>선택될 뿐</b> 화면을 옮기지 않는다.
      이동은 아래 "코스 짜기" 버튼이 맡는다 — 목록에서 날짜를 견줘 보는 동안
      실수로 눌러 화면이 넘어가면 비교하던 것이 사라진다.

      강조는 "선택됨" 하나뿐이다. 가장 한적한 날에도 색을 깔면 "이 줄이 특별하다"는
      신호가 둘이 되어, 어느 것이 내가 고른 것인지 흐려진다. 그건 머리글 문구가 맡는다.
    */
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${
        selected ? 'bg-quiet-tint ring-quiet-soft ring-1' : 'hover:bg-fill'
      }`}
    >
      <div className="flex w-13 flex-none items-baseline gap-1.25">
        <span className="text-fg font-mono text-[13px] font-semibold">
          {formatCompactDate(day.date)}
        </span>
        <span
          className={`text-[11px] font-semibold ${
            weekday === '일' ? 'text-crowded' : weekday === '토' ? 'text-quiet' : 'text-hint'
          }`}
        >
          {weekday}
        </span>
      </div>

      {/* 막대는 왼쪽에서 자란다. 길수록(한적할수록) 멀리 뻗는다 */}
      <div className="bg-surface h-6 min-w-0 flex-1 overflow-hidden rounded-[7px]">
        <div
          className="flex h-full items-center justify-end rounded-[7px] pr-2"
          style={{
            // 0점인 날도 막대가 보여야 "값이 없다"로 오해되지 않는다.
            width: `${Math.max(14, day.quietness)}%`,
            background: LEVEL_COLOR_VAR[day.level],
          }}
        >
          <span className="font-mono text-[11.5px] font-semibold text-white">
            {day.quietness}
          </span>
        </div>
      </div>

      {/* 배지는 늘 등급만 말한다. "가장 한적"은 머리글 문구가 맡는다 */}
      <span
        className={`w-11 flex-none rounded-full py-0.75 text-center text-[11px] font-semibold ${LEVEL_TINT[day.level]}`}
      >
        {day.levelLabel}
      </span>
    </button>
  )
}

/**
 * 지역을 넘기는 간격.
 *
 * 홈은 훑어보는 화면이라 한 지역을 읽을 만큼은 머물러야 한다. 너무 짧으면 읽는 중에
 * 바뀌어 성가시고, 너무 길면 다른 지역이 있다는 사실 자체가 전해지지 않는다.
 */
const REGION_ROTATE_MS = 14000

/**
 * 사라지고 나타나는 데 걸리는 시간.
 *
 * <p>한 번 넘어가는 데 이 값의 두 배가 든다(사라짐 + 나타남). 460ms씩이면 거의 1초인데,
 * 14초에 한 번 있는 일이라 길어도 성가시지 않다. 오히려 <b>짧으면 깜빡인 것처럼 보여</b>
 * 무엇이 바뀌었는지 눈이 따라가지 못한다.
 */
const REGION_FADE_MS = 460

/** 다른 사람들의 여행 카드 수. 한 열에 담기는 만큼만 */
const OTHER_COURSE_COUNT = 4

/**
 * 남의 코스를 베껴 올 때, 그 날짜가 이미 지났으면 며칠 뒤로 잡을지.
 *
 * <p>조건 화면({@code PlanPage})의 기본값과 같은 값이다. 새 여행을 시작하는 자리마다
 * 다른 날을 내밀면 사용자가 "이 서비스의 기본 날짜"를 배우지 못한다.
 */
const COPIED_COURSE_DAYS_AHEAD = 7

/**
 * "오늘의 OO"의 두 덩이. 좁은 화면에서는 이 둘을 스위치로 오간다.
 *
 * <p>라벨을 여기 한 번만 적는다 — 스위치 글자와 넓은 화면의 소제목이 같은 말이어야
 * "지금 보고 있는 것"이 화면을 옮겨도 이어진다.
 */
const HEADLINE_TABS = [
  { key: 'crowded', label: '붐빌 것으로 예상' },
  { key: 'quiet', label: '한적할 것으로 예상' },
] as const

type HeadlineTab = (typeof HEADLINE_TABS)[number]['key']

/** 카드에 맛보기로 보이는 장소 수. 나머지는 눌러서 펼쳤을 때 나온다 */
const PREVIEW_PLACES = 3

/**
 * 다른 사람이 저장한 코스 한 장. <b>눌러서 펼쳐 본다.</b>
 *
 * <p>예전에는 누를 수 없었다. 서버가 코스 id를 주지 않아서인데, 이제는 <b>id 없이</b>
 * 목록 응답이 장소를 전부 들고 온다 — 열어 보는 데 필요한 것이 이미 손에 있으므로
 * 남의 코스에 주소를 주지 않고도 펼칠 수 있다. 그래서 누를 때 서버를 다시 부르지 않는다.
 *
 * <p>제목은 <b>저장한 사람이 붙인 이름</b>이다. 지역과 기간만 세웠더니 어느 카드나
 * "경주 1박 2일"이라 서로 구분되지 않았다 — 이름이 있어야 남의 여행이 남의 여행답게 읽힌다.
 * 지역·기간은 그 아래 줄로 내렸다.
 *
 * <p>흰 카드가 아니라 <b>바탕색으로 눌러 담은 칸</b>이다. 이 카드가 흰 박스 안에 들어가서,
 * 흰 면 위에 흰 카드를 얹으면 그림자로만 갈려 층이 흐릿해진다.
 *
 * <p>펼쳤을 때({@code PublicCourseSheet})와 <b>같은 것을 같은 모양으로</b> 보여준다 —
 * 제목 한 줄과 동그라미 한적 지수. 예전에는 숫자만 든 작은 알약 하나였는데, 카드가
 * 휑해 보이는 데다 그 숫자가 무엇인지 카드 안에서 설명되지 않았다. 게이지는 차 있는
 * 만큼이 곧 점수라 숫자를 읽지 않아도 대강이 들어온다.
 */
function OtherCourseCard({ course, onOpen }: { course: PublicCourse; onOpen: () => void }) {
  const preview = course.places.slice(0, PREVIEW_PLACES)
  // "경상북도 경주시" → "경주시". 좁은 카드라 앞쪽 도명까지는 들어가지 않는다.
  const shortRegion = course.regionName.replace(/^.*\s/, '')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group bg-bg hover:bg-fill flex w-full cursor-pointer flex-col gap-2.5 rounded-[16px] border-none p-3.5 text-left transition-colors"
    >
      <div className="flex w-full items-center gap-3">
        {/*
          동그라미 한적 지수. 겹창·시트와 같은 원형 게이지를 작게 줄인 것이다 —
          같은 값이 화면마다 다른 모양으로 나오면 같은 값으로 읽히지 않는다.

          색은 CSS 변수로 넘긴다. 값이 실행 중에 정해져 클래스로 만들 수 없지만,
          색 정의는 여전히 index.css 한 곳에만 남는다.
        */}
        <div
          // p-1이 곧 고리의 두께다(52px 원에 4px). 시트의 92px/8px과 같은 비율이라 같은 물건으로 보인다
          className="grid h-13 w-13 flex-none place-items-center rounded-full p-1"
          style={{
            background: `conic-gradient(${LEVEL_COLOR_VAR[course.level]} ${course.totalQuietness}%, var(--c-line) 0)`,
          }}
        >
          {/*
            가운데를 뚫는 원. <b>카드와 같은 색이어야</b> 도넛으로 보인다.
            카드가 hover에서 색이 바뀌므로 이쪽도 group-hover로 따라간다 —
            안 따라가면 손을 올린 순간 가운데만 옛 색으로 남아 동그라미가 두 겹이 된다.
          */}
          <div className="bg-bg group-hover:bg-fill grid h-full w-full place-items-center rounded-full transition-colors">
            <span className="text-fg font-mono text-[15px] leading-none font-semibold">
              {course.totalQuietness}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-fg min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">
              {course.name}
            </span>
            {/* 한적도는 어디서나 3단계 배지로 말한다. 게이지는 정도를, 배지는 등급을 맡는다 */}
            <span
              className={`flex-none rounded-full px-2 py-0.75 text-[11px] font-semibold ${LEVEL_TINT[course.level]}`}
            >
              {course.levelLabel}
            </span>
          </div>
          <span className="text-hint truncate text-[12px]">
            {shortRegion} {formatNights(course.nights)} · {formatCompactDate(course.startDate)} 출발
          </span>
        </div>
      </div>

      {/* 담긴 순서대로 앞쪽 몇 곳. 코스 전체가 아니라는 뜻으로 말줄임을 붙인다 */}
      {preview.length > 0 && (
        <p className="text-muted m-0 w-full truncate text-[12.5px]">
          {preview.map((place) => place.name).join(' · ')}
          {course.places.length > preview.length ? ' …' : ''}
        </p>
      )}
    </button>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  // 남의 코스를 내 편집 흐름에 담을 때만 쓴다.
  const { restore } = useTrip()
  /*
   * 지금 보고 있는 지역.
   *
   * 상수가 아니라 상태로 둔다. 지역이 늘면 이 값만 갈아끼우면 아래 화면 전체가 따라온다 —
   * "오늘의 OO", 붐빔·한적 목록, 주간 예보가 전부 이 값에서 나온다.
   *
   * 일정 시간마다 넘기려면 nextRegion(regionSlug)로 이 값을 바꾸는 타이머만 걸면 된다.
   * 지역이 하나뿐인 지금은 nextRegion이 자기 자신을 돌려주므로 걸어도 아무 일이 없다.
   */
  const [regionSlug, setRegionSlug] = useState(DEFAULT_REGION)

  /*
   * 일정 시간마다 다음 지역으로 넘긴다.
   *
   * 지역이 하나뿐이면 타이머를 아예 걸지 않는다 — nextRegion이 자기 자신을 돌려주므로
   * 걸어도 화면은 그대로지만, 30초마다 의미 없이 다시 그릴 이유가 없다.
   *
   * ⚠️ 지역이 늘면 이 자리에 "멈춤" 수단이 필요하다. 읽는 중에 내용이 저절로 바뀌는 것은
   * 접근성 지침이 막는 동작이다(WCAG 2.2.2). 화살표나 점 표시로 직접 넘길 수 있게 하고,
   * 사용자가 손대면 자동 넘김을 멈추는 편이 맞다.
   */
  /**
   * 지금 이 영역을 <b>보고 있는가.</b> 보고 있는 동안에는 넘기지 않는다.
   *
   * <h3>고르는 버튼 대신 이렇게 한 이유</h3>
   * 읽는 중에 내용이 저절로 바뀌면 따라 읽을 수 없고, 멈출 방법이 없으면 그 화면을
   * 쓸 수 없는 사람이 생긴다(WCAG 2.2.2). 그렇다고 지역을 고르는 버튼을 세우면
   * 홈이 "둘러보는 화면"에서 "고르는 화면"이 된다 — 고르는 자리는 코스 짜기에 이미 있다.
   *
   * <p>손이 올라가 있거나 키보드 초점이 그 안에 있으면 읽는 중이다. 그때만 멈춘다.
   * 사용자가 아무것도 배우지 않아도 되고, 손을 떼면 알아서 다시 돈다.
   *
   * <p>상태가 아니라 ref인 이유는 아래 타이머 주석에 적어 두었다 — 요약하면,
   * 이 값이 바뀔 때마다 다시 그리면 타이머가 되감겨 간격이 제멋대로가 된다.
   */
  const reading = useRef(false)

  /**
   * 다음 지역으로 넘어가도 되는가. <b>아니면 이번 차례를 건너뛴다.</b>
   *
   * <p>{@link useHomeData}가 지금 지역을 그리는 동안 다음 지역을 미리 받아 두므로 대개 참이다.
   * 첫 화면이 느리게 열렸을 때처럼 아직 안 왔으면 넘기지 않고 14초를 더 기다린다 —
   * 넘겨봐야 사라졌다 나타난 자리에 스켈레톤이 서고, 그게 없애려던 공백이다.
   *
   * <p>{@link reading}과 같은 이유로 상태가 아니라 ref다. 상태로 두고 effect 의존성에 넣으면
   * 값이 바뀔 때마다 타이머가 되감겨 간격이 제멋대로가 된다.
   */
  const canAdvanceRef = useRef(false)

  /**
   * 지금 사라지는 중인가.
   *
   * <p><b>박스가 아니라 안에 든 묶음들</b>이 이 값을 따른다({@code .region-fade}).
   * 카드에 직접 걸었더니 테두리·그림자·바탕까지 함께 없어져 화면에 구멍이 뚫렸다.
   * 날짜로 넘어가는 버튼 둘은 여기서도 빠진다 — 행동하는 자리는 붙박이여야 한다.
   */
  const [fading, setFading] = useState(false)

  /** 사라짐이 끝나면 내용을 갈 시계. 화면을 떠날 때 거두려고 들고 있는다 */
  const swapTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!hasMultipleRegions()) {
      return
    }
    /*
     * 타이머는 <b>한 번만</b> 건다. 읽는 중이면 이번 차례를 건너뛸 뿐 시계는 계속 간다.
     *
     * 예전에는 "읽는 중"을 상태로 두고 그것을 effect 의존성에 넣었다. 그러면 값이 바뀔
     * 때마다 타이머를 걷고 새로 걸어 <b>8초 카운트가 처음부터 다시 시작됐다.</b>
     * 그것만으로도 간격이 흔들렸는데, 지역이 바뀔 때 칸이 새로 만들어지는 것과 겹쳐
     * 더 나빠졌다 — 마우스가 그 위에 있으면 칸이 사라지고 생기면서 mouseleave와
     * mouseenter가 잇달아 튀고, 그때마다 타이머가 되감겼다.
     * 그래서 3초 만에 넘어가기도 하고 15초가 걸리기도 했다.
     *
     * ref는 바뀌어도 다시 그리지 않으므로 이 effect가 다시 돌지 않는다. 시계가 하나뿐이니
     * 간격은 언제나 정확히 REGION_ROTATE_MS다.
     */
    const timer = setInterval(() => {
      if (reading.current) {
        return
      }
      /*
       * 받아 둔 것이 없으면 넘기지 않는다. 시계는 계속 가므로 준비되는 대로
       * 다음 차례에 넘어간다 — 읽는 중일 때 건너뛰는 것과 같은 방식이다.
       */
      if (!canAdvanceRef.current) {
        return
      }
      /*
       * 먼저 사라지고, 다 사라진 뒤에 내용을 갈고, 다시 나타난다.
       *
       * 지역을 곧바로 갈면 <b>글자가 제자리에서 바뀌어</b> 깜빡인 것처럼 보인다.
       * 사이를 비워야 "다른 지역으로 넘어갔다"로 읽힌다.
       */
      setFading(true)
      swapTimer.current = window.setTimeout(() => {
        setRegionSlug(nextRegion)
        setFading(false)
      }, REGION_FADE_MS)
    }, REGION_ROTATE_MS)

    return () => {
      clearInterval(timer)
      // 사라지는 도중에 화면을 떠나면 남은 시계도 함께 거둔다.
      if (swapTimer.current !== undefined) {
        window.clearTimeout(swapTimer.current)
      }
    }
  }, [])

  /**
   * 넘어가는 세 칸에 함께 붙인다.
   *
   * <p>{@code key}는 여기 담지 않고 각 칸에 직접 적는다 — React는 key를 spread로 받으면
   * 경고한다. key에 지역 슬러그를 넣는 이유: 지역이 바뀌면 React가 그 칸을 새로 만들고,
   * 그 순간 CSS 애니메이션이 처음부터 다시 돈다. 상태로 "지금 넘어가는 중"을 들고 있지
   * 않아도 된다.
   *
   * <p>⚠️ <b>칸마다 앞에 이름을 붙여야 한다</b>({@code crowded-} · {@code quiet-} · {@code week-}).
   * 세 칸은 한 부모의 형제인데 key를 슬러그 하나로 두면 셋이 같은 key를 갖는다.
   * 그러면 React가 어느 칸이 어느 칸인지 못 가려, 바뀌는 대신 <b>아래에 새로 쌓인다.</b>
   *
   * <p>Capture를 쓰는 이유: 초점은 칸 안쪽 어느 요소에나 들어갈 수 있는데,
   * 일반 onFocus는 자식에서 올라오는 것을 놓치는 경우가 있다.
   */
  const rotating = {
    onMouseEnter: () => {
      reading.current = true
    },
    onMouseLeave: () => {
      reading.current = false
    },
    onFocusCapture: () => {
      reading.current = true
    },
    onBlurCapture: () => {
      reading.current = false
    },
  }

  /*
   * 지금 지역과 <b>다음 지역을 함께</b> 받는다. 넘어가는 순간 데이터가 이미 있어야
   * 사라졌다 나타난 자리가 비지 않는다.
   */
  const { state, canAdvance } = useHomeData(regionSlug)

  // 타이머는 ref만 읽는다. 상태를 의존성에 넣으면 값이 바뀔 때마다 시계가 되감긴다.
  useEffect(() => {
    canAdvanceRef.current = canAdvance
  }, [canAdvance])

  /**
   * 다른 사람들이 최근에 저장한 코스.
   *
   * <p><b>지역과 무관하다.</b> 왼쪽 두 칸은 8초마다 지역이 넘어가지만 이 칸은 그대로 선다 —
   * "다른 사람들은 어디로 갔나"에 지역을 걸면 볼 수 있는 여행이 3분의 1로 줄고,
   * 지금은 저장된 코스 자체가 많지 않다.
   *
   * <p>실패해도 홈은 그대로 그린다. 곁들이는 정보라 이것 때문에 화면을 막을 이유가 없다.
   */
  const [others, setOthers] = useState<PublicCourse[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetchRecentCourses(OTHER_COURSE_COUNT, controller.signal)
      .then(setOthers)
      .catch(() => setOthers([]))
    return () => controller.abort()
  }, [])

  /**
   * 펼쳐 보고 있는 남의 코스. <b>id가 아니라 객체를 들고 있다.</b>
   *
   * <p>마이페이지는 코스 번호를 들고 있다가 열 때 서버에 다시 묻는다. 남의 코스에는
   * 번호가 없고(그 통로를 열지 않으려고 응답에서 뺐다) 대신 목록이 내용을 이미 들고 왔으므로,
   * 여는 순간 부를 것이 없다.
   */
  const [openedCourse, setOpenedCourse] = useState<PublicCourse | null>(null)

  /**
   * 남의 코스를 그대로 내 편집 화면에 담는다.
   *
   * <p><b>진단 화면이 아니라 편집 화면으로 간다.</b> 마이페이지의 "수정하기"는 내가 짠
   * 코스를 그대로 다시 진단하는 것이지만, 여기는 남의 일정을 베껴 오는 것이라 대개
   * 날짜부터 갈아야 한다. 담긴 채로 편집 화면에 서면 무엇을 고칠지 바로 보인다.
   *
   * <p>날짜가 지났으면 새로 잡는다. 지난 날짜로 담으면 예측 범위 밖이라
   * 진단이 통째로 비어 나오고, 사용자는 그것을 고장으로 읽는다.
   */
  function copyToFlow(course: PublicCourse) {
    const days: string[][] = Array.from({ length: course.days }, () => [])
    course.places.forEach((place) => {
      days[place.day - 1]?.push(place.placeId)
    })

    restore(
      {
        region: course.region,
        startDate: isPastDate(course.startDate)
          ? daysFromToday(COPIED_COURSE_DAYS_AHEAD)
          : course.startDate,
        nights: course.nights,
      },
      days,
    )
    setOpenedCourse(null)
    navigate('/course')
  }
  const regionName = regionNameOf(regionSlug)
  const data = state.phase === 'loaded' ? state.data : null

  /**
   * 좁은 화면에서 "오늘의 OO"의 어느 쪽을 보고 있는가.
   *
   * <p>기본값이 붐빔인 이유: 이 서비스는 <b>피할 곳을 먼저 알려주고</b> 대안을 내미는
   * 순서로 말한다. 한적한 곳부터 보여주면 "그래서 어디가 문제인데"가 뒤에 온다.
   *
   * <p>넓은 화면에서는 둘 다 보이므로 이 값이 쓰이지 않는다.
   */
  const [headlineTab, setHeadlineTab] = useState<HeadlineTab>('crowded')

  /**
   * 지금 선택된 날짜. <b>사용자가 누르기 전에는 없다.</b>
   *
   * <h3>⚠️ 가장 한적한 날을 미리 골라두지 않는다</h3>
   * 예전에는 {@code pickedDate ?? data?.bestDay.date}였다. 목록에 이미 한 줄이 켜져 있고
   * 버튼에도 그 날짜가 적혀 있으니, 사용자는 <b>화면이 정한 값을 자기가 고른 것으로 착각한 채</b>
   * 넘어갔다. 어느 날로 코스를 짜는지 모르는 채 다음 화면에 도착한다.
   *
   * <p>가장 한적한 날은 <b>위 문구가 이미 말하고 있다</b>("9/3 목이 가장 한적해요").
   * 알려주는 것과 대신 골라주는 것은 다르다 — 알려주고 고르는 일은 사용자에게 남긴다.
   *
   * <p>그래서 이제 상태 하나가 그대로 답이다. 파생값으로 감쌀 것이 없어졌다.
   * (effect로 값을 밀어넣지 않는 이유는 그대로다 — 첫 렌더에 빈 상태가 그려졌다가
   * 값이 들어오며 화면이 튄다.)
   *
   * <p>널일 때 두 버튼이 잠긴다. 갈 날짜가 없는데 눌리면 갈 곳 없는 화면으로 넘어간다.
   */
  const [activeDate, setActiveDate] = useState<string | null>(null)

  return (
    // 아래 고정 막대를 걷어내면서 그것을 피하려던 여백(pb-26)도 함께 뺐다.
    <div className="flex min-h-svh flex-col pb-10">
      {/*
        1. 상단 — 공용 헤더(Layout)와 <b>같은 모양의 고정 막대</b>다.

        원래 홈만 배경 위에 뜬 자기 머리글을 썼는데, 흰 막대·경계선·sticky가 없어
        "헤더가 없는 화면"으로 읽혔고 스크롤하면 이동 수단이 사라졌다.
        제품형 서비스는 어느 화면이든 같은 헤더 하나가 따라다니는 것이 표준이다 —
        홈만 다른 문법을 쓰면 화면을 오가는 사람이 매번 다시 배운다.

        Layout 안으로 넣지 않고 모양만 맞춘 이유: 홈 본문은 자기 폭 체계(SHELL)와
        가장자리 여백을 쓰고 있어, Layout의 본문 패딩이 겹으로 얹히면 전부 다시 만져야 한다.
        대신 이 막대의 클래스는 Layout 헤더와 같은 값을 쓴다 — 다르게 보이면 고친 의미가 없다.
      */}
      <header className="bg-surface border-line sticky top-0 z-10 h-14 border-b">
        {/*
          안쪽 폭은 SHELL(본문용 단계 폭)이 아니라 Layout 헤더와 <b>같은 max-w-app</b>이다.
          SHELL을 쓰면 중간 폭 화면에서 로고·메뉴가 본문 폭에 맞춰 안쪽으로 몰렸다가,
          다른 화면으로 넘어가는 순간 Layout 헤더 자리로 퍼진다 — 헤더는 화면이 바뀌어도
          픽셀 하나 안 움직여야 같은 헤더로 읽힌다.
        */}
        <div className="max-w-app mx-auto flex h-full items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {/*
              홈에서도 로고를 링크로 둔다. 이미 홈이라 눌러도 화면은 그대로지만,
              <b>다른 화면과 같은 것으로 보여야</b> 한다 — 어떤 화면에서는 손가락 커서가 뜨고
              어떤 화면에서는 안 뜨면, 사용자는 로고가 링크인지 아닌지를 매번 시험하게 된다.
              누를 수 있게 생긴 것은 어디서나 누를 수 있어야 한다.
            */}
            <Link to="/" className="flex-none no-underline" aria-label="PEAK OFF 처음으로">
              <BrandLockup />
            </Link>
            <HeaderNav />
          </div>

          {/*
            헤더 오른쪽 끝. 좁은 화면에서는 <b>메뉴 토글</b>이 여기 서고, 그 왼쪽에
            계정 버튼(로그인/로그아웃)이 붙는다. md부터는 토글이 숨고 HeaderNav가 대신한다.

            로그인한 뒤에도 닉네임은 두지 않는다. 마이페이지로 가는 길은 이미 이동 메뉴에
            있어서, 닉네임까지 링크로 두면 같은 곳으로 가는 문이 나란히 두 개가 된다.
            누구로 로그인했는지는 마이페이지가 보여준다.

            -mr-2는 묶음에 준다. 그래야 좁은 화면에서는 토글이, 넓은 화면에서는
            계정 버튼이 각각 헤더 가장자리에 붙는다.
          */}
          <div className="-mr-2 flex flex-none items-center gap-1 self-stretch">
            <HeaderAuthAction />
            <MobileMenu />
          </div>
        </div>
      </header>

      {/*
        벤토 그리드.

        모바일은 지금까지처럼 한 줄로 쌓이고(flex-col), lg부터 12칸 그리드로 편다.

        <b>첫 줄은 들어가는 문 둘이 반씩 나눠 갖는다(6+6).</b> 직접 짜기와 추천받기는
        같은 비중의 주요 기능이라 크기도 같아야 한다. 한쪽을 작게 두면 사용자가
        "이건 곁다리"라고 배우고, 나중에 크기를 키울 때 그 학습을 되돌려야 한다.

        둘째 줄은 데이터다. <b>지역이 넘어갈 때 함께 바뀌는 두 칸</b>이고,
        오늘 하루(장소)와 이번 주(날짜)가 나란히 선다 — 혼잡을 피하는 두 경로가
        한 줄에서 짝을 이룬다.

        "지금 한적한 곳"은 걷어냈다. 위 카드의 "한적할 것으로 예상"과 <b>같은 목록에서
        앞의 세 곳만 빼고</b> 그 다음을 보여주고 있었는데, 제목은 "가장 덜 붐빌 곳"이었다.
        정작 가장 한적한 곳이 그 목록에 없었다.

        배치는 전부 자동이다. row-span을 쓰지 않아 DOM 순서가 곧 화면 순서이고,
        좁은 화면에서 순서를 되돌리는 장치(order)도 필요 없어졌다.

          ┌───────────────┬───────────────┐
          │ 코스 짜기      │ 코스 발견하기  │
          ├───────┬───────┴──┬────────────┤
          │ 오늘의 │ 이번 주   │ 다른 사람들 │
          │ 경주   │ 한적한 날 │ 의 여행     │
          └───────┴──────────┴────────────┘
             ← 지역 따라 바뀜 →   ← 지역 무관 →
      */}
      {/*
        위·좌우 여백은 Layout 본문(pt-6/lg:pt-8, px-4.5/md:px-6/lg:px-8)과 같은 값이다.
        홈만 다르면 코스짜기 등 다른 화면으로 넘어갈 때마다 내용 시작점이 위아래로 튄다.
      */}
      <div className={`${SHELL} px-4.5 pt-6 md:px-6 lg:px-8 lg:pt-8`}>
        <div className="flex flex-col gap-7.5 lg:grid lg:grid-cols-12 lg:gap-4">
          {/* 2. 진입점 ① 직접 짜기 — 이 서비스의 원래 흐름 */}
          <div className={`${CELL} lg:col-span-6`}>
            {/*
              lg:flex-1 — 그리드 칸은 줄 높이만큼 늘어나므로, 버튼이 남는 높이를 채워
              옆 칸과 아랫변이 맞는다. 이게 없으면 큰 칸 아래에만 빈 공간이 남는다.
            */}
            {/*
              카드는 <b>누르는 것이 아니다.</b> 예전에는 카드 전체가 button이라 어디를 눌러도
              넘어갔는데, 그러면 안에 든 "시작하기"가 장식으로 전락한다 — 사용자는 무엇이
              버튼인지 배우지 못하고, 카드 안에 다른 링크를 하나라도 넣는 순간 중첩이 된다.
              들어가는 문은 아래 링크 하나다.

              hover는 카드를 살짝 띄우되 <b>커서는 바꾸지 않는다.</b> 카드가 손가락 커서를
              달고 있으면 "여기도 눌리는데?"가 되어 방금 없앤 혼란이 되돌아온다.
              대신 같은 hover에서 CTA가 함께 반응해 눌러야 할 곳을 가리킨다.
            */}
            <div className="group bg-fg relative w-full overflow-hidden rounded-[24px] px-6 pt-6.5 pb-6 text-left text-white shadow-[0_8px_26px_rgb(42_62_84/0.18)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgb(42_62_84/0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
          {/*
            장식 원을 잘라내는 층.

            원이 카드 오른쪽으로 40px 삐져나가는데, 열(max-w-430)이 가운데 정렬이라
            화면이 510px보다 넓으면 양옆 여백에 묻힌다. 그보다 좁아지는 순간 화면 밖으로
            나가 페이지 전체에 가로 스크롤이 생긴다.

            모서리는 카드와 같은 값으로 깎아야 둥근 부분 밖으로 색이 비치지 않는다.
          */}
          <span
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
            aria-hidden="true"
          >
            {/*
              글로우 두 개가 서비스의 서사다 — 위는 틸(브랜드·행동이자 한적한 방향), 아래는 핑크(붐빔).
              어두운 네이비 면마다 이 두 기운을 마주 놓아 "붐빔에서 한적으로"라는 방향을
              장식에도 배게 한다. 로그인 패널·결과 히어로와 같은 문법이다.
              알파를 낮게 두는 이유: 진하게 깔면 어두운 면 위에서 탁해진다.
            */}
            <span className="absolute -top-14.5 -right-14 h-50 w-50 rounded-full bg-[rgb(63_193_201/0.14)]" />
            <span className="absolute -bottom-23 right-6 h-37.5 w-37.5 rounded-full bg-[rgb(252_81_133/0.09)]" />
          </span>
          <span className="relative flex flex-col gap-3">
            {/*
              킥커는 브랜드 틸이다. 다른 색을 쓰면 카드의 색 기운이 둘로 갈린다.
              "brand는 배경 전용" 규칙은 흰 카드 위의 2.2:1 때문인데, 여기는 어두운 잉크 위라
              5.1:1로 넉넉하다 — 규칙의 이유가 사라지는 유일한 자리다.
            */}
            <span className="text-brand text-[11.5px] font-semibold tracking-[0.1em]">
              PLAN MY TRIP
            </span>
            {/*
              ■ 제목은 <b>서비스가 하는 일</b>이고, 사용자의 상황은 본문이 맡는다

              제목을 상황으로 두려고 세 번 고쳤다 — "내가 고른 여행"(시제가 틀렸다),
              "가고 싶은 곳이 있어요"(필요한 것을 적게 말했다), "이미 계획이 있어요"
              (날짜만 정한 사람이 잘못 들어온다). 고칠 때마다 <b>새로운 예외가 나왔다.</b>

              <p>원인이 문구가 아니라 <b>방식</b>에 있었다. 상황 제목은 "당신은 이런
              상태다"라고 <b>단언</b>하는 말이라, 어떻게 짜도 그 단언에 안 맞는 사람이 남는다.
              경우의 수를 다 막으려 하면 제목이 길어지고, 길어진 제목은 훑어지지 않는다.

              <p>행동 이름은 그럴 수 없다. "코스 짜기"는 <b>버튼을 누르면 벌어지는 일</b>이라
              누가 읽든 참이다. 대신 길 안내를 못 하므로, 그 일은 본문이 <b>조건</b>으로 맡는다 —
              "가고 싶은 곳이 있다면"은 단언이 아니라서 틀릴 수가 없으면서
              자기 쪽인지 알려준다.

              <p>⚠️ <b>길 안내는 본문이 한다.</b> 제목이 행동 이름이라 "누구를 위한 문인가"를
              말하지 않으므로, 그 일을 본문이 맡는다 — 왼쪽은 "가고 싶은 곳은 그대로"로
              <b>장소를 이미 갖고 있는 사람</b>임을 비추고, 오른쪽은 "몰랐던 여행지를
              찾아드려요"로 <b>모르는 사람</b>을 부른다.

              <p>특히 오른쪽 그 문장이 <b>경주를 모르는 사용자의 문패</b>다 — 그것이 없으면
              그 사람이 왼쪽으로 들어가 빈 검색창 앞에서 처음 막힌다.
              CLAUDE.md 필수 기능 6번이 이 진입점을 둔 이유가 그 사람이다. 지우지 말 것.
            */}
            <span className="text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
              코스 짜기
            </span>
            {/*
              "가고 싶은 곳은 그대로"가 두 몫을 한다 — <b>이 문이 누구 것인지</b>를 비추고
              (장소를 이미 가진 사람), 동시에 <b>우리가 그것을 무르지 않는다</b>고 약속한다.

              뒤엣말은 이 카드만의 것이 아니다. 진단 화면의 두 회피 경로가 같은 문형으로
              받는다 — "일정은 그대로, 더 여유로운 날을" · "계획은 그대로, 더 여유로운
              여행지를". <b>홈에서 한 약속이 그 화면들에서 그대로 지켜진다.</b>
              서비스가 하는 일이 여행을 대신 정하는 것이 아니라 붐비는 부분만 비껴 주는
              것이라, 두 진입 카드 다 "당신 것은 그대로 둔다"로 말한다.
            */}
            <span className="max-w-62.5 text-sm leading-[1.6] text-white/60">
              가고 싶은 곳은 그대로, <br/>붐비는 순간만 PEAKOFF가 도와드려요.
            </span>
            {/* 이 링크가 유일한 문이다. button+navigate 대신 Link라 새 탭으로도 열린다 */}
            <Link
              to="/plan"
              className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
            >
              {/* 제목이 이미 무엇을 하는지 말하므로 버튼은 짧게 둔다. 옆 카드와 같은 말이다 */}
              시작하기
              {/* 카드에 손을 올리면 화살표가 함께 나아가 "여기를 누르세요"를 가리킨다 */}
              <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </Link>
          </span>
        </div>

          {/*
            "이 기기에 저장한 코스"는 뺐다. 기기 저장(localStorage) 자체를 없앴기 때문이다 —
            저장된 코스는 이제 계정에만 있고, 그건 마이페이지가 보여준다.
          */}
        </div>

        {/*
          3. 진입점 ② 추천받기 — 왼쪽 진입점과 <b>같은 칸 수(6)</b>다.

          갈 곳을 이미 정한 사람과 빈손으로 온 사람은 다른 문으로 들어온다. 지금까지는
          앞의 문 하나뿐이라, 뒤쪽 사람은 30개 목록에서 장소를 담는 일이 첫 관문이 되어
          진단까지 가보지도 못하고 나갔다.

          크기는 왼쪽과 같다. 두 문 다 실제로 동작하므로 어느 쪽이 곁다리가 아니다.

          <b>점선을 실선으로 바꿨다.</b> 점선은 "준비 중"이라는 상태 신호였는데 기능이
          생겼으므로 남길 이유가 없다 — 미완성으로 읽히는 테두리를 그대로 두면
          동작하는 기능을 사용자가 눌러보지 않는다.

          색은 여전히 다르다. 왼쪽은 어두운 면, 이쪽은 흰 면에 노란 테두리다.
          노란 면을 통째로 깔면 로고와 주요 버튼에만 남겨야 할 강조색이 화면 절반을 차지한다.
        */}
        <div className={`${CELL} lg:col-span-6`}>
          {/* 왼쪽 카드와 같은 규칙 — 카드는 누르는 것이 아니고, hover는 CTA를 가리킨다 */}
          <div className="group border-brand bg-surface shadow-rest relative w-full overflow-hidden rounded-[24px] border-[1.5px] px-6 pt-6.5 pb-6 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
            <span className="relative flex flex-col gap-3">
              {/*
                ⚠️ 킥커를 "TRUST YOUR LUCK" 같은 말로 두지 않는다.
                매번 다른 코스가 나오는 것은 <b>운이 아니라 설계</b>다 — 자격을 갖춘 후보만
                남긴 뒤 점수에 비례해 고른다. 운을 앞세우면 바로 다음 화면에서 펴 보이는
                한적 지수와 추천 근거가 <b>구색으로 읽힌다.</b> 우리가 파는 것은 뽑기가
                아니라 "몰랐던 곳을 데이터로 찾아준다"는 약속이다.
              */}
              <span className="text-brand-deep text-[11.5px] font-semibold tracking-[0.1em]">
                DISCOVER A TRIP
              </span>
              {/*
                왼쪽과 같은 규칙 — 제목은 <b>하는 일</b>이고 상황은 본문이 조건으로 맡는다.
                "발견하기"인 이유는 이 문이 매번 다른 코스를 내놓기 때문이다(가중 무작위).
                "추천받기"라고 하면 늘 같은 답이 오는 것처럼 들린다.

                ⚠️ 한때 "오늘의 여행 발견하기"였다. <b>오늘이 아니다</b> — 설문은 날짜를
                고르게 하고 예측 창이 앞으로 24~29일이라 대부분 미래 날짜다. 게다가 이 화면에는
                진짜 "오늘"이 따로 있다(아래 "오늘의 경주"는 오늘의 혼잡을 말한다).
                한 화면에서 같은 말이 두 뜻으로 쓰이면 어느 쪽도 믿기 어려워진다.
              */}
              <span className="text-fg text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
                코스 발견하기
              </span>
              {/*
                ⚠️ "몰랐던 여행지를 찾아드려요"가 <b>경주를 모르는 사용자를 위한 문패</b>다.
                제목이 행동 이름이라 누구를 위한 문인지 말하지 않으므로, 그 일을 이 문장이
                혼자 맡는다 — 지우면 그 사람이 왼쪽 문으로 들어가 빈 검색창 앞에서 처음 막힌다.

                앞 문장 "날짜와 취향만"의 <b>"만"</b>도 같은 일을 한다. 가져올 것이 적다고
                말해 두어야 "나는 아직 아무것도 못 정했는데"라는 사람이 이쪽을 고른다.
              */}
              <span className="text-muted max-w-62.5 text-sm leading-[1.6]">
                날짜와 취향만 알려주세요. <br/>몰랐던 여행지를 PEAKOFF가 찾아드려요.
              </span>
              {/*
                왼쪽 카드와 같은 노란 알약이다. 회색 테두리 알약은 "준비 중"의 표현이었다 —
                눌러도 되는 버튼을 비활성처럼 그려두면 사용자는 없는 기능으로 읽는다.
                두 문이 같은 모양의 버튼을 갖는 것이 맞다. 둘 다 실제로 열리니까.
              */}
              <Link
                to="/recommend"
                className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
              >
                시작하기
                <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
              </Link>
            </span>
          </div>
        </div>

        {state.phase === 'error' && (
          /* 데이터 줄 전체를 채운다. 한 칸만 쓰면 나머지가 통째로 비어 오류보다 빈칸이 먼저 보인다 */
          <div className={`${CELL} lg:col-span-12`}>
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              오늘의 혼잡 정보를 불러오지 못했어요.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          </div>
        )}

        {state.phase !== 'error' && (
        <>
          {/*
            3. 지역 한 곳을 통째로 말하는 박스.

            <b>"오늘의 OO"와 "이번 주 한적한 날"이 한 박스에 산다.</b> 둘은 같은 지역의
            같은 이야기를 장소와 날짜로 나눠 하는 것이고, 8초마다 함께 넘어간다.
            따로 두었더니 나란히 바뀌는데도 서로 남처럼 보였다 — 같이 움직이는 것은
            같은 테두리 안에 있어야 한다.

            안에서는 두 열로 나눈다(7:5). 왼쪽이 오늘 하루, 오른쪽이 이번 주다.
          */}
          {/*
            박스에는 fade를 걸지 않는다. 걸었더니 테두리·그림자·바탕까지 함께 사라져
            14초마다 화면에 구멍이 뚫렸다. 틀은 붙박이로 두고 안에 든 것만 간다.
          */}
          <section
            className={`${CARD_RAISED} flex flex-col gap-5 p-4.5 lg:col-span-8 lg:flex-row lg:gap-6 lg:p-5.5`}
            {...rotating}
          >
          <div className={`${CELL} region-fade gap-3 lg:flex-1 lg:gap-3`} data-fading={fading}>
            {/*
              제목과 설명을 <b>한 묶음</b>으로 싼다. 설명을 섹션의 별도 항목으로 두면
              칸 사이 간격(gap-3)을 받아 제목에서 멀어지는데, 옆의 "지금 한적한 곳"은
              둘을 한 묶음(gap-0.75)으로 두고 있었다. 같은 층위의 두 섹션이 서로 다른
              간격을 쓰면 나란히 놓였을 때 머리글 높이가 어긋나 보인다.
            */}
            <div className="flex flex-col gap-0.75 px-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={SECTION_TITLE}>오늘의 {regionName}</h2>
                {/* toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다. */}
                <span className="text-hint font-mono text-xs">
                  {formatKoreanDate(today())} 기준
                </span>
              </div>
              {/* 예측·통계값이라 "실시간"이라고 쓰지 않는다. 화면 어디서도 마찬가지다. */}
              <span className="text-hint text-[12.5px]">
                오늘 예상되는 혼잡이에요. 예측값이라 실제와 다를 수 있어요.
              </span>
            </div>

            {/*
              한 카드 안에 붐빔과 한적을 <b>같은 수로</b> 나란히 둔다.

              붐비는 곳만 늘어놓으면 "그래서 어쩌라고"가 된다. 피할 곳 옆에 갈 곳이
              같은 무게로 서 있어야 이 서비스가 하려는 말이 카드 하나에서 끝난다.
              두 덩이를 가르는 것은 소제목과 얇은 선뿐이다 — 카드를 둘로 쪼개면
              "같은 날, 같은 계산의 양 끝"이라는 관계가 끊긴다.

              lg:flex-1 — 옆의 진입점 칸이 더 길 때 목록이 위에 붙어 뜨지 않게 한다.

              <b>카드 전체를 가운데 정렬하지 않는다.</b> 그러면 두 덩이가 함께 중앙으로
              몰려 위아래만 비고, 정작 선을 기준으로 보면 양쪽 다 가운데 쪽으로 치우친다.
              대신 각 덩이가 절반씩 나눠 갖고(lg:flex-1) 자기 절반 안에서 가운데에 선다.
              그래야 선이 카드의 실제 한가운데에 놓이고 위아래 여백이 같아진다.
            */}
            {/*
              <b>흰 카드가 아니라 눌러 담은 회백 패널이다.</b>

              박스가 흰 면인데 그 위에 흰 카드를 얹으면 그림자 한 올만 경계로 남아,
              목록이 어디서 시작하는지 눈으로 잡히지 않았다. 색을 한 칸 내리면 경계가
              선이 아니라 <b>면</b>이 되어 가늘든 말든 상관이 없어진다.

              그림자도 뗐다. 눌러 담은 면이 떠 보이면 두 신호가 부딪힌다.
              옆 칸의 "다른 사람들의 여행"이 쓰는 것과 같은 문법이다.
            */}
            {/*
              좁은 화면: <b>한 번에 한쪽만</b> 보여주고 위 스위치로 오간다.

              두 덩이를 세로로 다 펴면 목록만 여섯 줄이라 화면을 통째로 잡아먹고,
              아래 "이번 주 한적한 날"이 스크롤 밖으로 밀려난다. 홈은 훑어보는 화면이라
              한 화면에 무엇이 있는지부터 보여야 한다.

              <b>탭을 없애고 한쪽만 두는 선택은 하지 않았다.</b> 붐비는 곳 옆에 갈 곳이
              같은 무게로 서 있어야 이 서비스가 하려는 말이 완성된다 — 넓은 화면에서
              둘을 나란히 두는 이유와 같다. 좁은 화면에서는 나란히가 아니라 번갈아일 뿐이다.
            */}
            <div className="bg-bg rounded-card flex flex-col px-4 py-3 lg:hidden">
              {/*
                스위치. 고른 쪽이 흰 면으로 떠오른다.

                고른 쪽에 등급색(붐빔 빨강 / 한적 초록)을 칠하지 않았다. 이 카드에서 색은
                3단계 신호이고 아래 줄마다 이미 배지가 서 있는데, 탭까지 같은 색을 쓰면
                "지금 고른 것"과 "얼마나 붐비는지"가 같은 신호로 겹친다.
              */}
              <div className="bg-fill mb-3 flex gap-1 rounded-[12px] p-1">
                {HEADLINE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setHeadlineTab(tab.key)}
                    aria-pressed={headlineTab === tab.key}
                    className={`flex-1 cursor-pointer rounded-[9px] py-1.75 text-[12.5px] font-semibold transition-colors ${
                      headlineTab === tab.key
                        ? 'bg-surface text-fg shadow-rest'
                        : 'text-hint bg-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {data ? (
                <HeadlineGroup
                  label={HEADLINE_TABS.find((tab) => tab.key === headlineTab)!.label}
                  spots={headlineTab === 'crowded' ? data.headline.crowded : data.headline.quiet}
                  labelHidden
                />
              ) : (
                Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 py-2.75">
                    <span className="skeleton h-9 w-9 flex-none rounded-[10px]" />
                    <span className="skeleton h-2.25 w-2.25 flex-none rounded-full" />
                    <span className="skeleton h-3.25 w-23" />
                    <span className="flex-1" />
                    <span className="skeleton h-6 w-15.5 rounded-full" />
                  </div>
                ))
              )}
            </div>

            {/* 넓은 화면: 자리가 넉넉하니 둘을 한 패널에 위아래로 편다 */}
            <div className="bg-bg rounded-card hidden flex-col px-4 py-3 lg:flex lg:flex-1">
              {data ? (
                <>
                  <HeadlineGroup
                    label="붐빌 것으로 예상"
                    spots={data.headline.crowded}
                    className="lg:flex-1 lg:justify-center"
                  />
                  {/*
                    두 덩이를 가르는 선.

                    -mx-4로 카드 안쪽 여백을 거슬러 <b>카드 폭 끝까지</b> 긋는다. 안쪽에서
                    끊기면 줄 사이의 얇은 구분선(각 장소 사이)과 같은 것으로 보여, 묶음이
                    갈린다는 신호가 되지 않는다. 끝까지 닿아야 "여기서 다른 이야기가 시작된다"가 된다.

                    색도 줄 사이 선(border-line/60)보다 진하다. 같은 색이면
                    굵기와 길이만으로는 층위가 구분되지 않는다.
                  */}
                  <span className="bg-line -mx-4 my-3 h-px" aria-hidden="true" />
                  <HeadlineGroup
                    label="한적할 것으로 예상"
                    spots={data.headline.quiet}
                    className="lg:flex-1 lg:justify-center"
                  />
                </>
              ) : (
                Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 py-2.75">
                    <span className="skeleton h-2.25 w-2.25 flex-none rounded-full" />
                    <span className="skeleton h-3.25 w-23" />
                    <span className="flex-1" />
                    <span className="skeleton h-6 w-15.5 rounded-full" />
                  </div>
                ))
              )}
            </div>

          </div>

          {/*
            두 열을 가르는 선. 좁은 화면에서는 가로선, 넓은 화면에서는 세로선이다.
            선이 없으면 "오늘"과 "이번 주"가 한 덩이로 흘러 어디까지가 무엇인지 흐려진다.
          */}
          <span className="bg-line h-px w-full flex-none lg:h-auto lg:w-px" aria-hidden="true" />

          <div className={`${CELL} gap-3 lg:w-[38%] lg:flex-none lg:gap-3`}>
            {/*
              지역과 함께 갈리는 부분만 이 묶음 안에 든다. 아래 버튼 둘은 밖에 남아
              내용이 바뀌는 동안에도 그대로 선다 — 자세한 이유는 버튼 위 주석에 적었다.

              flex-1: 넓은 화면에서 이 묶음이 남는 높이를 받아야, 안에 든 예보 카드의
              flex-1이 예전처럼 칸을 채운다. 묶개를 하나 끼우면서 높이가 여기서
              끊기지 않게 이어 주는 자리다.
            */}
            <div
              className="region-fade flex min-w-0 flex-1 flex-col gap-3"
              data-fading={fading}
            >
            {/*
              가장 한적한 날은 <b>문구로</b> 말한다. 목록에서 그 줄만 색을 깔면
              "선택됨"과 신호가 부딪혀, 어느 것이 내가 고른 것인지 흐려진다.
              색은 선택에만 쓰고, 최적일은 글로 짚는다.
            */}
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>이번 주 한적한 날</h2>
              {data ? (
                <span className="text-hint text-[12.5px]">
                  <strong className="text-brand-deep font-semibold">
                    {formatCompactDate(data.bestDay.date)} {formatWeekday(data.bestDay.date)}
                  </strong>
                  이 가장 한적해요
                </span>
              ) : (
                <span className="text-hint text-[12.5px]">앞으로 7일 예상 혼잡</span>
              )}
            </div>

            {/*
              좁은 화면: 세로로 쌓는다.

              예전에는 옆으로 미는 띠였는데, 그것이 이 화면의 <b>유일한 가로 스크롤 상자</b>였고
              휴대폰에서 페이지가 옆으로 밀리는 원인이었다. 상자를 없애니 밀 것도 없어졌다.

              왼쪽 목록·넓은 화면 예보와 같은 회백 패널에 담는다 — 한 박스 안의 면들은
              같은 층위로 보여야 한다.
            */}
            <div className="bg-bg rounded-card flex flex-col gap-0.5 p-2 lg:hidden">
              {data
                ? data.forecast.map((day) => (
                    <ForecastCompactRow
                      key={day.date}
                      day={day}
                      selected={day.date === activeDate}
                      onSelect={() => setActiveDate(day.date)}
                    />
                  ))
                : Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="flex items-center gap-2.5 px-2.5 py-2.5">
                      <span className="skeleton h-3 w-4 flex-none" />
                      <span className="skeleton h-3 w-10 flex-none" />
                      <span className="flex-1" />
                      <span className="skeleton h-4 w-7 flex-none" />
                      <span className="skeleton h-4 w-11 flex-none rounded-full" />
                    </div>
                  ))}
            </div>

            {/* 넓은 화면: 같은 7일을 가로 막대로 눕혀 세로로 쌓는다 */}
            {/* 왼쪽 목록과 같은 회백 패널. 한 박스 안의 두 면이 같은 층위여야 한다 */}
            <div className="bg-bg rounded-card hidden flex-1 flex-col justify-center gap-0.5 p-2.5 lg:flex">
              {data
                ? data.forecast.map((day) => (
                    <ForecastRow
                      key={day.date}
                      day={day}
                      selected={day.date === activeDate}
                      onSelect={() => setActiveDate(day.date)}
                    />
                  ))
                : Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 px-2.5 py-2">
                      <span className="skeleton h-3 w-13 flex-none" />
                      <span className="skeleton h-6 flex-1 rounded-[7px]" />
                      <span className="skeleton h-4 w-11 flex-none rounded-full" />
                    </div>
                  ))}
            </div>

            </div>

            {/*
              <b>이 버튼 둘은 지역이 넘어갈 때 사라지지 않는다.</b> 위 묶음 밖에 선 이유다.

              나머지는 "지금 무엇을 보고 있는가"라 지역을 따라 갈려야 하지만, 이 자리는
              "그래서 무엇을 할 것인가"다. 행동하는 자리가 14초마다 사라졌다 나타나면
              누르려던 손이 갈 곳을 잃는다 — 붙박이로 두는 편이 맞다.

              <b>고른 날짜는 지역이 넘어가도 그대로 남는다.</b> 고른 것은 날짜이지 지역이
              아니고, 다음 화면으로 넘길 때도 날짜만 싣는다. 예전에는 고르지 않았을 때
              그 지역의 가장 한적한 날이 기본값이라 <b>지역이 바뀔 때마다 버튼의 날짜가
              혼자 갈렸다</b> — 이제 고르기 전에는 날짜가 없어서 그 일이 없다.
            */}
            {/*
              고르는 일과 넘어가는 일을 나눈다.

              목록은 <b>고르기만</b> 하고, 화면을 옮기는 것은 이 버튼 하나다. 줄을 누를 때마다
              바로 넘어가면 날짜를 견줘 보다가 실수로 스쳐도 비교하던 것이 사라진다.

              고르기 전에는 비활성이다. 가장 한적한 날을 미리 골라두면 사용자는 화면이 정한
              값을 <b>자기가 고른 것</b>으로 착각한 채 넘어가, 어느 날로 짜는지 모르게 된다.
              문구도 상태를 그대로 말한다 — 비활성일 때 "코스 짜기"라고만 적혀 있으면
              왜 안 눌리는지 알 수 없다.
            */}
            {/*
              고른 날짜로 갈 수 있는 문 둘. 위쪽 진입점 두 개와 같은 짝이다 —
              날짜를 정한 사람도 <b>직접 짤지 추천받을지</b>는 아직 안 정했을 수 있다.
              한쪽만 두면 날짜를 고른 순간 나머지 길이 닫힌다.

              <b>채움 하나 + 테두리 하나로 짝을 짓는다.</b> 전에는 둘 다 흰 면에 테두리만
              달랐는데(회색 1px / 틸 1.5px), 그러면 같은 종류의 버튼 둘이 굵기와 색만
              어긋난 채 서 있어 틸 테두리 하나가 홀로 떠 보인다. 게다가 흰 카드 위의
              흰 버튼이라 <b>누르는 것으로 보이지 않았다</b> — 예보를 다 본 다음 시선이
              닿아야 할 자리인데 가장 조용했다.

              같은 틸의 채움과 테두리는 서로를 설명한다. 주·보조가 한눈에 갈리면서도
              두 문이 같은 기운으로 묶여, 마이페이지 빈 화면의 두 문과도 같은 모양이 된다.
              채움이 직접 짜기인 것은 서비스의 원래 흐름이기 때문이고, 그 순서는
              위쪽 진입점 두 카드에서도 같다.

              shadow-cta는 얹지 않는다. 위쪽 카드의 CTA도 그림자 없이 색으로만 서 있어,
              여기만 그림자를 두면 같은 버튼이 화면 안에서 두 무게를 갖는다.
            */}
            <div className="flex flex-col gap-2 px-1">
              <button
                type="button"
                disabled={activeDate === null}
                className={`${DATE_ACTION} bg-brand hover:bg-brand-hover text-fg`}
                onClick={() =>
                  activeDate && navigate('/plan', { state: { startDate: activeDate } })
                }
              >
                {activeDate ? `${formatCompactDate(activeDate)}로 코스 짜기` : '코스 짜기'}
              </button>
              <button
                type="button"
                disabled={activeDate === null}
                className={`${DATE_ACTION} border-brand bg-surface text-fg hover:bg-bg border-[1.5px]`}
                onClick={() =>
                  activeDate && navigate('/recommend', { state: { startDate: activeDate } })
                }
              >
                {activeDate ? `${formatCompactDate(activeDate)}로 추천받기` : '추천받기'}
              </button>
            </div>
          </div>
          </section>

          {/*
            4. 다른 사람들의 여행 — 지역이 넘어가도 그대로 선다.

            옆 칸과 <b>같은 박스</b>에 담는다. 예전에는 이쪽만 테두리 없이 배경 위에 떠 있어,
            나란히 놓인 두 덩이가 같은 층위로 읽히지 않았다. 홈의 데이터 줄은 박스 둘이다.
          */}
          <section
            className={`${CARD_RAISED} flex flex-col gap-3 p-4.5 lg:col-span-4 lg:p-5.5`}
          >
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>다른 사람들의 여행</h2>
              <span className="text-hint text-[12.5px]">
                눌러서 어떤 코스인지 볼 수 있어요
              </span>
            </div>

            {others.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-1">
                {others.map((course) => (
                  <OtherCourseCard
                    key={`${course.region}-${course.startDate}-${course.createdAt}`}
                    course={course}
                    onOpen={() => setOpenedCourse(course)}
                  />
                ))}
              </div>
            ) : (
              /*
                아직 저장된 코스가 없을 때. <b>빈 칸으로 두지 않는다.</b>
                자리만 비워 두면 고장으로 읽히고, 스켈레톤을 계속 돌리면 영영 오지 않을 것을
                기다리는 화면이 된다. 대신 첫 사람이 될 수 있다고 말한다.
              */
              <div className="bg-bg flex flex-col gap-1.5 rounded-[16px] p-4.5">
                <span className="text-fg text-[14px] font-semibold">아직 저장된 코스가 없어요</span>
                <span className="text-hint text-[12.5px] leading-[1.6]">
                  코스를 짜고 저장하면 여기 처음으로 올라와요.
                </span>
              </div>
            )}
          </section>
        </>
        )}
        </div>

        {/*
          출처 표기. 절대 규칙 4 — 공사 이름·로고는 못 쓰고 "공공데이터 기반" 같은
          중립 표현만 허용된다. 화면의 모든 숫자가 어디서 왔는지 말하는 유일한 줄이라,
          심사위원이 어느 화면에서 시작하든 닿는 홈에 둔다.
        */}
        <p className="text-hint m-0 pt-5 pb-2 text-center text-[11.5px]">
          혼잡 예측은 공공데이터 기반 통계·예측값으로, 실제와 다를 수 있어요.
        </p>
      </div>

      {/* 남의 코스 펼쳐 보기. 열 때 서버를 부르지 않는다 — 내용이 이미 목록에 실려 왔다 */}
      {openedCourse && (
        <PublicCourseSheet
          course={openedCourse}
          onClose={() => setOpenedCourse(null)}
          onCopyToFlow={copyToFlow}
        />
      )}
    </div>
  )
}
