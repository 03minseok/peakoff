import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { BrandLockup } from '../components/BrandMark'
import { CongestionBadge } from '../components/CongestionBadge'
import { ChevronRight } from '../components/icons'
import { PlaceDetailSheet } from '../components/PlaceDetailSheet'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { HeaderAuthAction, HeaderNav, MobileMenu } from '../components/Nav'
import { LEVEL_COLOR_VAR, LEVEL_TINT } from '../components/levelStyles'
import { PublicCourseSheet } from '../components/PublicCourseSheet'
import { CARD_RAISED } from '../components/styles'
import { ApiRequestError, fetchQuietSpots, fetchRecentCourses } from '../services/api'
import type { PublicCourse, QuietSpot } from '../types/api'
import { useTrip } from '../state/tripContext'
import { formatKoreanDate, formatNights, today } from '../utils/date'

/**
 * 화면 폭.
 *
 * 모바일은 한 줄로 읽고, lg부터 대시보드처럼 좌우로 편다.
 * 680px에서 멈춰 두면 1440px 화면에서 양옆 380px씩이 그냥 빈다.
 */
const SHELL = 'mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-app'

/**
 * "이번 주 한적한 곳" 카드가 서는 자리.
 *
 * <h3>모바일은 <b>한 줄 띠</b>, lg는 예전 세로 목록</h3>
 * 시안이 카드를 한 줄에 세우고 옆으로 넘긴다. 좁은 폭에 넉 장을 다 욱여넣으면
 * 한 장이 73px가 되어 이름도 배지도 못 읽으므로, <b>두 장 반쯤 보이는 띠</b>를 놓고
 * 나머지는 넘겨서 본다. 넘길 것이 옆에 걸쳐 있다는 사실 자체가 조작의 안내다.
 *
 * <p>⚠️ <b>스크롤 상자가 아니다.</b> {@code overflow-x-auto}로 만들면 브라우저가 가로
 * 스크롤을 맡고, 끝까지 민 제스처가 페이지로 이어져 <b>실물 아이폰에서 화면이 통째로
 * 밀린다</b>({@code overscroll-behavior-x}로도 안 막힌다 — 결과 화면에서 겪었다).
 * 여기서는 손가락 이동량을 받아 {@code translate}로 옮길 뿐이라 브라우저가 맡는
 * 가로 스크롤이 아예 없다. {@code touch-pan-y}가 짝이다 — 세로는 브라우저에게 맡기고
 * <b>가로 제스처만</b> 우리가 가져온다.
 *
 * <p>끌기는 <b>화면에 보이지 않는 조작</b>이라 머리글에 넘기는 단추를 함께 둔다.
 *
 * <p>lg에서는 띠를 풀어 예전의 세로 목록으로 돌아간다.
 */
const QUIET_STRIP =
  'flex touch-pan-y gap-2.5 translate-x-[var(--strip-x)] select-none lg:grid lg:translate-x-0 lg:grid-cols-1 lg:gap-2 lg:select-auto'

/** 카드 한 장의 폭과 그 옆 간격(px). 한 장 넘길 때 옮기는 거리가 이 둘의 합이다 */
const QUIET_CARD_W = 120
const QUIET_CARD_GAP = 10

/**
 * 박스 머리글.
 *
 * <p>모바일은 <b>18px — 위 두 진입 카드의 제목과 같은 값</b>이다. 한 화면에 서는
 * 머리글이 넷인데(문 둘 · 박스 둘) 크기가 갈리면 <b>급이 다른 것</b>처럼 보인다.
 * 레퍼런스의 19px에서 한 칸 내려 맞췄다. lg는 예전 17px 그대로.
 */
const SECTION_TITLE = 'text-fg m-0 text-[18px] font-bold tracking-[-0.02em] lg:text-[17px] lg:tracking-[-0.015em]'

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
 * 홈이 세우는 "이번 주 한적한 곳" 수.
 *
 * <h3>셋에서 다섯으로 (2026-08-31)</h3>
 * 데이터 줄이 넉 칸씩 셋으로 갈리면서 이 박스의 높이가 줄에 맞춰 늘어났고,
 * 카드 셋만 두면 아래가 비었다.
 *
 * <h3>⚠️ 요청 수를 늘릴 때는 <b>분산이 사는지 재고</b> 늘린다</h3>
 * 요청 수가 후보 수에 가까워지면 "다 가져가라"와 같아져 가중 무작위가 고를 것이 없어진다 —
 * 2026-08-26에 대안 시트가 여덟을 요청해 분산 장치를 죽인 것이 그 모양이었다.
 * 여기서도 <b>지역 대표는 일곱까지</b>라 다섯이면 위험해 보였다.
 *
 * <p>재보니 아니었다(12회 호출, 실데이터). 서버가 <b>지역 대표를 요청마다 새로 뽑기</b>
 * 때문에 후보 공간이 일곱이 아니라 (지역 × 그 지역의 한적한 곳들)이다 —
 * 12회에 서로 다른 장소가 17곳 넘게 나왔고 1등 고정률은 25%(3/12)로 셋일 때와 같았다.
 * <b>열 이상으로 올릴 때는 다시 재야 한다.</b>
 */
const QUIET_SPOT_COUNT = 5

/** 이번 주 한적한 곳 불러오기 상태. 실패해도 홈의 나머지는 그대로 선다 */
type QuietSpotState =
  | { phase: 'loading' }
  | { phase: 'loaded'; spots: QuietSpot[] }
  | { phase: 'error'; message: string }

/** 서버가 준 문구를 그대로 쓰고, 그것조차 없을 때만 우리가 지어낸다 */
function messageOf(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : '한적한 곳을 불러오지 못했어요.'
}

/** 다른 사람들의 여행 카드 수. 한 열에 담기는 만큼만 */
const OTHER_COURSE_COUNT = 4

/**
 * 서버에서 받아 둘 후보 수. 엔드포인트 상한(12)과 같다.
 *
 * <p>카드 수(4)보다 넉넉히 받는 이유: 이 목록은 <b>받은 것 중에서 골라 보여주기</b> 때문이다.
 * 넷만 받으면 고를 것이 없어 아래 뽑기가 이름뿐인 장치가 된다 — 대안 추천에서
 * "Pool이 셋인데 여덟을 달라고 하면 Pool이라는 개념이 무의미해진다"고 배운 것의 반대 방향이다.
 */
const OTHER_COURSE_POOL = 12

/** 카드가 갈리는 간격. 왼쪽 두 칸이 쓰던 리듬(예전 14초)보다 약간 빠른 12초 */
const OTHER_COURSE_ROTATE_MS = 12_000

/** region-fade가 사라지는 시간(index.css의 460ms)과 같아야 한다. 내용 교체는 다 사라진 뒤에 한다 */
const OTHER_COURSE_FADE_MS = 460

/**
 * 받아 둔 코스에서 화면에 세울 넷을 뽑는다.
 *
 * <h3>한적 상위 절반에서 무작위로</h3>
 * 최근 저장순을 그대로 세우지 않는다 — 이 서비스가 남의 여행을 보여주는 이유는
 * "이렇게 한적하게 다녀올 수 있다"는 견본이라서, 붐비는 코스가 최신이라는 이유로
 * 맨 위에 서면 견본이 반대로 말한다. 그렇다고 점수순으로 세우면 최고점 코스가
 * 언제나 1등이 된다 — 대안 추천이 겪은 것과 같은 병이라, 여기도 <b>거르고 나서 뽑는다</b>:
 * 총점 상위 절반만 남기고(거르기), 그 안에서 균등 무작위로 넷을 고른다(뽑기).
 *
 * <p>순서도 뽑힌 순서 그대로다. 뽑은 뒤 점수순으로 다시 세우면 뽑기가 하는 일이
 * 절반 죽는다는 것을 2026-08-26에 실측으로 배웠다.
 *
 * <p>⚠️ 다만 <b>절반이 카드 수보다 적으면 카드 수까지 후보를 늘린다.</b> 저장된 코스가
 * 여덟이 안 되는 동안 절반을 곧이곧대로 지키면 카드가 두어 장만 서서, 거르기가
 * 한 일이 "목록을 비운 것"뿐이 된다. 후보가 아홉을 넘으면 그때부터 절반 규칙이
 * 실제로 거른다 — 데이터가 적은 동안의 하한이지 규칙의 예외가 아니다.
 */
function drawOtherCourses(pool: PublicCourse[]): PublicCourse[] {
  const quietHalf = [...pool]
    .sort((a, b) => b.totalQuietness - a.totalQuietness)
    .slice(0, Math.max(Math.ceil(pool.length / 2), OTHER_COURSE_COUNT))

  // Fisher-Yates 부분 셔플. 앞 넷만 정하면 되므로 넷째까지만 섞는다.
  for (let i = 0; i < Math.min(OTHER_COURSE_COUNT, quietHalf.length - 1); i++) {
    const j = i + Math.floor(Math.random() * (quietHalf.length - i))
    ;[quietHalf[i], quietHalf[j]] = [quietHalf[j], quietHalf[i]]
  }
  return quietHalf.slice(0, OTHER_COURSE_COUNT)
}

/** 카드에 맛보기로 보이는 장소 수. 나머지는 눌러서 펼쳤을 때 나온다 */
const PREVIEW_PLACES = 3

/**
 * "이번 주 한적한 곳" 한 장.
 *
 * <h3>지역 이름이 카드에 있어야 하는 이유</h3>
 * 이 목록은 <b>일곱 지역을 한데 섞은 것</b>이라, 어느 카드가 어디인지 카드가 스스로
 * 말하지 않으면 "삼악산"이 경주인지 춘천인지 알 길이 없다. 지역을 하나 골라 보여주던
 * 예전 박스에는 머리글이 그 일을 해 주고 있었다.
 *
 * <h3>⚠️ 날짜는 카드에 적지 않는다</h3>
 * 서버는 <b>기간 중 가장 한적한 하루</b>를 골라 보내고, 그 날짜가
 * "이 장소로 여행가기"의 시작일이 된다. 다만 카드에는 세우지 않는다 —
 * 언제를 말하는지는 박스 머리글("앞으로 7일")이 이미 밝히고 있고,
 * 카드마다 날짜를 한 줄씩 더 두면 다섯 장이 늘어선 목록이 숫자로 빽빽해진다.
 *
 * <p>값 자체는 그대로 들고 있다. 눌러서 여행을 시작하면 그 날짜로 시작한다.
 *
 * <h3>흰 카드가 아니라 바탕색으로 눌러 담은 칸이다</h3>
 * 이 카드가 흰 박스 안에 들어간다. 흰 면 위에 흰 카드를 얹으면 그림자로만 갈려
 * 층이 흐릿해진다 — 옆 칸의 남의 코스 카드와 같은 규칙이다.
 */
function QuietSpotCard({ spot, onOpen }: { spot: QuietSpot; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press bg-surface border-line shadow-rest hover:bg-fill lg:bg-bg lg:border-0 lg:shadow-none lg:hover:bg-line/40 lg:rounded-card relative flex w-[var(--quiet-card-w)] flex-none cursor-pointer flex-col overflow-hidden rounded-[16px] border p-0 text-left transition-colors lg:w-full lg:flex-auto lg:flex-row lg:items-center lg:gap-3 lg:p-2.5"
    >
      {/*
        ■ 모바일은 사진이 위, <b>lg는 예전 그대로</b> 왼쪽 썸네일이다 (2026-09-02)

        좁은 화면에서는 카드가 격자로 서므로 사진이 위를 가로지른다 — 이 목록이 하는 일은
        "어디로 갈지 정하지 않은 사람에게 서비스가 먼저 말을 거는" 것이라
        <b>볼거리가 먼저</b> 와야 하고, 반 폭짜리 카드에서 왼쪽 썸네일은 글자가 설 자리를
        남기지 않는다.

        <p><b>데스크톱은 바꾸지 않는다.</b> lg에서는 세로 목록이라 사진을 위에 얹으면
        한 장이 길어져 다섯 장이 박스를 넘긴다. 한 컴포넌트가 두 모양을 겸하되
        <b>모양을 가르는 것은 breakpoint 하나</b>다 — 화면별로 컴포넌트를 나누면
        나중에 한쪽만 고쳐진다(PlaceThumbnail의 banner가 같은 방법을 쓴다).

        <p>⚠️ <b>옆으로 미는 띠가 아니다.</b> 시안은 카드를 옆으로 넘기게 그렸지만,
        끝까지 민 제스처가 페이지로 이어져 화면 전체가 밀린다
        (CLAUDE.md — 주간 예보에서 이미 한 번 걷어낸 자리다).
      */}
      <PlaceThumbnail name={spot.place.name} imageUrl={spot.place.imageUrl} size="card" />

      {/*
        ⚠️ <b>이름이 한 줄을 통째로 쓴다.</b> 공사 이름은 원래 길다
        (강원특별자치도산림박물관 · 여수 낭도리 공룡발자국화석 산지) — 옆에 무엇이든 세우면
        <b>"여수 낭도리 공…"</b>으로 잘리고, 무엇인지 알아볼 수 없는 이름은
        카드가 하는 일을 못 한다. 두 줄까지 간다.

        <h3>격자(grid)로 세우는 이유 — 화면마다 자리가 다르다</h3>
        세 줄의 <b>순서는 같고 자리만 갈린다</b>. 그래서 DOM은 하나로 두고 lg에서
        칸·줄만 지정한다. flex로는 이게 안 된다 — 세로로 쌓으면 lg에서 이름과 배지를
        한 줄에 놓을 수 없고, 화면마다 마크업을 나누면 한쪽만 고쳐지는 자리가 생긴다.

        <pre>
          모바일            lg (예전 그대로)
          이름              이름        배지
          지역              지역
          배지
        </pre>

        <p>모바일에서 배지가 마지막 줄에 혼자 서므로 나란한 카드들의 점수가
        <b>같은 높이</b>에 맞는다 — 배지를 오른쪽 위로 올렸던 이유(이름 길이에 따라
        제각기 다른 자리에 서던 것)를 격자가 다른 방법으로 푼다.
      */}
      <span className="grid min-w-0 gap-0.75 px-2 pt-2 pb-2.5 lg:flex-1 lg:grid-cols-[1fr_auto] lg:gap-1 lg:p-0">
        <span className="text-fg line-clamp-2 min-w-0 text-[12px] leading-[1.35] font-semibold tracking-[-0.01em] lg:col-start-1 lg:row-start-1 lg:text-[15px]">
          {spot.place.name}
        </span>
        {/*
          지역. <b>등급색을 쓰지 않는다</b> — 이 카드에서 색은 한적도 신호이고,
          지역은 신호가 아니라 이름표다.

          <p>모바일에서는 알약을 벗고 맨 글자로 선다. 카드 폭이 절반이라
          알약의 좌우 여백이 이름 폭을 갉아먹는다. lg는 예전의 흰 알약 그대로.
        */}
        <span className="text-hint bg-fill rounded-chip w-fit min-w-0 truncate px-1.5 py-0.5 text-[10px] font-semibold lg:bg-surface lg:col-start-1 lg:row-start-2 lg:text-[11px]">
          {spot.regionName}
        </span>
        {/*
          ■ 모바일에서는 배지가 <b>사진 오른쪽 위</b>에 얹힌다 (2026-09-02)

          글 아래에 있을 때는 카드마다 이름이 한 줄이냐 두 줄이냐에 따라 배지의 높이가
          달라져, 나란한 카드끼리 점수를 눈으로 훑을 수 없었다. 사진 모서리에 얹으면
          <b>네 장의 배지가 언제나 같은 자리</b>에 선다.

          <p>사진 위에 글자가 얹히지만 배지는 <b>불투명한 tint 바탕</b>을 가지고 있어
          어떤 사진 위에서도 대비가 유지된다 — 반투명하게 두면 밝은 하늘 사진에서 묻힌다.

          <p>lg는 예전 그대로다 — 그쪽은 사진이 왼쪽 썸네일이라 얹을 자리가 없고,
          이름과 같은 줄에 서는 것이 이미 같은 일을 한다.
        */}
        <span className="absolute top-1.5 right-1.5 flex lg:static lg:col-start-2 lg:row-start-1 lg:mt-0 lg:items-start lg:justify-self-end">
          {/*
            같은 배지를 화면마다 다른 크기로 그린다 — 좁은 화면에서는 카드가 132px이라
            sm이 카드 폭의 절반을 먹는다. lg의 세로 목록은 폭이 넉넉해 예전 크기 그대로.
          */}
          <span className="lg:hidden">
            <CongestionBadge
              level={spot.level}
              label={spot.levelLabel}
              quietness={spot.quietness}
              size="xs"
            />
          </span>
          <span className="hidden lg:inline-flex">
            <CongestionBadge
              level={spot.level}
              label={spot.levelLabel}
              quietness={spot.quietness}
              size="sm"
            />
          </span>
        </span>
      </span>
    </button>
  )
}

/**
 * 다른 사람이 저장한 코스 한 장. <b>눌러서 펼쳐 본다.</b>
 *
 * <p>예전에는 누를 수 없었다. 서버가 코스 id를 주지 않아서인데, 이제는 <b>id 없이</b>
 * 목록 응답이 장소를 전부 들고 온다 — 열어 보는 데 필요한 것이 이미 손에 있으므로
 * 남의 코스에 주소를 주지 않고도 펼칠 수 있다. 그래서 누를 때 서버를 다시 부르지 않는다.
 *
 * <p>제목은 <b>"챔석님의 경주"</b>다. 지역과 기간만 세웠더니 어느 카드나 "경주 1박 2일"이라
 * 서로 구분되지 않아 한동안 <b>사용자가 붙인 코스 이름</b>을 썼는데, 그 이름은 저마다
 * 문법이 달라("엄마 생신 여행" · "경주 2일") 카드 다섯이 한 목록으로 읽히지 않았다.
 * 사람으로 가르면 <b>모든 카드가 같은 문형</b>이 되면서도 서로 구분된다 —
 * 그리고 이 목록이 하려는 말("다른 사람들은 어디로 갔나")이 제목에서 바로 드러난다.
 *
 * <p>지역·기간은 그 아래 줄에 그대로 있다. 제목의 "경주"는 <b>어디</b>만 말하고,
 * 며칠·언제는 아랫줄이 맡는다.
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
  /*
   * 아랫줄의 지역. 제목이 이미 짧은 이름("경주")을 쓰므로 여기서 같은 말을 반복하지 않게
   * <b>정식 이름에서 도명만 뗀</b> "경주시"를 쓴다 — 제목은 사람, 이 줄은 여정이다.
   */
  const shortRegion = course.regionName.replace(/^.*\s/, '')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group bg-bg hover:bg-fill flex w-full cursor-pointer flex-col gap-2.5 rounded-[16px] border-none p-3 text-left transition-colors lg:p-3.5"
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
          className="grid h-12 w-12 flex-none place-items-center rounded-full p-1 lg:h-13 lg:w-13"
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
            <span className="text-fg font-mono text-[14px] leading-none font-semibold lg:text-[15px]">
              {course.totalQuietness}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-fg min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">
              {course.nickname}님의 {course.regionShortName}
            </span>
            {/* 한적도는 어디서나 3단계 배지로 말한다. 게이지는 정도를, 배지는 등급을 맡는다 */}
            <span
              className={`flex-none rounded-full px-2 py-0.75 text-[11px] font-semibold ${LEVEL_TINT[course.level]}`}
            >
              {course.levelLabel}
            </span>
          </div>
          {/*
            ⚠️ <b>출발일을 적지 않는다</b> (2026-08-31).

            남의 출발일은 이 카드를 보는 사람에게 <b>쓸 데가 없는 날짜</b>다. 베껴 갈 때
            그 날로 가는 것도 아니고(이제 시트에서 직접 고른다), 지난 날짜면 오히려
            "지난 여행"으로 읽혀 눌러볼 이유를 깎는다. 남는 것은 <b>어디를 며칠</b>이고,
            그 둘이 베껴 갈 때 실제로 물려받는 값이다.
          */}
          <span className="text-hint truncate text-[12px]">
            {shortRegion} {formatNights(course.nights)}
          </span>
        </div>
      </div>

      {/*
        담긴 순서대로 앞쪽 몇 곳. 코스 전체가 아니라는 뜻으로 말줄임을 붙인다.

        <p>⚠️ <b>모바일에서는 접는다</b> (2026-09-02). 좁은 화면에서 이 줄은 대개
        한 곳 반쯤에서 잘려("여수수산물특화시장 · 여수 연안여객선터미널 ·…") 어디를
        갔는지 알려주지 못하면서 카드 높이만 한 켜 늘린다. 카드 넷이면 그만큼이 네 번이다.
        <b>어디를 갔는지는 눌러서 펼친 시트가 전부 보여준다</b> — 잘린 목록보다 낫다.
      */}
      {preview.length > 0 && (
        <p className="text-muted m-0 hidden w-full truncate text-[12.5px] lg:block">
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
  /**
   * 다른 사람들이 저장한 코스 후보. <b>이 화면에 머무는 동안의 캐시다.</b>
   *
   * <p>서버는 들어올 때 <b>한 번만</b> 부른다. 12초마다 카드가 갈리지만 그때 부르는 것은
   * 이 배열이지 서버가 아니다 — 회전은 보여주기의 사정이라, 그때마다 호출이 나가면
   * 홈을 켜 둔 브라우저 하나가 5분에 스물다섯 번을 두드린다.
   *
   * <p><b>지역과 무관하다.</b> "다른 사람들은 어디로 갔나"에 지역을 걸면 볼 수 있는
   * 여행이 줄고, 지금은 저장된 코스 자체가 많지 않다.
   *
   * <p>실패해도 홈은 그대로 그린다. 곁들이는 정보라 이것 때문에 화면을 막을 이유가 없다.
   */
  const [othersPool, setOthersPool] = useState<PublicCourse[]>([])
  /** 지금 화면에 선 넷. 후보에서 뽑은 결과다 */
  const [others, setOthers] = useState<PublicCourse[]>([])
  /** 카드가 갈리는 중인가. region-fade가 이 값으로 사라졌다 나타난다 */
  const [othersFading, setOthersFading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchRecentCourses(OTHER_COURSE_POOL, controller.signal)
      .then((pool) => {
        setOthersPool(pool)
        setOthers(drawOtherCourses(pool))
      })
      .catch(() => setOthersPool([]))
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
   * 시트가 열려 있는지를 회전 타이머가 읽는 창구.
   *
   * <p>상태를 직접 의존성에 넣으면 시트를 여닫을 때마다 타이머가 다시 시작되어,
   * 시트를 자주 여는 사람일수록 카드가 영영 안 갈린다. ref로 두면 타이머는 한 번만
   * 걸리고 매 회마다 지금 값을 들여다본다.
   */
  const courseSheetOpen = useRef(false)
  courseSheetOpen.current = openedCourse !== null

  /**
   * ■ 12초마다 카드를 다시 뽑는다 — 서버는 부르지 않는다
   *
   * <p>후보 절반이 카드 수보다 많을 때만 돈다. 뽑아 봐야 같은 넷이면
   * 사라졌다 나타나는 시늉만 12초마다 반복하는 셈이다.
   *
   * <p>건너뛰는 두 경우:
   * <ul>
   *   <li><b>탭이 뒤에 있을 때</b> — 안 보는 화면을 갈아 봐야 전환만 쌓이고,
   *       돌아온 순간 여러 전환이 몰아서 튄다</li>
   *   <li><b>코스 시트가 열려 있을 때</b> — 눌러 보던 카드가 시트 밑에서 사라지면,
   *       닫고 돌아온 사람이 방금 보던 것을 찾지 못한다</li>
   * </ul>
   *
   * <p>전환은 왼쪽 칸들이 쓰던 region-fade를 그대로 쓴다. 다 사라진 뒤(460ms) 내용을
   * 갈아끼우고 다시 나타난다 — 제자리에서 글자만 바뀌면 깜빡임으로 읽힌다.
   * 움직임을 줄여달라는 설정에서는 CSS가 알아서 멈추고 내용만 조용히 갈린다.
   */
  useEffect(() => {
    if (Math.ceil(othersPool.length / 2) <= OTHER_COURSE_COUNT) {
      return
    }
    const interval = window.setInterval(() => {
      if (document.hidden || courseSheetOpen.current) {
        return
      }
      setOthersFading(true)
      window.setTimeout(() => {
        setOthers(drawOtherCourses(othersPool))
        setOthersFading(false)
      }, OTHER_COURSE_FADE_MS)
    }, OTHER_COURSE_ROTATE_MS)
    return () => window.clearInterval(interval)
  }, [othersPool])

  /**
   * 펼쳐 보고 있는 한적한 곳. <b>id가 아니라 줄 전체를 들고 있다.</b>
   *
   * <p>상세 시트에 넘길 것이 장소만이 아니다 — 한적도·등급·그 날짜가 함께 가야
   * 시트가 배지를 그린다. id만 들고 있으면 그 값들을 목록에서 다시 찾아와야 하고,
   * 찾는 코드가 목록을 그리는 코드와 갈라져 한쪽만 고쳐지는 자리가 생긴다.
   */
  const [openedSpot, setOpenedSpot] = useState<QuietSpot | null>(null)

  /**
   * 한적한 곳 띠가 지금 몇 번째 카드부터 보여주고 있는가. <b>모바일 전용 상태다</b> —
   * lg에서는 띠가 풀려 세로 목록이 되므로 이 값이 화면에 아무 일도 하지 않는다.
   */
  const [stripIndex, setStripIndex] = useState(0)
  /** 손가락을 따라온 거리(px). 놓는 순간 0으로 돌아가고 자리는 stripIndex가 정한다 */
  const [stripDrag, setStripDrag] = useState(0)
  /**
   * 끌기 한 번의 시작점과 <b>축</b>.
   *
   * <p>처음 몇 px은 축을 정하지 않고 지켜본다 — 곧바로 가로로 판정하면
   * 세로로 넘기려던 손가락이 띠에 붙잡혀 <b>페이지가 안 내려간다.</b>
   */
  const strip = useRef({ x: 0, y: 0, dx: 0, axis: '' as '' | 'x' | 'y' })

  /**
   * 남의 코스를 그대로 내 편집 화면에 담는다.
   *
   * <p><b>진단 화면이 아니라 편집 화면으로 간다.</b> 마이페이지의 "수정하기"는 내가 짠
   * 코스를 그대로 다시 진단하는 것이지만, 여기는 남의 일정을 베껴 오는 것이라 대개
   * 날짜부터 갈아야 한다. 담긴 채로 편집 화면에 서면 무엇을 고칠지 바로 보인다.
   *
   * <p>⚠️ <b>출발일은 시트가 받아서 넘긴다.</b> 예전에는 남의 출발일을 그대로 쓰고
   * 지난 날짜면 일주일 뒤로 대신 정해 주었는데, 사용자는 자기 여행이 언제 시작하는지
   * 모르는 채 편집 화면에 도착했다. 가져오는 것은 <b>장소와 순서</b>이고 언제 떠날지는
   * 베끼는 사람이 정한다.
   */
  function copyToFlow(course: PublicCourse, startDate: string) {
    const days: string[][] = Array.from({ length: course.days }, () => [])
    course.places.forEach((place) => {
      days[place.day - 1]?.push(place.placeId)
    })

    restore(
      {
        region: course.region,
        startDate,
        nights: course.nights,
      },
      days,
    )
    setOpenedCourse(null)
    navigate('/course')
  }

  /**
   * 그 장소로 여행을 시작한다.
   *
   * <h3>왜 조건 화면을 거치는가</h3>
   * 곧장 편집 화면으로 보낼 수도 있다. 그러나 이 사람이 정한 것은 <b>장소 하나</b>뿐이고
   * 여행에는 기간이 필요하다 — 며칠짜리인지 묻지 않고 1박 2일로 정해 버리면
   * 사용자가 하지 않은 선택을 서비스가 대신한 것이 된다.
   *
   * <p>대신 <b>아는 것은 채워서 보낸다.</b> 지역과 날짜는 이미 이 카드가 말하고 있으므로
   * 조건 화면에 미리 들어가 있다. 사용자가 손볼 것은 기간 하나다.
   *
   * <p>⚠️ <b>날짜는 그 곳이 한적한 날이다.</b> 오늘이 아니다 — 그 날짜가 한적하다고
   * 읽고 눌렀는데 다른 날로 시작하면 카드가 한 말이 지켜지지 않는다.
   *
   * <p>전역 상태에 미리 쓰지 않고 라우터 state로 넘긴다. 아직 아무것도 확정하지 않은
   * 시점이라, 조건 화면에서 되돌아 나가면 흔적이 남지 않아야 한다.
   */
  function planTripAt(spot: QuietSpot) {
    setOpenedSpot(null)
    navigate('/plan', {
      state: { region: spot.region, startDate: spot.date, seedPlaceId: spot.place.id },
    })
  }

  /**
   * 이번 주 한적한 곳. <b>지역을 가리지 않는다.</b>
   *
   * <p>홈이 지금까지는 지역을 하나 골라야 무엇이든 보여줄 수 있었다. 지역이 일곱이 되면서
   * 그 방식은 "일곱 중 하나만 보여주고 나머지는 숨기는" 화면이 됐다 —
   * 넘겨 가며 보여주는 장치를 두었지만 한 바퀴가 98초라 사실상 안 도는 것과 같았다.
   *
   * <p>⚠️ <b>받은 순서를 그대로 그린다.</b> 서버가 매번 가중 무작위로 고르고, 그 순서가
   * 곧 뽑힌 순서다. 화면이 점수로 다시 줄 세우면 최고점이 언제나 1등이 되어
   * 분산 장치가 통째로 죽는다 — 2026-08-26에 대안 추천에서 그렇게 죽어 있었다.
   *
   * <p>⚠️ <b>다시 부르지 않는다.</b> 화면이 다시 그려질 때마다 새로 뽑으면 목록이
   * 제멋대로 바뀐다. 이 화면에 머무는 동안은 처음 받은 셋이 그대로 선다.
   */
  const [quietSpots, setQuietSpots] = useState<QuietSpotState>({ phase: 'loading' })

  /**
   * 띠가 보이는 창의 폭. <b>끝까지 밀었을 때 오른쪽이 비지 않게</b> 하는 데 쓴다.
   *
   * <p>카드 수만큼 한 칸씩 미는 방식이었는데, 마지막 자리에서 카드 두어 장만 남아
   * <b>오른쪽에 빈 자리가 크게 남았다.</b> 옮기는 거리를 "띠 전체 폭 − 창 폭"으로
   * 막으면, 끝까지 민 순간 마지막 카드의 오른쪽 변이 창의 오른쪽 변에 딱 붙는다.
   *
   * <p>창 폭은 화면마다 다르므로(390 · 430 · md) 재서 쓴다.
   */
  const [stripWidth, setStripWidth] = useState(0)
  const stripWindow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = stripWindow.current
    if (!element) {
      return
    }
    // clientWidth는 좌우 패딩(그림자 자리 px-1, 8px)을 포함한다. 카드가 실제로 서는 폭은 그만큼 좁다
    const measure = () => setStripWidth(element.clientWidth - 8)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [quietSpots.phase])

  useEffect(() => {
    const controller = new AbortController()
    fetchQuietSpots(QUIET_SPOT_COUNT, controller.signal)
      .then((spots) => setQuietSpots({ phase: 'loaded', spots }))
      .catch((error: unknown) => {
        // 화면을 떠나며 끊은 요청은 실패가 아니다. 오류 문구를 세우면 있지도 않은 고장을 알린다.
        if (controller.signal.aborted) {
          return
        }
        setQuietSpots({ phase: 'error', message: messageOf(error) })
      })
    return () => controller.abort()
  }, [])

  /*
   * 띠를 얼마나 옮길지. <b>한 칸씩 옮기되 마지막은 창 끝에 맞춰 멈춘다.</b>
   *
   * {@code maxShift}가 그 멈추는 자리다 — 띠 전체 폭에서 창 폭을 뺀 만큼만 옮기면
   * 마지막 카드의 오른쪽 변이 창의 오른쪽 변과 만난다. 그래서 마지막 한 칸은
   * 다른 칸보다 <b>덜 움직인다</b>. 진행 막대의 칸 수도 이 값에서 나온다.
   */
  const stripCount = quietSpots.phase === 'loaded' ? quietSpots.spots.length : 0
  const stripStep = QUIET_CARD_W + QUIET_CARD_GAP
  const stripTotal = stripCount * QUIET_CARD_W + Math.max(stripCount - 1, 0) * QUIET_CARD_GAP
  const stripMaxShift = Math.max(stripTotal - stripWidth, 0)
  /** 마지막으로 갈 수 있는 자리. 0이면 넘길 것이 없다(카드가 창 안에 다 들어온다) */
  const stripLast = Math.ceil(stripMaxShift / stripStep)
  const stripShift = Math.min(stripIndex * stripStep, stripMaxShift)

  return (
    // 아래 고정 막대를 걷어내면서 그것을 피하려던 여백(pb-26)도 함께 뺐다.
    <div className="relative flex min-h-svh flex-col pb-10">
      {/*
        ■ 첫 화면 배경 사진 (2026-09-02) — <b>모바일만</b>

        걷어낸 시안 wash 자리에 사진이 들어온다. 화면이 무슨 이야기를 하는 곳인지
        글을 읽기 전에 말하는 것이 색 한 겹보다 사진 한 장이 낫다.

        <p>두 겹이다. 아래가 사진, 위가 <b>바탕색으로 지우는 막</b>이다 —
        위에서 아래로 갈수록 진해져 마지막에는 완전한 {@code --c-bg}가 되므로,
        사진이 어디서 끝나는지 경계가 보이지 않는다. 막을 안 두면 파란 하늘 위에
        잉크 글자가 얹혀 대비가 무너진다(로고·"오늘, 어떤 여행을 원하세요?").

        <p>막의 색은 <b>토큰</b>이다({@code from-bg/…}). 여기에 hex를 박으면
        바탕색을 바꿀 때 사진 아래만 옛 색으로 남는다.

        <p>⚠️ 뿌리에 {@code overflow-hidden}을 걸지 않는다 — sticky 헤더가 깨진다.
        이 층은 화면 폭을 넘지 않으므로 가릴 것도 없다.
      */}
      <span
        className="pointer-events-none absolute inset-x-0 top-7 h-[380px] bg-cover bg-center bg-no-repeat lg:hidden"
        /*
          ⚠️ 시작이 0이 아니라 <b>헤더의 절반(28px)</b>이다 — 로고와 반만 겹친다.
          그 자리에 사진의 윗변이 그대로 서면 <b>가로줄 하나</b>가 그어지므로,
          마스크로 첫 36px을 투명에서 불투명으로 띄운다. 위아래 어디에도 경계가 없다.
        */
        style={{
          backgroundImage: "url('/images/hero-sea.jpg')",
          maskImage: 'linear-gradient(180deg, transparent 0, #000 36px)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 36px)',
        }}
        aria-hidden="true"
      />
      <span
        className="from-bg/45 via-bg/85 to-bg pointer-events-none absolute inset-x-0 top-7 h-[380px] bg-gradient-to-b lg:hidden"
        aria-hidden="true"
      />

      {/*
        같은 사진의 <b>넓은 화면판</b> (2026-09-02).

        <p>파일을 나눈 이유: 모바일이 쓰는 1100px 판은 1440px 화면에서 늘어나 흐려지고,
        1920px 판은 190KB라 <b>휴대폰 첫 화면에 얹을 무게가 아니다</b>(모바일 판은 84KB).
        {@code hidden lg:block}이 짝이라 각 화면은 자기 것 하나만 받는다.

        <p>시작이 {@code top-14}인 것은 <b>헤더 높이</b>다. lg의 헤더는 흰 막대라
        사진 위쪽을 어차피 가리므로, 가려질 부분을 애초에 그리지 않는다.
        모바일과 달리 마스크가 필요 없는 이유이기도 하다 — 윗변이 막대 뒤에서 시작한다.
      */}
      <span
        className="pointer-events-none absolute inset-x-0 top-14 hidden h-[420px] bg-cover bg-center bg-no-repeat lg:block"
        style={{ backgroundImage: "url('/images/hero-sea-wide.jpg')" }}
        aria-hidden="true"
      />
      <span
        className="from-bg/45 via-bg/85 to-bg pointer-events-none absolute inset-x-0 top-14 hidden h-[420px] bg-gradient-to-b lg:block"
        aria-hidden="true"
      />
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
      {/*
        ■ 모바일에서는 <b>막대가 없다</b> (2026-09-02)

        흰 면·경계선·sticky를 걷고 로고와 메뉴만 바탕 위에 뜬다. 시안이 그렇고,
        바탕 wash를 지운 뒤로는 <b>흰 막대가 회백 바탕 위에 뜬 또 하나의 면</b>으로
        보여 첫 화면에 층이 하나 더 생겼다.

        <p>⚠️ <b>sticky도 함께 뗀다.</b> 투명한 채로 붙여 두면 아래 내용이 로고 뒤로
        지나가 글자가 겹친다 — 시안 화면을 스크롤해 찍은 그림에서 실제로 그렇게 보였다.
        모바일에서는 헤더가 함께 밀려 올라가고, 메뉴는 위로 올려 연다.

        <p><b>lg는 예전 그대로다</b> — 흰 막대에 경계선, 화면 위에 붙는다.
        넓은 화면은 세로가 넉넉해 막대 하나를 늘 띄워 둘 여유가 있고,
        Layout 헤더와 모양이 같아야 화면을 오갈 때 헤더가 안 움직인다.
      */}
      <header className="relative top-0 z-10 h-14 bg-transparent lg:sticky lg:border-b lg:border-line lg:bg-surface">
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
            <Link to="/" className="flex-none no-underline" aria-label="PEAKOFF 처음으로">
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

        "지금 한적한 곳"은 걷어냈다. 위 카드의 "가장 한적한 곳"과 <b>같은 목록에서
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
      <div className={`${SHELL} relative px-4.5 md:px-6 lg:px-8 lg:pt-8`}>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-4">
          {/*
            ■ 화면이 자기소개를 먼저 한다 (2026-09-02)

            지금까지 홈의 첫 글자는 곧바로 <b>진입 카드의 제목</b>이었다. 그 둘은
            <b>사용자가 하는 말</b>("가고 싶은 곳이 있어요")이라, 정작 이 서비스가 무엇을
            하는 곳인지는 화면 어디에서도 말하지 않았다 — 심사위원이 URL로 처음 닿는 화면이다.

            <p>⚠️ <b>"실시간"이라 하지 않는다.</b> 공사 데이터는 예측·통계값이다
            (CLAUDE.md 절대 규칙). "붐빔을 줄이고"는 우리가 하는 일이라 시점을 주장하지 않는다.

            <p>둘째 줄만 브랜드색이다. 배경 전용인 brand가 아니라 글자용 brand-deep을 쓴다 —
            회백 바탕 위에서 대비가 본문 기준(4.5:1)을 크게 넘는다.

            <p>⚠️ <b>모바일에만 세운다.</b> 시안은 모바일 화면이고 데스크톱은 손대지 않는다 —
            lg에서는 진입 카드 둘이 한 줄에 나란히 서서 첫 화면이 이미 꽉 차 있다.

            <p>■ <b>두 줄 선언에서 한 줄 물음으로</b> (2026-09-02)

            "여행의 붐빔을 줄이고 / 당신의 여행은 더 편하게."였다. <b>서비스가 자기 소개를
            하는 문장</b>이라 바로 아래 두 카드(사용자가 하는 말)와 화자가 어긋났고,
            25px 두 줄이 첫 화면의 4분의 1을 썼다. 물음으로 바꾸면 <b>아래 두 카드가
            그 물음의 답</b>이 되어 세 덩이가 한 문답으로 읽힌다.
          */}
          <h1 className="text-fg m-0 -mb-3.5 px-1 text-[15px] leading-[1.5] font-semibold tracking-[-0.01em] lg:hidden">
            오늘, 어떤 여행을 원하세요?
          </h1>

          {/* 2. 진입점 ① 직접 짜기 — 이 서비스의 원래 흐름 */}
          {/*
            ⚠️ 아래 {@code -mb-4}는 <b>두 문 사이만</b> 좁히는 값이다 (모바일).
            둘은 <b>한 갈림길의 두 선택지</b>라 다른 덩이(박스들) 사이와 같은 간격으로
            떨어뜨리면 서로 남남으로 보인다. 덩이 사이는 16px, 두 문 사이는 그 절반인 8px.
            lg에서는 두 문이 한 줄에 나란히 서므로 되돌린다.
          */}
          <div className={`${CELL} -mb-2 lg:mb-0 lg:col-span-6`}>
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
            <div className="group bg-fg relative w-full overflow-hidden rounded-[24px] px-4.5 pt-4.5 pb-4.5 md:px-6 md:pt-6.5 md:pb-6 text-left text-white shadow-[0_8px_26px_rgb(42_62_84/0.18)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgb(42_62_84/0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
          {/*
            ■ 모바일만: 그림글자가 <b>제목 위</b>에 홀로 선다 (2026-09-02)

            원 배경을 두른 타일을 왼쪽에 세워 봤다가 걷어냈다. 타일은 <b>글이 쓸 폭을
            가져가서</b> 좁은 화면에서 본문이 석 줄로 접혔고, 채운 원이 그림글자보다 먼저
            눈에 들어와 <b>배경이 주인공</b>이 됐다. 배경을 지우고 글자 위로 올리면
            폭은 온전히 글의 것이 되고, 두 문의 그림글자가 <b>같은 자리에 둘</b> 서서
            "고르는 자리"라는 것은 그대로 알린다.

            <p>⚠️ <b>lg는 예전 그대로다</b> — 위의 그림글자가 숨고({@code lg:hidden})
            제목 안의 것이 되살아난다(제목 속 {@code hidden lg:inline}).
            시안은 모바일 화면이고 데스크톱은 손대지 않는다.
          */}
          {/*
            ■ 카드 오른쪽의 <b>겹친 동그라미 사진</b> (2026-09-02)

            어두운 면에 글자만 있던 카드에 이 문이 데려갈 곳을 한 장 얹는다.
            <b>홈의 다른 박스는 이미 사진으로 말하고 있어</b>(이번 주 한적한 곳 ·
            다른 사람들의 여행) 진입 카드 둘만 글자뿐이면 같은 화면에서 문법이 갈린다.

            <p>네모난 썸네일로 넣었다가 바꿨다 — 카드 안에 <b>프로필 사진</b>이 하나
            들어앉은 꼴이었고, 사진이 글의 폭까지 가져가 본문이 넉 줄로 접혔다.
            모양과 자리는 {@code .entry-photo}에 있다(index.css) —
            <b>걷어냈던 글로우 서사의 원</b>이 있던 자리를 그대로 쓴다.

            <p>⚠️ <b>두 폭 모두 적용한다.</b> 넓은 화면에서는 원을 함께 키운다 —
            같은 반지름을 두면 큰 카드 위에서 사진이 조각으로 보인다.

            <p>색은 바깥에서 넘긴다. 어두운 면과 흰 면이 서로 다른 색으로 스며들어야 해서다.
          */}
          <span
            aria-hidden="true"
            className="entry-base"
            style={{ '--echo': 'rgb(255 255 255 / 0.055)' } as CSSProperties}
          />
          <span
            aria-hidden="true"
            className="entry-photo"
            style={
              {
                '--photo-src': "url('/images/card-plan.jpg')",
                '--photo-fade': 'var(--c-fg)',
              } as CSSProperties
            }
          />

          <span className="relative flex flex-col gap-1.5 lg:gap-3">
            {/*
              배경 없는 맨 그림글자. 제목이 같은 말을 하므로 읽어주지 않는다.

              <p>2026-09-02에 <b>넓은 화면도 이 자리</b>로 모았다. 제목 앞에 붙어 있던
              쪽을 지웠는데, 두 폭이 다른 문법을 쓰면 <b>같은 카드가 아닌 것</b>처럼 보인다.
            */}
            <span className="text-[20px] leading-none lg:text-[24px]" aria-hidden="true">
              🧭
            </span>
            <span className="flex min-w-0 flex-col gap-1.5 lg:w-full lg:gap-3">
            {/*
              킥커(PLAN MY TRIP)를 걷어냈다 (2026-08-30).

              <b>제목이 사용자의 말이 되면서 화자가 갈렸다.</b> 영어 킥커는 서비스가 하는 말인데
              바로 아래 "가고 싶은 곳이 있어요."는 사용자가 하는 말이라, 한 카드에서
              두 사람이 번갈아 말하는 꼴이 됐다. 제목이 행동 이름("코스 짜기")이던 때는
              둘 다 서비스의 말이라 안 걸렸다.

              <p>덧붙여 UI 텍스트는 한국어라는 규칙과도 어긋났고, 제목이 이미 자기 무게를
              지고 있어 <b>지워도 잃는 정보가 없다.</b>
            */}
            {/*
              ■ 제목은 <b>사용자가 하는 말</b>이다 (2026-08-30)

              두 카드의 제목이 <b>사용자의 1인칭 발화</b>다. 서비스가 무엇을 하는지가 아니라
              <b>내가 어느 쪽인지</b>를 말하게 두었다 — 갈림길에서 고르는 자리라
              고르는 사람의 말로 적는 편이 자기 쪽을 찾기 쉽다.

              <p>제목이 곧 문패이므로 <b>길 안내를 제목이 직접 한다.</b> 예전에는 제목이
              행동 이름("코스 짜기")이라 누구를 위한 문인지 말하지 못했고, 그 일을 본문이
              혼자 맡고 있었다.

              <p>⚠️ <b>이 문구는 한 번 폐기됐던 것이다.</b> 상황 제목으로 세 번 고쳤다가
              (내가 고른 여행 → 가고 싶은 곳이 있어요 → 이미 계획이 있어요) 전부 물렸고,
              그때 사유가 <b>"필요한 것을 적게 말했다"</b>였다 — 이 문을 열면 나오는 것은
              장소를 담는 화면이 아니라 <b>지역·날짜·기간</b>을 정하는 화면이다.

              <p>알고도 되돌린 결정이다. 두 카드를 <b>한 쌍의 발화</b>로 맞추는 값이
              그 어긋남보다 크다고 보았다. 대신 <b>본문이 그 구멍을 메워야 한다</b> —
              장소만 정한 사람이 날짜부터 만나도 놀라지 않게.

              <p>⚠️ 오른쪽 본문 "뜻밖의 여행을 PEAKOFF가 찾아드려요"는 <b>경주를 모르는 사용자의
              문패</b>다. 제목이 그 일을 나눠 맡게 됐지만 지우지 말 것 —
              CLAUDE.md 필수 기능 6번이 이 진입점을 둔 이유가 그 사람이다.
            */}
            {/*
              ■ 제목 옆의 그림글자 (2026-09-01 · 자리는 2026-09-02에 옮겼다)

              두 문이 <b>한 쌍의 발화</b>라는 것을 글자를 읽기 전에 알린다 — 나침반은
              방향을 이미 아는 사람, 주사위는 매번 다른 답이 오는 쪽(가중 무작위)이다.
              둘 다 이 문이 실제로 하는 일을 가리키므로 장식이 아니다.

              <p><b>{@code aria-hidden}이다.</b> 제목 글자가 이미 같은 말을 하고 있어,
              읽어주면 "나침반 가고 싶은 곳이 있어요"가 된다.

              <p>⚠️ <b>모바일에서만</b> 제목 앞의 인라인 글자가 <b>왼쪽 타일</b>로 간다.
              크기를 제목에 맞춰 재던 문제(색이 차 있어 같은 크기라도 더 무겁게 보인다)가
              타일 안에서는 사라진다 — 타일이 제 크기를 갖고 제목은 제 폭을 온전히 쓴다.
              lg에서는 아래 {@code 0.9em} 그대로 제목 앞에 선다.
            */}
              <span className="text-[18px] leading-[1.3] font-bold tracking-[-0.025em] lg:text-[26px]">
                가고 싶은 곳이 있어요.
              </span>
            {/*
              "그대로"가 <b>우리가 당신 것을 무르지 않는다</b>는 약속이다. 서비스가 하는 일이
              여행을 대신 정하는 것이 아니라 붐비는 부분만 비껴 주는 것이라,
              두 진입 카드 다 "당신 것은 그대로 둔다"로 말한다.

              <p>⚠️ 앞말이 <b>"가고 싶은 곳은"에서 "계획은"으로</b> 바뀌었다 (2026-08-30).
              제목이 "가고 싶은 곳이 있어요."가 되면서 <b>같은 다섯 음절이 두 줄 연속</b>으로
              나왔다 — 26px 굵은 글씨 바로 아래라 눈에 띄었다.

              <p>바꾸면서 오히려 이어졌다. 진단 화면의 두 회피 경로가 같은 문형으로 받는다 —
              "일정은 그대로, 더 여유로운 날을" · <b>"계획은 그대로</b>, 더 여유로운 여행지를".
              이제 홈·진단이 <b>한 낱말</b>로 이어진다. 예전에는 홈만 다른 말을 썼다.
            */}
              {/*
                ■ 본문과 버튼이 <b>한 줄</b>이다 (모바일만)

                버튼이 본문 <b>아래</b>에 서면 카드가 네 켜(제목·본문 두 줄·버튼)만큼 길어지고
                본문 오른쪽은 통째로 빈다. 옆에 세우면 그 빈 자리가 버튼 자리가 되어
                <b>같은 내용이 한 켜 낮은 카드</b>에 들어간다.

                <p>2026-09-02에 <b>넓은 화면도 같은 줄</b>로 모았다. lg만 본문 아래 버튼이면
                같은 카드가 폭에 따라 다른 물건으로 보인다.
              */}
              <span className="flex items-end gap-2.5 lg:gap-4">
                <span className="min-w-0 flex-1 break-keep text-[11.5px] leading-[1.55] text-white/70 md:text-[13px] lg:break-normal lg:text-white/60 lg:text-sm">
                  계획은 그대로, <br />
                  붐비는 순간만 PEAKOFF가 도와드려요.
                </span>
            {/* 이 링크가 유일한 문이다. button+navigate 대신 Link라 새 탭으로도 열린다 */}
            {/*
              보이는 글자는 짧게 두되 <b>접근 이름에는 목적지를 담는다.</b>
              두 카드의 문이 똑같이 "시작하기"라, 링크만 훑는 사람에게는
              "시작하기 · 시작하기"로 들려 어느 쪽이 무엇인지 알 수 없었다.
              눈으로 보는 사람은 바로 위 제목이 문맥을 주지만, 링크 목록에는 그 제목이 없다.
            */}
              {/*
                ⚠️ <b>두 폭 모두 오른쪽 끝이다.</b> 버튼이 글머리에 붙으면 카드 오른쪽 아래가
                통째로 빈다. 오른쪽 끝에 세우면 읽는 방향(왼쪽 위 → 오른쪽 아래)의
                끝에 문이 놓인다.
              */}
              {/*
                ■ 이 카드의 문만 <b>유리 알약</b>이다 (2026-09-02)

                사진 위에 얹히는 유일한 버튼이라서다. 채운 틸은 사진의 색과 부딪혀
                <b>사진에서 오려낸 스티커</b>처럼 떠 보였다. 시안도 이 자리만 테두리형이다.

                <p>⚠️ <b>투명하되 충분히 어둡다({@code bg-fg/80}).</b> 알약 바탕을 실제로
                재보면 흰 글자가 <b>9.0:1(390px) · 9.3:1(1280px)</b>이다 — 12.5px 글자라
                4.5:1을 넘겨야 하는 자리다. <b>더 비치게 두지 말 것.</b> 뒤가 비치는 느낌은
                {@code backdrop-blur}가 낸다.

                <p>사진이 바뀌면 이 값도 바뀐다. 밝은 사진을 넣을 때는 다시 재고,
                모자라면 알약을 더 어둡게 하지 말고 <b>사진 쪽을 가라앉힌다</b>
                ({@code .entry-photo}의 opacity) — 버튼만 어두워지면 유리가 아니라 검은 딱지가 된다.

                <p>⚠️ 잴 때는 <b>흰 테두리와 둥근 끝을 피해서</b> 알약 바탕만 본다.
                가장자리를 포함해 재면 테두리의 안티에일리어싱이 섞여 2.8:1 같은 값이 나온다 —
                글자가 실제로 얹히는 면이 아니다.

                <p>오른쪽 카드는 그대로 채운 틸이다. 그쪽 버튼은 흰 면 위에 서므로
                같은 문제가 없고, 두 문 중 <b>어느 쪽도 곁다리가 아니어야</b> 한다.
              */}
              <Link
                to="/plan"
                aria-label="코스 직접 짜기 시작하기"
                  className="bg-fg/80 group-hover:bg-fg/95 hover:bg-fg/95 border border-white/45 text-white backdrop-blur-[3px] rounded-full lg:rounded-ui inline-flex h-9 flex-none cursor-pointer items-center gap-1.25 self-end px-3.5 text-[12.5px] font-semibold whitespace-nowrap no-underline transition-colors lg:h-11.5 lg:gap-1.75 lg:px-5 lg:text-[15.5px]"
                >
                  시작하기
                  {/* 카드에 손을 올리면 화살표가 함께 나아가 "여기를 누르세요"를 가리킨다 */}
                  <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                </Link>
              </span>
            </span>
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
          <div className="group border-brand/40 from-brand-tint to-surface shadow-rest relative w-full overflow-hidden rounded-[24px] bg-linear-to-br border-[1.5px] px-4.5 pt-4.5 pb-4.5 md:px-6 md:pt-6.5 md:pb-6 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex-1 lg:px-8 lg:pt-9">
            {/*
              왼쪽 카드와 <b>같은 장치, 다른 선</b>이다. 곡선까지 같으면 두 문이 한 장을
              복사해 붙인 것으로 보인다 — 모양은 {@code -alt}가 바꾼다(index.css).

              <p>⚠️ <b>이 카드에는 아래 결(회색 물결)이 없다.</b> 대신 바탕 자체가 옅은 틸에서
              흰색으로 흐른다 — 결을 한 겹 더 얹는 것보다 면 전체가 물드는 편이 조용하고,
              테두리·버튼의 틸과 한 기운으로 묶인다.
            */}
            <span
              aria-hidden="true"
              className="entry-photo entry-photo-alt"
              style={
                {
                  '--photo-src': "url('/images/card-discover.jpg')",
                  '--photo-fade': 'var(--c-surface)',
                } as CSSProperties
              }
            />

            {/* 왼쪽 카드와 같은 규칙 — 모바일은 제목 위 맨 그림글자. 주석은 그쪽에 있다 */}
            <span className="relative flex flex-col gap-1.5 lg:gap-3">
              <span className="text-[20px] leading-none lg:text-[24px]" aria-hidden="true">
                🎲
              </span>
              <span className="flex min-w-0 flex-col gap-1.5 lg:w-full lg:gap-3">
              {/* 킥커(DISCOVER A TRIP)를 걷어냈다. 왼쪽 카드와 같은 이유다. */}
              {/*
                왼쪽과 같은 규칙 — 제목은 <b>사용자가 하는 말</b>이다.

                "발견할래요"인 이유: 이 문이 하는 일은 <b>대신 정해 주는 것이 아니다.</b>
                설문 두 문항을 받아 <b>초안</b>을 내놓을 뿐이고, 그 뒤 편집·진단·교체는
                사용자가 한다. "맡길게요" 같은 말로 두면 여행을 통째로 넘기는 것처럼 읽혀
                <b>첫 코스는 사용자의 의도를 존중한다</b>는 설계 원칙과 어긋난다.

                <p>"추천받을게요"도 아니다. 이 문은 <b>매번 다른 코스</b>를 내놓는데
                (가중 무작위) "추천"은 늘 같은 답이 오는 것처럼 들린다.

                ⚠️ 한때 "오늘의 여행 발견하기"였다. <b>오늘이 아니다</b> — 설문은 날짜를
                고르게 하고 예측 창이 앞으로 24~29일이라 대부분 미래 날짜다. 게다가 이 화면에는
                진짜 "오늘"이 따로 있다(아래 "오늘의 경주"는 오늘의 혼잡을 말한다).
                한 화면에서 같은 말이 두 뜻으로 쓰이면 어느 쪽도 믿기 어려워진다.
              */}
              {/* 왼쪽 카드와 같은 규칙이다. 그림글자 주석은 그쪽에 있다 */}
                <span className="text-fg text-[18px] leading-[1.3] font-bold tracking-[-0.025em] lg:text-[26px]">
                  새로운 여행을 발견할래요.
                </span>
              {/*
                ⚠️ "뜻밖의 여행을 PEAKOFF가 찾아드려요"가 <b>경주를 모르는 사용자를 위한 문패</b>다.
                제목이 행동 이름이라 누구를 위한 문인지 말하지 않으므로, 그 일을 이 문장이
                혼자 맡는다 — 지우면 그 사람이 왼쪽 문으로 들어가 빈 검색창 앞에서 처음 막힌다.

                앞 문장 "날짜와 취향만"의 <b>"만"</b>도 같은 일을 한다. 가져올 것이 적다고
                말해 두어야 "나는 아직 아무것도 못 정했는데"라는 사람이 이쪽을 고른다.

                <p>⚠️ <b>폭 상한(max-w-62.5)을 걷어냈다.</b> 두 줄은 이미 <code>&lt;br/&gt;</code>이
                직접 가르므로 상한이 하는 일은 <b>의도한 줄을 한 번 더 접는 것</b>뿐이다.
              */}
                {/* 왼쪽 카드와 같은 규칙 — 본문과 버튼이 한 줄이다. 주석은 그쪽에 있다 */}
                <span className="flex items-end gap-2.5 lg:gap-4">
                  <span className="text-muted min-w-0 flex-1 break-keep text-[11.5px] leading-[1.55] md:text-[13px] lg:break-normal lg:text-sm">
                    날짜와 취향만 알려주세요. <br />
                    뜻밖의 여행을 PEAKOFF가 찾아드려요.
                  </span>
              {/*
                왼쪽 카드와 같은 노란 알약이다. 회색 테두리 알약은 "준비 중"의 표현이었다 —
                눌러도 되는 버튼을 비활성처럼 그려두면 사용자는 없는 기능으로 읽는다.
                두 문이 같은 모양의 버튼을 갖는 것이 맞다. 둘 다 실제로 열리니까.
              */}
              {/*
                ■ 이 문도 <b>비치는 알약</b>이다 (2026-09-02)

                채운 틸이 사진 위에서 오려 붙인 스티커처럼 뜨는 것은 왼쪽 카드와 같다.
                다만 이쪽은 <b>밝은 면</b>이라 어둡게 깔 수 없어, 브랜드 틸을 그대로 두고
                <b>불투명도만 내렸다.</b> 테두리는 카드 바탕과 같은 색({@code brand-tint})이라
                알약이 카드에서 오려낸 조각처럼 보인다.

                <p>⚠️ <b>86%보다 더 비치게 두지 말 것.</b> 이 알약의 글자는 잉크색인데,
                뒤의 사진이 어두운 자리(파도 그늘)에서 함께 어두워져 대비가 무너진다 —
                재보면 70%에서 <b>3.0:1</b>, 80%에서 4.1:1, 86%에서 <b>4.6:1</b>이다.
                12.5px 글자라 4.5:1이 하한이다.

                <p>{@code backdrop-blur}와 {@code backdrop-brightness}가 그 4.6:1을 만든다 —
                흐리면 사진의 명암이 알약 뒤에서 <b>평평해지고</b>, 한 단계 밝히면 가장
                어두운 자리가 올라온다. 둘 다 없으면 같은 86%에서 4.0:1로 떨어진다.
              */}
                <Link
                  to="/recommend"
                  aria-label="새로운 코스 발견하기 시작하기"
                    className="bg-brand/86 group-hover:bg-brand hover:bg-brand border border-brand-tint text-fg backdrop-blur-[10px] backdrop-brightness-125 rounded-full lg:rounded-ui inline-flex h-9 flex-none cursor-pointer items-center gap-1.25 self-end px-3.5 text-[12.5px] font-semibold whitespace-nowrap no-underline transition-colors lg:h-11.5 lg:gap-1.75 lg:px-5 lg:text-[15.5px]"
                  >
                    시작하기
                    <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                  </Link>
                </span>
              </span>
            </span>
          </div>
        </div>

        {/*
          3. 이번 주 한적한 곳 — <b>지역을 가리지 않는다.</b>

          여기 있던 "오늘의 OO"와 "이번 주 한적한 날"을 걷어낸 자리다. 둘 다 <b>지역 하나</b>를
          말하는 박스였고, 여러 지역을 보여주려고 14초마다 넘기는 장치를 달았는데
          지역이 일곱이 되면서 한 바퀴가 98초가 됐다 — 홈에 그만큼 머무는 사람은 없으므로
          사실상 "경주만 보여주는 화면"이었다.

          반대로 갔다. 지역을 고르는 대신 <b>일곱 곳을 한 번에 훑어</b> 이번 주 한적할 곳을
          건져 올린다. 어디로 갈지 안 정한 사람에게 서비스가 먼저 말을 거는 자리다.

          ⚠️ <b>점수순으로 다시 세우지 않는다.</b> 서버가 가중 무작위로 고른 순서 그대로 그린다.
          홈에 뜨는 곳이 늘 같으면 그곳이 새로운 혼잡지가 되는데, 그것도 이 서비스가
          가장 많이 노출하는 화면에서다.
        */}
        <section
          /*
            ■ 데이터 줄은 <b>넉 칸씩 셋</b>이다 (2026-08-31)

            {@code lg:self-start}를 뺐다. 그 값은 "내용만큼만 키운다"는 뜻이라 박스마다
            높이가 제각각이었는데, 셋이 나란히 선 줄에서는 <b>아랫변이 안 맞는 것</b>이
            더 눈에 띈다. 격자 기본값(stretch)으로 두면 셋이 가장 큰 것에 맞춰 늘어난다.
          */
          className={`${CARD_RAISED} flex flex-col gap-3.5 p-4.5 lg:col-span-4 lg:gap-3 lg:p-5.5`}
        >
          <div className="flex flex-col gap-0.75 px-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className={SECTION_TITLE}>이번 주 한적한 곳</h2>
              {/*
                ⚠️ <b>오늘 날짜다. 목록이 오늘의 것이라는 뜻이 아니다.</b>
                여기 서는 곳들은 앞으로 이레 사이에 한적한 곳이고, 각자 한적한 날이 따로 있다.
                이 줄이 말하는 것은 <b>언제 계산한 값인가</b>다 — 공사 예측은 하루 한 번
                갱신되므로 같은 목록도 내일 다시 열면 값이 달라진다.

                <p>toISOString은 UTC라 저녁에 날짜가 하루 밀린다. 로컬 기준 today()를 쓴다.
              */}
              <span className="text-hint text-xs">{formatKoreanDate(today())}</span>
            </div>
            <span className="text-hint text-[12.5px]">
              눌러서 어떤 곳인지 볼 수 있어요
            </span>
          </div>

          {quietSpots.phase === 'loading' && (
            /*
              뼈대를 카드와 <b>같은 높이로</b> 세운다. 낮게 두면 값이 들어오는 순간
              박스가 아래로 늘어나면서 그 아래 내용이 통째로 밀린다.
            */
            <div className="overflow-hidden lg:overflow-visible">
              <div
                className={QUIET_STRIP}
                style={{ '--strip-x': '0px' } as CSSProperties}
              >
                {Array.from({ length: QUIET_SPOT_COUNT }, (_, index) => (
                  <div
                    key={index}
                    className="bg-bg lg:rounded-card h-[130px] w-[120px] flex-none animate-pulse rounded-[16px] lg:h-21 lg:w-full"
                  />
                ))}
              </div>
            </div>
          )}

          {quietSpots.phase === 'error' && (
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              {quietSpots.message}
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          )}

          {quietSpots.phase === 'loaded' && quietSpots.spots.length > 0 && (
            /*
              창. 띠는 이 폭보다 넓고, 넘치는 부분은 잘린다 —
              <b>잘려 보이는 옆 카드</b>가 "더 있다"는 유일한 안내다.
              lg에서는 창을 풀어 목록이 그대로 보이게 한다.
            */
            <div
              /*
                ⚠️ 음수 마진 + 같은 크기의 패딩은 <b>그림자가 설 자리</b>다.
                창이 overflow-hidden이라 카드의 그림자도 함께 잘리는데, 여백 없이
                딱 맞추면 위아래 그림자가 사라져 카드가 흰 면에 다시 묻힌다.
                바깥에서 본 크기는 그대로다.
              */
              ref={stripWindow}
              className="-mx-1 -my-2 overflow-hidden px-1 py-2 lg:mx-0 lg:my-0 lg:overflow-visible lg:p-0"
            >
              <div
                className={`${QUIET_STRIP} ${
                  // 손가락을 따라오는 동안에는 전환을 끈다. 켜두면 손끝보다 늦게 따라온다
                  stripDrag === 0 ? 'transition-transform duration-300 ease-out' : ''
                } motion-reduce:transition-none`}
                /*
                  ⚠️ 옮기는 값을 <b>인라인 transform으로 주지 않는다.</b> 인라인이 클래스를
                  이기므로 넓은 화면의 {@code lg:translate-x-0}이 무력해진다.
                  변수만 넘기고 <b>쓸지 말지는 클래스가 정한다.</b>
                */
                style={
                  {
                    '--strip-x': `${-stripShift + stripDrag}px`,
                    '--quiet-card-w': `${QUIET_CARD_W}px`,
                  } as CSSProperties
                }
                onTouchStart={(event) => {
                  const touch = event.touches[0]
                  strip.current = { x: touch.clientX, y: touch.clientY, dx: 0, axis: '' }
                }}
                onTouchMove={(event) => {
                  const touch = event.touches[0]
                  const dx = touch.clientX - strip.current.x
                  const dy = touch.clientY - strip.current.y
                  // 6px을 넘어서야 축을 정한다. 그 전에는 어느 쪽인지 모른다
                  if (strip.current.axis === '' && Math.abs(dx) + Math.abs(dy) > 6) {
                    strip.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
                  }
                  if (strip.current.axis === 'x') {
                    /*
                      ⚠️ ref에도 같은 값을 적어 둔다. 손을 떼는 순간 읽어야 하는데,
                      state는 다시 그려진 뒤에야 갱신되므로 <b>빠르게 튕기면</b>
                      touchend가 아직 0인 값을 본다 — 그러면 넘어가지 않는다.
                    */
                    strip.current.dx = dx
                    setStripDrag(dx)
                  }
                }}
                onTouchEnd={() => {
                  const dx = strip.current.dx
                  // 40px을 넘게 밀었을 때만 한 장 넘어간다. 그보다 작으면 제자리로
                  if (Math.abs(dx) > 40) {
                    setStripIndex((index) =>
                      Math.min(Math.max(index + (dx < 0 ? 1 : -1), 0), stripLast),
                    )
                  }
                  setStripDrag(0)
                  strip.current.dx = 0
                  strip.current.axis = ''
                }}
              >
                {quietSpots.spots.map((spot) => (
                  <QuietSpotCard
                    key={spot.place.id}
                    spot={spot}
                    onOpen={() => setOpenedSpot(spot)}
                  />
                ))}
              </div>

              {/*
                ■ 어디쯤 보고 있는지 알리는 막대 (모바일만)

                끌기는 <b>화면에 보이지 않는 조작</b>이라 무엇이든 하나는 눈에 보여야 한다.
                단추(‹ ›)를 놓아 봤다가 막대로 바꿨다 — 단추는 <b>넘길 수 있다</b>는 것만
                말하고 <b>지금 어디인지</b>는 말하지 못한다. 막대는 둘 다 한다.

                <p>칸 수는 <b>넘길 수 있는 자리 수</b>다(카드 수가 아니다). 마지막 자리에서는
                카드 두 장이 함께 보이므로, 카드마다 한 칸씩 주면 끝까지 밀어도 막대가
                끝에 닿지 않는다.

                <p>누를 수 없다 — 자리를 알리는 표시이지 조작이 아니다.
                누를 수 있게 생기면 눌러 보게 되고, 4px짜리는 손가락으로 겨눌 수 없다.
              */}
              {stripLast > 0 && (
                <div
                  className="bg-fill mx-auto mt-3 h-1 w-16 overflow-hidden rounded-full lg:hidden"
                  aria-hidden="true"
                >
                  <div
                    className="bg-brand-deep h-full rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{
                      width: `${100 / (stripLast + 1)}%`,
                      transform: `translateX(${stripIndex * 100}%)`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {quietSpots.phase === 'loaded' && quietSpots.spots.length === 0 && (
            /*
              한적 등급인 곳이 한 곳도 없을 수 있다. <b>수를 채우려고 보통인 곳을 섞지
              않기 때문</b>이고, 그것이 이 목록의 이름을 지키는 방법이다.
              빈 칸으로 두지 않고 왜 비었는지 말한다 — 고장과 구분되어야 한다.
            */
            <p className="bg-bg text-hint rounded-card m-0 p-4 text-center text-[13px] leading-[1.6]">
              이번 주에는 한적한 곳을 찾지 못했어요.
              <br />
              날짜를 넉넉히 잡으면 여유로운 날이 보여요.
            </p>
          )}
        </section>

        {/*
          4. <b>비워 둔 칸.</b>

          채울 것이 정해져 있고(2026-09-02) 자리를 먼저 잡아 둔다. 나중에 채울 때
          양옆 박스의 폭을 다시 계산할 일이 없다 — 넷·넷·넷이 이미 서 있다.

          ⚠️ <b>좁은 화면에서는 그리지 않는다.</b> 한 줄로 쌓이는 자리에서 빈 흰 카드는
          자리를 맡아둔 것으로 읽히지 않고 <b>내용이 안 뜬 박스</b>로 읽힌다.
          넓은 화면에서는 옆에 형제가 있어 "세 칸 중 하나"로 보이지만, 위아래로 쌓이면
          그 문맥이 사라진다.
        */}
        <section
          className={`${CARD_RAISED} hidden p-4.5 lg:col-span-4 lg:block lg:p-5.5`}
          aria-hidden="true"
        />

          {/*
            5. 다른 사람들의 여행.

            옆 칸과 <b>같은 박스</b>에 담는다. 데이터 줄은 <b>넷 칸씩 셋</b>이고
            가운데는 채울 것을 기다리는 빈 칸이다. 예전에는 이쪽만 테두리 없이 배경 위에 떠 있어,
            나란히 놓인 두 덩이가 같은 층위로 읽히지 않았다. 홈의 데이터 줄은 박스 셋이다.

            이름이 한 번 "요즘 저장된 여행"으로 갔다가 돌아왔다 (2026-09-01).
            원래 이 이름이 서버의 "내 코스 빼기"와 짝이었는데 그 거르기가 사라졌고
            (저장한 사람만 자기 코스를 못 봤다 — SavedCourseService.recent 주석),
            이름만 남으니 내 코스가 섞여도 어색하지 않은 친숙한 쪽을 다시 골랐다.
            ⚠️ 그래서 이 이름은 이제 <b>거르기의 근거가 아니다.</b> 이 이름을 이유로
            서버에서 내 코스를 다시 빼지 말 것.

            <p>순서 주장도 하지 않는 이름이다 — 실제로 최신순이 아니라
            <b>한적 상위 절반에서 무작위</b>로 서고, 12초마다 갈린다(drawOtherCourses).
          */}
          <section
            /*
              ■ 높이를 줄에 맞춘다 (2026-08-31)

              {@code lg:self-start}가 있었다. "내용만큼만 키운다"는 뜻이었고, 옆이
              700px가 넘던 시절에는 <b>저장된 코스가 없을 때 이 칸이 통째로 흰 여백</b>이
              되는 것을 막아 주었다.

              <p>그 옆 칸이 사라졌다. 이제 나란히 서는 셋은 높이가 비슷하고,
              <b>셋의 아랫변이 안 맞는 것</b>이 흰 여백보다 눈에 띈다.
              격자 기본값(stretch)으로 되돌린다.

              칸을 채우려고 OTHER_COURSE_COUNT를 늘리는 것은 여전히 답이 아니다 —
              그 수는 실제 저장된 코스가 정하지 우리가 정하지 않는다.
            */
            className={`${CARD_RAISED} flex flex-col gap-3 p-4.5 lg:col-span-4 lg:p-5.5`}
          >
            <div className="flex flex-col gap-0.75 px-1">
              <h2 className={SECTION_TITLE}>다른 사람들의 여행</h2>
              <span className="text-hint text-[12.5px]">
                눌러서 어떤 코스인지 볼 수 있어요
              </span>
            </div>

            {others.length > 0 ? (
              /*
                region-fade는 <b>틀이 아니라 내용에</b> 붙는다 — 왼쪽 칸들과 같은 이유다.
                카드째 사라지면 12초마다 화면에 구멍이 뚫린 것으로 읽힌다.
              */
              <div
                className="region-fade grid grid-cols-1 gap-2.5 max-md:[&>*:nth-child(4)]:hidden md:grid-cols-2 lg:grid-cols-1"
                data-fading={othersFading}
              >
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

      {/*
        한적한 곳 펼쳐 보기. 주소와 소개글은 이때 <b>한 번만</b> 부른다 —
        목록에 미리 붙였다면 홈을 그릴 때마다 담긴 곳 수만큼 공사 호출이 나갔을 것이다.
      */}
      {openedSpot && (
        <PlaceDetailSheet
          placeId={openedSpot.place.id}
          placeName={openedSpot.place.name}
          categoryName={openedSpot.place.categoryName}
          imageUrl={openedSpot.place.imageUrl}
          quietness={openedSpot.quietness}
          level={openedSpot.level}
          levelLabel={openedSpot.levelLabel}
          onPlanTrip={() => planTripAt(openedSpot)}
          onClose={() => setOpenedSpot(null)}
        />
      )}

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
