import { useEffect, useRef, useState } from 'react'
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
      className="press bg-bg hover:bg-line/40 rounded-card flex w-full cursor-pointer items-center gap-3 border-0 p-2.5 text-left transition-colors"
    >
      <PlaceThumbnail name={spot.place.name} imageUrl={spot.place.imageUrl} size="md" />

      {/*
        ⚠️ <b>이름이 한 줄을 통째로 쓴다.</b> 처음에는 지역 알약과 배지를 이름과 같은 줄에
        두었는데, 390px에서 이름에 남는 폭이 140px뿐이라 <b>"여수 낭도리 공…"</b>으로 잘렸다.
        공사 이름은 원래 길다(강원특별자치도산림박물관·여수 낭도리 공룡발자국화석 산지) —
        <b>무엇인지 알아볼 수 없는 이름은 카드가 하는 일을 못 한다.</b>

        <p>지역을 아랫줄로 내리면 이름이 그만큼 넓게 쓴다. 그래도 넘치면 두 줄까지 간다 —
        잘라 버리는 것보다 한 줄 더 쓰는 편이 낫다.

        <p>분류는 뺐다. 아랫줄에 지역이 이미 서 있고, 분류는 눌러서 여는 상세 시트가 맡는다.
        좁은 줄에 여럿을 밀어 넣으면 다 못 읽는다.

        <p>■ <b>한적 지수는 카드의 오른쪽 위</b>다 (2026-08-31)

        이름 아랫줄에서 지역 알약 옆에 있었다. 카드 다섯이 세로로 늘어서면 배지의 왼쪽 끝이
        <b>이름 길이에 따라 제각기 다른 자리</b>에 서서, 점수끼리 눈으로 훑을 수가 없었다 —
        이 목록에서 견주게 되는 값이 바로 그 점수인데.

        <p>오른쪽 위로 올리면 다섯 장의 배지가 <b>한 세로줄</b>에 맞는다. 위쪽인 이유는
        이름과 같은 높이에 두어야 "이 곳의 점수"로 읽히기 때문이다 —
        아래로 내리면 그 아랫줄(지역)에 붙은 값처럼 보인다.
      */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className="text-fg line-clamp-2 min-w-0 flex-1 text-[15px] leading-[1.35] font-semibold tracking-[-0.01em]">
            {spot.place.name}
          </span>
          <CongestionBadge
            level={spot.level}
            label={spot.levelLabel}
            quietness={spot.quietness}
            size="sm"
          />
        </span>

        {/*
          지역 알약. <b>등급색을 쓰지 않는다</b> — 이 카드에서 색은 한적도 신호이고,
          지역은 신호가 아니라 이름표다. 같은 카드에 색이 둘이면 어느 쪽이 등급인지 흐려진다.
        */}
        <span className="bg-surface text-hint rounded-chip w-fit px-1.5 py-0.5 text-[11px] font-semibold">
          {spot.regionName}
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

              <p>⚠️ 오른쪽 본문 "생각지 못했던 여행을 찾아드려요"는 <b>경주를 모르는 사용자의
              문패</b>다. 제목이 그 일을 나눠 맡게 됐지만 지우지 말 것 —
              CLAUDE.md 필수 기능 6번이 이 진입점을 둔 이유가 그 사람이다.
            */}
            <span className="text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
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
            <span className="max-w-62.5 text-sm leading-[1.6] text-white/60">
              계획은 그대로, <br/>붐비는 순간만 PEAKOFF가 도와드려요.
            </span>
            {/* 이 링크가 유일한 문이다. button+navigate 대신 Link라 새 탭으로도 열린다 */}
            {/*
              보이는 글자는 짧게 두되 <b>접근 이름에는 목적지를 담는다.</b>
              두 카드의 문이 똑같이 "시작하기"라, 링크만 훑는 사람에게는
              "시작하기 · 시작하기"로 들려 어느 쪽이 무엇인지 알 수 없었다.
              눈으로 보는 사람은 바로 위 제목이 문맥을 주지만, 링크 목록에는 그 제목이 없다.
            */}
            <Link
              to="/plan"
              aria-label="코스 직접 짜기 시작하기"
              className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
            >
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
            {/*
              글로우 하나. 왼쪽 카드와 <b>같은 장치를 흰 면의 세기로</b> 옮긴 것이다.

              두 문이 짝인데 왼쪽만 오른쪽 절반이 장식으로 차 있고 이쪽은 비어 있어,
              같은 급의 카드 둘이 아니라 <b>주와 곁다리</b>로 읽혔다. 글자 크기·버튼·
              여백은 이미 같으니 남은 차이는 면이 비어 있다는 것뿐이었다.

              ⚠️ <b>하나뿐이고, 틸이다.</b> 왼쪽은 틸(한적)과 핑크(붐빔)를 마주 놓아
              "붐빔에서 한적으로"를 말하지만, 이 문은 붐빔을 진단하는 자리가 아니라
              한적한 곳을 찾아 주는 자리다 — 핑크를 얹으면 하지 않는 말을 하게 된다.

              ⚠️ <b>면을 통째로 칠하지 않았다.</b> 브랜드 틸을 깔면 로고와 버튼에만 남겨야
              할 강조색이 화면 절반을 차지하고, 옅은 틸(brand-tint #e1f5f9)은 이 자리에
              깔린 바탕 wash(#e9f6f7)와 거의 같은 색이라 카드 경계가 녹는다.
              번지는 원 하나면 면은 흰 채로 두면서 빈 자리만 채운다.

              알파가 왼쪽(0.14)보다 낮다. 흰 면 위에서는 같은 값도 훨씬 진하게 보인다.
            */}
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
              aria-hidden="true"
            >
              <span className="absolute -top-16 -right-14 h-52 w-52 rounded-full bg-[rgb(63_193_201/0.08)]" />
            </span>
            <span className="relative flex flex-col gap-3">
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
              <span className="text-fg text-[26px] leading-[1.3] font-bold tracking-[-0.025em]">
                새로운 여행을 발견할래요.
              </span>
              {/*
                ⚠️ "생각지 못했던 여행을 찾아드려요"가 <b>경주를 모르는 사용자를 위한 문패</b>다.
                제목이 행동 이름이라 누구를 위한 문인지 말하지 않으므로, 그 일을 이 문장이
                혼자 맡는다 — 지우면 그 사람이 왼쪽 문으로 들어가 빈 검색창 앞에서 처음 막힌다.

                앞 문장 "날짜와 취향만"의 <b>"만"</b>도 같은 일을 한다. 가져올 것이 적다고
                말해 두어야 "나는 아직 아무것도 못 정했는데"라는 사람이 이쪽을 고른다.

                <p>⚠️ <b>폭 상한(max-w-62.5)을 걷어냈다.</b> 두 줄은 이미 <code>&lt;br/&gt;</code>이
                직접 가르므로 상한이 하는 일은 <b>의도한 줄을 한 번 더 접는 것</b>뿐인데,
                "생각지 못했던 여행을 PEAKOFF가 찾아드려요."가 250px를 넘어 세 줄이 된다.
              */}
              <span className="text-muted text-sm leading-[1.6]">
                날짜와 취향만 알려주세요. <br/>생각지 못했던 여행을 PEAKOFF가 찾아드려요.
              </span>
              {/*
                왼쪽 카드와 같은 노란 알약이다. 회색 테두리 알약은 "준비 중"의 표현이었다 —
                눌러도 되는 버튼을 비활성처럼 그려두면 사용자는 없는 기능으로 읽는다.
                두 문이 같은 모양의 버튼을 갖는 것이 맞다. 둘 다 실제로 열리니까.
              */}
              <Link
                to="/recommend"
                aria-label="새로운 코스 발견하기 시작하기"
                className="bg-brand group-hover:bg-brand-hover hover:bg-brand-hover text-fg rounded-ui mt-1.5 inline-flex h-11.5 cursor-pointer items-center gap-1.75 self-start px-5 text-[15.5px] font-semibold no-underline transition-colors"
              >
                시작하기
                <ChevronRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
              </Link>
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
          className={`${CARD_RAISED} flex flex-col gap-3 p-4.5 lg:col-span-4 lg:p-5.5`}
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
            <div className="flex flex-col gap-2">
              {Array.from({ length: QUIET_SPOT_COUNT }, (_, index) => (
                <div key={index} className="bg-bg rounded-card h-21 animate-pulse" />
              ))}
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
            <div className="flex flex-col gap-2">
              {quietSpots.spots.map((spot) => (
                <QuietSpotCard
                  key={spot.place.id}
                  spot={spot}
                  onOpen={() => setOpenedSpot(spot)}
                />
              ))}
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

          아직 무엇을 넣을지 정하지 않았다. 자리를 먼저 잡아 두는 이유는, 나중에 채울 때
          양옆 박스의 폭을 다시 계산할 일이 없게 하려는 것이다 — 넷·넷·넷이 이미 서 있다.

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

            옆 칸과 <b>같은 박스</b>에 담는다. 예전에는 이쪽만 테두리 없이 배경 위에 떠 있어,
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
                className="region-fade grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-1"
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
