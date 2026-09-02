import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Bag,
  ChevronLeft,
  ChevronRight,
  Close,
  Heart,
  Route,
  User,
} from '../components/icons'
import { ProfileAvatar } from '../components/ProfileAvatar'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AccountSheets } from '../components/AccountSheets'
import type { AccountSheet } from '../components/AccountSheets'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { CreateTripSheet } from '../components/CreateTripSheet'
import { CourseDetailOverlay } from '../components/CourseDetailOverlay'
import { LegalSheet } from '../components/LegalSheet'
import type { LegalDocId } from '../content/legal'
import { PlaceDetailSheet } from '../components/PlaceDetailSheet'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { SavedCourseCard } from '../components/SavedCourseCard'
import { TripDetailSheet } from '../components/TripDetailSheet'
import { orderCourses, seamsOf, TripCourseList } from '../components/TripCourseList'
import { CARD } from '../components/styles'
import {
  ApiRequestError,
  addCourseToTrip,
  createTrip,
  deleteSavedCourse,
  deleteTrip,
  fetchSavedCourses,
  fetchTrips,
  removeCourseFromTrip,
} from '../services/api'
import { daysBetween, formatMonthDay } from '../utils/date'
import { useAuth } from '../state/authContext'
import { useFavorites } from '../state/favoriteContext'
import { defaultRegionSlug, regionNameOf, searchRegions } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import type { FavoritePlace, SavedCourseDetail, SavedCourseSummary, Trip } from '../types/api'

type ListState =
  { status: 'loading' } | { status: 'loaded'; courses: SavedCourseSummary[] } | { status: 'error' }

/**
 * 한 번에 보여줄 수와 <b>더보기 한 번에 늘어나는 수</b>.
 *
 * <p>넓은 화면의 <b>한 줄</b>과 같은 수다 — 코스는 세 칸, 찜은 네 칸. 그래야 더보기를
 * 누를 때마다 줄이 정확히 하나씩 늘고, 남는 칸 없이 격자가 채워진다.
 *
 * <p>⚠️ <b>좁은 화면도 같은 수를 쓴다.</b> 거기서는 한 줄에 하나씩이라 "한 줄"이라는 근거가
 * 사라지지만, 화면 크기마다 다른 수를 쓰면 같은 계정이 기기에 따라 다른 만큼 보인다.
 * 무엇보다 더보기가 필요한 이유가 좁은 화면에서 더 크다 — 이 화면은 목록 <b>뒤에</b>
 * 계정·로그아웃이 있어서, 목록이 길면 거기까지 내려가는 것 자체가 일이 된다.
 */
const COURSE_PAGE = 3
const FAVORITE_PAGE = 4

/**
 * 여행 카드에 세우는 코스 수.
 *
 * <p>전부 세웠더니 <b>코스 수만큼 카드 높이가 달라져</b> 목록이 들쭉날쭉했다.
 * 카드는 훑는 자리라 높이가 고르게 서야 한다 — 나머지는 "상세보기"가 받는다.
 *
 * <p>셋인 이유: 하나·둘짜리 여행이 대부분이라 그 경우 잘림 표시가 아예 안 뜨고,
 * 셋이면 <b>이음새가 둘</b>이라 "코스 사이가 벌어졌다"는 이 화면의 신호가 카드에서도
 * 보인다. 둘로 줄이면 이음새 하나만 남아 그 신호가 절반이 된다.
 */
const TRIP_CARD_COURSES = 3

/**
 * 한 쪽에 세우는 여행 수. 넓은 화면의 두 열로 <b>한 줄</b>이다.
 *
 * <p>코스·찜과 달리 "더보기"를 쓰지 않는다. 더보기는 목록을 <b>늘리기만</b> 해서
 * 스무 개를 담아 둔 사람이 아래쪽 여행을 보려면 카드 스무 장을 지나쳐야 한다 —
 * 여행은 코스와 달리 하나가 여러 줄을 쓴다. 쪽을 넘기면 지나칠 것이 없다.
 *
 * <p>⚠️ <b>넷에서 둘로 줄였다</b>(2026-09-01). 여행 카드는 담긴 코스 셋에 버튼 둘,
 * 담기 목록까지 펴면 <b>한 장이 화면 하나를 넘긴다</b> — 넷이면 좁은 화면에서 네 번을
 * 굴려야 쪽 넘김 버튼에 닿았고, 그 버튼은 목록을 짧게 하려고 둔 것이었다.
 * 둘이면 넓은 화면에서 정확히 한 줄이고, 좁은 화면에서도 두 장 아래 바로 쪽이 보인다.
 */
const TRIP_PAGE = 2

/**
 * 더 불러오는 버튼. <b>남은 수를 적는다.</b>
 *
 * <p>"더보기"만 두면 몇 번을 더 눌러야 끝인지 알 수 없다. 남은 수를 보여주면
 * 한 번 더 누를지 그만둘지를 <b>누르기 전에</b> 정할 수 있다.
 */
function MoreButton({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press border-line bg-surface text-muted hover:bg-bg rounded-ui h-12 w-full cursor-pointer border text-[13.5px] font-semibold transition-colors"
    >
      더보기 <span className="text-hint">({remaining})</span>
    </button>
  )
}

/**
 * 좁은 화면의 두 갈래.
 *
 * <p>라벨을 따로 두지 않는다. 탭 노릇을 하는 것이 <b>통계 카드</b>이고 그 글자는
 * {@code stats}가 이미 들고 있다 — 여기 또 적으면 한쪽만 고쳐지는 날이 온다.
 */
type MyTab = 'courses' | 'favorites' | 'trips' | 'account'

/**
 * 이 화면의 네 자리. <b>좁은 화면의 탭</b>이자 <b>넓은 화면의 이동 버튼</b>이고,
 * 스크롤로 찾아갈 <b>닻</b>이기도 하다 — 한 곳에서 온다.
 *
 * <h3>⚠️ 숫자를 걷어내고 심볼을 세웠다 (2026-09-01)</h3>
 * 예전에는 칸마다 개수가 큰 숫자로 서 있었다("저장한 코스 2"). 세 가지가 걸렸다.
 *
 * <p><b>하나 — 같은 수가 바로 아래에 또 있었다.</b> 각 목록의 머리글이 "내가 저장한 코스
 * 2개"를 이미 적는다. 탭을 누르면 같은 숫자가 두 번 보였다.
 *
 * <p><b>둘 — 숫자가 뜻을 만들지 못했다.</b> 코스 2개가 많은 건지 적은 건지 이 화면은
 * 말해주지 않는다. "평균 한적 지수"를 걷어낸 것과 같은 이유다.
 *
 * <p><b>셋 — 무엇으로 가는 문인지가 글자에만 있었다.</b> 심볼은 훑을 때 먼저 읽히고,
 * 화면을 옮겨도 같은 그림이라 자리를 기억하게 한다.
 */
const SECTIONS = [
  {
    tab: 'courses' as const,
    label: '저장한 코스',
    anchor: 'my-courses',
    Icon: Route,
  },
  {
    tab: 'favorites' as const,
    label: '찜한 곳',
    anchor: 'my-favorites',
    Icon: Heart,
  },
  { tab: 'trips' as const, label: '여행', anchor: 'my-trips', Icon: Bag },
  { tab: 'account' as const, label: '계정', anchor: 'my-account', Icon: User },
]

/** 계정 정보 줄의 오른쪽에 서는 작은 버튼 */
const ROW_ACTION =
  'border-line bg-surface text-fg hover:bg-bg h-9 flex-none cursor-pointer rounded-[11px] border px-3.5 text-[13px] font-semibold transition-colors'

/**
 * 계정 정보 한 줄.
 *
 * <p>값과 변경 버튼이 같은 줄에 선다. 항목마다 카드를 따로 떼면 카드 세 장이 나란히 서서
 * 화면이 무거워지는데, 여기서 하는 일은 대부분 "지금 값 확인"이지 변경이 아니다.
 * 자주 하지 않는 일에 큰 자리를 주지 않는다.
 */
function AccountRow({
  label,
  value,
  action,
  last = false,
}: {
  label: string
  value: string
  action?: ReactNode
  last?: boolean
}) {
  return (
    <div className={`flex min-h-15 items-center gap-3 ${last ? '' : 'border-line/60 border-b'}`}>
      <span className="text-hint w-16 flex-none text-[12.5px] font-semibold">{label}</span>
      {/* min-w-0 + truncate — 긴 이메일이 버튼을 밀어내지 않게 한다 */}
      <span className="text-fg min-w-0 flex-1 truncate text-[14.5px]">{value}</span>
      {action}
    </div>
  )
}

export function MyPage() {
  const navigate = useNavigate()
  const { member, loading: authLoading, logout } = useAuth()
  /* 찜은 앱이 뜰 때 한 번 받아 둔 것을 그대로 읽는다 — 이 화면이 따로 부르지 않는다 */
  const { favorites, isFavorite, toggle } = useFavorites()
  const { restore } = useTrip()
  // 아래 고정 CTA가 브라우저 도구막대 뒤로 숨지 않게 하는 보정.
  /**
   * 이 화면에 머무는 동안 <b>한 번이라도 로그인 상태였는가.</b>
   *
   * <p>아래 로그인 가드가 "튕겨낼 사람"과 "방금 나간 사람"을 가르는 데 쓴다.
   * 상태가 아니라 ref인 이유: 이 값이 바뀐다고 다시 그릴 일이 없고, 같은 렌더 안에서
   * member와 함께 읽혀야 하기 때문이다.
   */
  const wasSignedIn = useRef(false)
  if (member) {
    wasSignedIn.current = true
  }

  const [list, setList] = useState<ListState>({ status: 'loading' })
  /** 겹창에 펼칠 코스. 비어 있으면 닫힌 상태 */
  /*
   * 펼쳐 본 여행. <b>객체가 아니라 id로 들고 있다.</b> 스냅샷을 쥐고 있으면 창 안에서
   * 코스를 빼도 그 창은 옛 목록을 계속 그린다 — 같은 화면에서 지운 것이 그대로 남는다.
   * id만 두고 목록에서 다시 찾으면 늘 지금 값이다.
   */
  const [detailTripId, setDetailTripId] = useState<number | null>(null)
  /** 지금 보고 있는 여행 쪽. 0부터 센다 */
  const [tripPage, setTripPage] = useState(0)

  /** 펼쳐 본 코스. 비교가 사라지면서 한 번에 하나가 됐다 */
  const [opened, setOpened] = useState<number | null>(null)
  /** 지울지 묻고 있는 코스. null이면 확인 시트가 닫힌 상태 */
  const [pendingDelete, setPendingDelete] = useState<SavedCourseSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  /**
   * 일회성 알림. 창을 띄우지 않고 목록 위에 띠로 보여준다.
   *
   * <p>성공과 실패가 같은 자리를 쓴다. 자리를 나누면 알림 칸이 둘 생기고 대부분의 시간 동안
   * 둘 다 비어 있다. {@code tone}으로 색과 역할(alert/status)만 가른다.
   */
  const [notice, setNotice] = useState<{
    tone: 'ok' | 'error'
    text: string
  } | null>(null)

  /** 열려 있는 계정 시트. 입력값과 처리 상태는 AccountSheets가 들고 있다 */
  const [accountSheet, setAccountSheet] = useState<AccountSheet | null>(null)
  /**
   * 펼쳐 놓은 약관. null이면 시트가 닫혀 있다.
   *
   * <p>가입 화면과 <b>같은 시트를 그대로 쓴다</b>({@code LegalSheet}). 문서는 한 곳
   * ({@code content/legal.ts})에만 있고, 동의를 받는 자리와 나중에 다시 읽는 자리가
   * 같은 글을 보여준다 — 두 벌로 두면 한쪽만 고쳐지는 날이 온다.
   *
   * <p>⚠️ 여기에는 <b>동의 버튼이 없다.</b> 동의는 가입 때 이미 받았고,
   * 같은 동의를 두 곳에서 받으면 어느 쪽이 진짜인지 갈린다.
   */
  const [openedDoc, setOpenedDoc] = useState<LegalDocId | null>(null)

  /**
   * 펼쳐 보고 있는 찜한 곳. <b>id가 아니라 줄 전체를 들고 있다.</b>
   *
   * <p>상세 시트에 넘길 것이 이름·분류·사진이고 그 셋이 이미 이 객체에 있다.
   * id만 들고 있으면 목록에서 다시 찾아와야 하고, 찾는 코드가 목록을 그리는 코드와
   * 갈라져 한쪽만 고쳐지는 자리가 생긴다 — 홈이 한적한 곳을 여는 방식과 같다.
   */
  const [openedPlace, setOpenedPlace] = useState<FavoritePlace | null>(null)

  /**
   * 지금까지 펼쳐 본 만큼. <b>더보기를 누를 때마다 늘어난다.</b>
   *
   * <p>목록이 바뀌어도(코스를 지우거나 찜을 풀어도) 되돌리지 않는다 — 이미 펼쳐 본 것이
   * 다시 접히면 방금 보던 자리를 잃는다. 목록보다 커져도 {@code slice}가 알아서 자른다.
   */
  const [courseLimit, setCourseLimit] = useState(COURSE_PAGE)
  const [favoriteLimit, setFavoriteLimit] = useState(FAVORITE_PAGE)

  /**
   * ■ 이 화면에 <b>머무는 동안 자리를 지키는</b> 찜 목록.
   *
   * <p>하트를 끄면 카드가 즉시 사라졌다. 그런데 이 목록은 <b>훑어보며 정리하는 자리</b>라,
   * 사라지는 순간 방금 무엇을 껐는지 확인할 수도, 잘못 눌렀을 때 되돌릴 수도 없었다.
   * 아래 카드들이 한 칸씩 밀려 올라와 누르려던 다음 카드가 손가락 밑에서 바뀌기도 한다.
   *
   * <p>그래서 <b>끈 자리는 그대로 두고 하트만 빈 모양으로</b> 바꾼다. 다시 누르면 되살아난다.
   * 진짜로 목록에서 빠지는 것은 <b>이 화면을 떠났다 돌아왔을 때</b>다 — 그때는 이 상태가
   * 사라지고 서버 목록에서 다시 세운다(라우트가 바뀌면 이 컴포넌트가 통째로 내려간다).
   *
   * <p>⚠️ 숫자는 <b>따라오지 않는다.</b> 위의 "N곳"과 통계 카드는 진짜 찜 개수를 쓴다 —
   * 자리를 지키는 것은 되돌릴 틈을 주려는 화면 사정이고, 몇 곳을 찜해 두었는가는 사실이다.
   */
  const [lingering, setLingering] = useState<FavoritePlace[]>(favorites)

  /*
   * 새로 들어온 것만 앞에 붙이고, 빠진 것은 자리를 지킨다.
   *
   * 목록을 통째로 갈아끼우지 않는 이유가 이 화면의 요구 그 자체다. 대신 새로 찜한 것은
   * 따라와야 한다 — 이 화면에서도 상세 시트를 열어 하트를 켤 수 있다.
   *
   * 더할 것이 없으면 <b>같은 배열을 그대로 돌려준다.</b> 새 배열을 만들면 favorites가
   * 바뀔 때마다(하트를 끌 때마다) 목록 전체가 다시 그려진다.
   */
  useEffect(() => {
    setLingering((current) => {
      const shown = new Set(current.map((favorite) => favorite.placeId))
      const added = favorites.filter((favorite) => !shown.has(favorite.placeId))
      return added.length === 0 ? current : [...added, ...current]
    })
  }, [favorites])

  /**
   * 찜해 둔 곳으로 여행을 시작한다.
   *
   * <p>홈의 한적한 곳과 <b>넘기는 것이 하나 적다</b> — 거기는 "그 곳이 한적한 날"을 알아서
   * 날짜까지 채워 보내지만, 찜에는 날짜가 없다("언젠가 가고 싶다"는 표시다).
   * 지역과 장소만 넘기고 <b>언제 떠날지는 조건 화면에서 고른다.</b>
   *
   * <p>전역 상태에 미리 쓰지 않고 라우터 state로 넘긴다. 아직 아무것도 확정하지 않은
   * 시점이라 되돌아 나가면 흔적이 남지 않아야 한다.
   */
  function planTripFrom(favorite: FavoritePlace) {
    setOpenedPlace(null)
    navigate('/plan', {
      state: { region: favorite.region, seedPlaceId: favorite.placeId },
    })
  }

  /**
   * 좁은 화면에서 무엇을 보고 있는가.
   *
   * <h3>넓은 화면에는 탭이 없다</h3>
   * 저장한 코스와 찜한 곳은 <b>함께 볼 수 있으면 함께 보는 편이 낫다</b> — 둘 다 "내가 모아
   * 둔 것"이고, 찜한 곳을 보다가 코스로 눈이 가는 일이 자연스럽다. 자리가 넉넉한 곳에서
   * 굳이 하나를 감출 이유가 없다.
   *
   * <p>좁은 화면은 사정이 다르다. 코스 카드가 한 장에 100px을 넘게 쓰는데 그 아래
   * 찜한 곳까지 이어 붙이면, 찜을 보려면 코스를 전부 지나쳐 내려가야 한다.
   * 스크롤로 옮겨 다니는 대신 <b>같은 자리에서 갈아끼운다</b> — CLAUDE.md가 홈의
   * "붐빌 것/한적할 것"과 최종 비교의 "원안/개선안"에 쓴 것과 같은 장치다.
   */
  const [tab, setTab] = useState<MyTab>('courses')

  /**
   * 넓은 화면 이동 버튼이 <b>어디에 와 있는지</b> 표시하려고 둔 값.
   *
   * <p>현재 위치를 말하지 않는 이동 버튼은 절반짜리다 — 눌러서 갈 수는 있지만
   * 지금 보고 있는 것이 무엇인지는 스크롤 위치를 스스로 세어야 알게 된다.
   */
  const [activeAnchor, setActiveAnchor] = useState(SECTIONS[0].anchor)

  /*
   * ⚠️ <b>{@code IntersectionObserver}로 만들었다가 바꿨다.</b> "화면 위쪽 띠에 들어온
   * 구역"을 현재로 치는 방식이었는데, <b>마지막 구역이 영영 그 띠에 못 들어간다</b> —
   * 계정은 페이지 끝이라 아무리 굴려도 위로 더 올라오지 않는다. 계정을 눌러 내려가도
   * 표시는 "여행"에 남아 있었다.
   *
   * <p>그래서 <b>선을 넘은 마지막 구역</b>을 센다. 화면 위 120px에 가로선을 그어 두고,
   * 그 선 위로 올라간 구역 중 가장 아래 것이 현재다. 그리고 <b>바닥에 닿으면 마지막
   * 구역으로 못 박는다</b> — 더 굴릴 수 없는 자리에서는 그것이 사용자가 보고 있는 것이다.
   *
   * <p>스크롤마다 재지 않고 {@code requestAnimationFrame}으로 프레임당 한 번만 잰다.
   * 이벤트마다 {@code getBoundingClientRect}를 네 번 부르면 매번 레이아웃을 다시 계산하게 된다.
   *
   * <p>높이가 0인 것은 건너뛴다. 좁은 화면에서는 보고 있지 않은 구역이 {@code display:none}이라
   * 위치가 전부 0으로 나오는데, 그러면 "선 위에 있다"가 되어 늘 마지막 것이 잡힌다.
   */
  useEffect(() => {
    if (!member) {
      return
    }
    const LINE = 120
    let frame = 0

    function measure() {
      frame = 0
      const last = SECTIONS[SECTIONS.length - 1].anchor
      const documentHeight = document.documentElement.scrollHeight
      if (window.innerHeight + window.scrollY >= documentHeight - 2) {
        setActiveAnchor(last)
        return
      }
      let current = SECTIONS[0].anchor
      for (const { anchor } of SECTIONS) {
        const box = document.getElementById(anchor)?.getBoundingClientRect()
        if (box && box.height > 0 && box.top <= LINE) {
          current = anchor
        }
      }
      setActiveAnchor(current)
    }

    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(measure)
      }
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [member])

  /**
   * 그 구역으로 데려간다.
   *
   * <p>{@code <a href="#...">}가 아니라 버튼이다. 앵커를 쓰면 누를 때마다 주소에 해시가
   * 쌓여, 뒤로 가기를 네 번 눌러야 <b>이 화면에서 나가진다.</b> 화면 안에서 자리를 옮기는
   * 일은 방문 기록이 아니다.
   *
   * <p>움직임을 줄이도록 설정한 사람에게는 <b>즉시</b> 옮긴다.
   */
  function goTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  /*
   * 탭이 감추는 것은 <b>좁은 화면에서만</b>이다. {@code contents}는 상자를 만들지 않고
   * 자식을 부모의 흐름에 그대로 놓으므로, 감싸도 바깥 flex의 간격이 그대로 산다 —
   * 여느 div로 감쌌다면 섹션 사이 간격이 한 겹 사라진다.
   */
  const paneClass = (name: MyTab) => (tab === name ? 'contents' : 'hidden md:contents')

  /**
   * @param silent 스켈레톤을 띄우지 않고 조용히 다시 읽는다.
   *               삭제 직후처럼 이미 목록이 그려져 있을 때 쓴다 — 카드 하나를 지웠는데
   *               화면 전체가 스켈레톤으로 깜빡이면 뭐가 일어났는지 알 수 없다.
   */
  /**
   * 여행 목록. 코스 목록과 따로 든다 — 한쪽이 실패해도 다른 쪽은 서야 한다.
   *
   * <p>⚠️ 실패해도 빈 목록으로 뭉개지 않고 상태를 갈라 둔다. "여행이 없다"와
   * "못 불러왔다"는 정반대의 소식이다.
   */
  const [tripsState, setTripsState] = useState<
    { status: 'loading' } | { status: 'loaded'; trips: Trip[] } | { status: 'error' }
  >({ status: 'loading' })

  const load = useCallback((signal?: AbortSignal, silent = false) => {
    if (!silent) {
      setList({ status: 'loading' })
    }
    fetchSavedCourses(signal)
      .then((courses) => setList({ status: 'loaded', courses }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setList({ status: 'error' })
      })
    fetchTrips(signal)
      .then((trips) => setTripsState({ status: 'loaded', trips }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setTripsState({ status: 'error' })
      })
  }, [])

  useEffect(() => {
    // 로그인 확인이 끝나기 전에 부르면 토큰 없이 나가 401을 맞는다.
    if (authLoading || !member) {
      return
    }
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [authLoading, member, load])

  const courses = list.status === 'loaded' ? list.courses : []
  const trips = tripsState.status === 'loaded' ? tripsState.trips : []
  const detailTrip = trips.find((trip) => trip.id === detailTripId) ?? null

  /*
   * 쪽 수와 <b>지금 쪽을 가둔다.</b> 마지막 쪽의 마지막 여행을 지우면 그 쪽이 통째로
   * 사라지는데, 가두지 않으면 화면이 <b>빈 쪽</b>에 서서 아무것도 없는 것처럼 보인다.
   * 렌더 중에 맞춰 두면 상태를 되돌리는 왕복 없이 그 프레임에 바로 옳은 쪽이 그려진다.
   */
  const tripPageCount = Math.max(1, Math.ceil(trips.length / TRIP_PAGE))
  const currentTripPage = Math.min(tripPage, tripPageCount - 1)
  const pagedTrips = trips.slice(currentTripPage * TRIP_PAGE, (currentTripPage + 1) * TRIP_PAGE)

  /**
   * 여행 이름을 묻는 시트가 열려 있는가.
   *
   * <p>이름과 만드는 중 표시는 <b>시트가 들고 있다</b>({@code CreateTripSheet}) —
   * 이 화면이 알아야 할 것은 "열렸나"뿐이다. 입력값까지 여기서 들면
   * 시트를 닫을 때마다 비워주는 일을 이쪽이 기억해야 한다.
   */
  const [creatorOpen, setCreatorOpen] = useState(false)
  /** 코스 담기 목록이 열려 있는 여행. 한 번에 하나만 연다 — 두 목록이 같이 열리면 어디에 담기는지 흐려진다. */
  const [pickerTripId, setPickerTripId] = useState<number | null>(null)
  /*
   * 담을 코스를 <b>지역으로</b> 좁히는 검색어. 여는 여행이 바뀔 때마다 비운다 —
   * 남겨 두면 다음에 열 때 지난번 글자가 목록을 이미 걸러 놓아, 담을 수 있는 코스가
   * 줄어 있는 것처럼 보인다({@code RegionPicker}가 목록을 닫을 때 검색어를 비우는 것과
   * 같은 이유).
   */
  const [pickerQuery, setPickerQuery] = useState('')

  function togglePicker(tripId: number) {
    setPickerQuery('')
    setPickerTripId((current) => (current === tripId ? null : tripId))
  }
  const [pendingTripDelete, setPendingTripDelete] = useState<Trip | null>(null)
  const [deletingTrip, setDeletingTrip] = useState(false)

  /** 서버가 돌려준 여행으로 목록의 그 자리만 갈아끼운다. 전체 재조회가 필요 없다. */
  function replaceTrip(updated: Trip) {
    setTripsState((current) =>
      current.status === 'loaded'
        ? {
            status: 'loaded',
            trips: current.trips.map((trip) => (trip.id === updated.id ? updated : trip)),
          }
        : current,
    )
  }

  function tripFail(fallback: string) {
    return (error: unknown) => {
      setNotice({
        tone: 'error',
        text: error instanceof ApiRequestError ? error.message : fallback,
      })
    }
  }

  /**
   * 여행을 만든다. <b>실패를 삼키지 않고 던진다</b> — 시트가 그 자리에서 보여줘야
   * 사용자가 이름을 고쳐 다시 누를 수 있다. 여기서 잡아 상단 알림으로 보내면
   * 시트는 닫히고 알림만 남아, 방금 친 이름을 다시 쳐야 한다.
   */
  async function handleCreateTrip(name: string) {
    setNotice(null)
    const trip = await createTrip(name)
    // 새 여행이 맨 위로 — 서버 목록 순서(최근 생성순)와 같다.
    setTripsState((current) =>
      current.status === 'loaded'
        ? { status: 'loaded', trips: [trip, ...current.trips] }
        : { status: 'loaded', trips: [trip] },
    )
    /*
     * ⚠️ <b>담기 목록을 자동으로 열지 않는다</b>(2026-09-01). 만들자마자 열어 주었는데,
     * 여행을 이름만 먼저 만들어 두는 사람에게는 <b>묻지 않은 것을 펼친 것</b>이었다 —
     * 게다가 그 목록은 이제 검색해야 뜨므로, 열려 있어도 빈 칸 하나가 서 있을 뿐이다.
     * 빈 여행에서 다음 할 일은 카드 안의 문장이 말한다.
     */
  }

  async function handleAddToTrip(tripId: number, courseId: number) {
    setNotice(null)
    try {
      replaceTrip(await addCourseToTrip(tripId, courseId))
    } catch (error: unknown) {
      tripFail('코스를 담지 못했어요.\n잠시 후 다시 시도해 주세요.')(error)
    }
  }

  async function handleRemoveFromTrip(tripId: number, courseId: number) {
    setNotice(null)
    try {
      replaceTrip(await removeCourseFromTrip(tripId, courseId))
    } catch (error: unknown) {
      tripFail('코스를 빼지 못했어요.\n잠시 후 다시 시도해 주세요.')(error)
    }
  }

  async function handleDeleteTrip() {
    if (!pendingTripDelete) {
      return
    }
    setDeletingTrip(true)
    setNotice(null)
    try {
      await deleteTrip(pendingTripDelete.id)
      setTripsState((current) =>
        current.status === 'loaded'
          ? {
              status: 'loaded',
              trips: current.trips.filter((trip) => trip.id !== pendingTripDelete.id),
            }
          : current,
      )
      setPendingTripDelete(null)
    } catch (error: unknown) {
      setPendingTripDelete(null)
      tripFail('여행을 지우지 못했어요.\n잠시 후 다시 시도해 주세요.')(error)
    } finally {
      setDeletingTrip(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return
    }
    setDeleting(true)
    setNotice(null)
    try {
      await deleteSavedCourse(pendingDelete.id)
      setPendingDelete(null)
      // 서버가 지운 뒤 목록을 다시 읽는다. 화면에서만 지우면 실제로 지워졌는지 알 수 없다.
      load(undefined, true)
    } catch (error: unknown) {
      setPendingDelete(null)
      setNotice({
        tone: 'error',
        text:
          error instanceof ApiRequestError
            ? error.message
            : '코스를 지우지 못했어요.\n잠시 후 다시 시도해 주세요.',
      })
    } finally {
      setDeleting(false)
    }
  }

  function openInFlow(course: SavedCourseDetail) {
    // 저장된 장소를 일차별 배열로 되돌린다. days[0]이 1일차다.
    const days: string[][] = Array.from({ length: course.days }, () => [])
    course.places.forEach((saved) => {
      days[saved.day - 1]?.push(saved.placeId)
    })

    /*
     * 어느 코스에서 왔는지를 함께 올린다. 이것이 있어야 결과 화면의 저장이
     * <b>새로 만드는 대신 이 코스를 덮어쓴다.</b>
     *
     * 예전에는 장소와 날짜만 올렸다. 그래서 "수정하기"로 들어가 고친 뒤 저장하면
     * <b>옛 코스는 그대로 남고 새 코스가 하나 더 생겼다</b> — 이름이 같은 코스가
     * 목록에 둘씩 쌓여, 어느 것이 최신인지 열어보기 전에는 알 수 없었다.
     *
     * 이름과 공개 여부까지 싣는 이유는 저장 시트가 <b>지금 값</b>으로 열려야 하기
     * 때문이다. 특히 공개 여부를 빠뜨리면 토글이 기본값(켜짐)으로 서서,
     * 비공개로 저장해둔 코스가 고치는 것만으로 홈에 나간다.
     */
    restore(
      {
        region: course.region,
        startDate: course.startDate,
        nights: course.nights,
      },
      days,
      { courseId: course.id, name: course.name, isPublic: course.isPublic },
    )
    /*
     * 편집 화면이 아니라 진단 화면으로 간다. 버튼 이름이 "다시 진단하기"다 —
     * 편집 화면에 내려주면 사용자가 진단 버튼을 한 번 더 찾아 눌러야 하고,
     * 그 사이 화면은 이름이 약속한 것과 다른 곳에 서 있다.
     * 재계산은 이 경로뿐이다. 열람은 스냅샷으로 끝난다(CLAUDE.md 저장 코스 처리).
     */
    navigate('/diagnosis')
  }

  // 확인이 끝나기 전에 튕겨내면 새로고침할 때마다 로그인 화면이 스쳐 지나간다.
  if (authLoading) {
    return <div className="text-hint px-5 py-10 text-center text-[13px]">불러오는 중…</div>
  }
  /*
   * 로그인 상태가 아니면 이 화면을 보여주지 않는다. <b>어디로 보낼지가 둘로 갈린다.</b>
   *
   *   처음부터 로그인 상태가 아니었다 → 주소로 바로 들어온 사람. 로그인 화면으로.
   *   있었는데 없어졌다              → 스스로 나간 사람(로그아웃·탈퇴). 홈으로.
   *
   * 예전에는 무조건 로그인 화면으로 보냈다. 그래서 <b>로그아웃했을 뿐인데 로그인하라는
   * 화면</b>이 떴다 — 방금 나온 사람에게 다시 들어오라고 말하는 꼴이다. 로그아웃 버튼이
   * navigate('/')를 부르고 있었지만, member가 비는 순간 이 가드가 먼저 걸렸고
   * 그 Navigate가 replace라 홈 이동을 덮어썼다.
   *
   * 플래그를 따로 두는 대신 <b>"있었는가"로 판단</b>하는 이유: 나가는 길이 로그아웃
   * 하나가 아니다. 회원 탈퇴도 같은 자리를 지나는데, 플래그 방식이면 그 경로에도
   * 똑같은 표시를 심어야 하고 나중에 길이 하나 더 생기면 또 빠뜨린다.
   */
  if (!member) {
    return <Navigate to={wasSignedIn.current ? '/' : '/login'} replace />
  }

  const empty = list.status === 'loaded' && courses.length === 0

  return (
    /*
      ■ 넓은 화면은 <b>왼쪽 이동 버튼 + 본문</b> 두 칸이다.

      네 구역이 세로로 길게 이어져 있어서, 계정을 보려면 코스·찜·여행을 전부 지나쳐야
      했다. 좁은 화면은 탭이 그 문제를 이미 풀고 있었는데 <b>넓은 화면에만 문이 없었다</b> —
      자리가 넉넉한 쪽이 오히려 더 많이 굴려야 했던 셈이다.

      <p>좁은 화면처럼 <b>갈아끼우지 않고 데려간다.</b> 넓은 화면에서는 네 목록이 함께
      보이는 편이 낫고(코스를 보다 찜으로 눈이 가는 일이 자연스럽다), 여기서 감추면
      쓸 수 있는 자리를 스스로 버리는 것이 된다.
    */
    <div className="mx-auto w-full max-w-[430px] px-4 md:flex md:max-w-app md:items-start md:gap-8 md:px-0">
      {/*
        이동 버튼. {@code sticky}라 본문을 굴려도 따라온다 — 아래까지 내려간 뒤
        위로 되돌아가려고 다시 굴리는 일이 없어야 이 줄이 제 몫을 한다.

        <p>좁은 화면의 탭과 <b>같은 {@code SECTIONS}</b>를 돈다. 라벨도 심볼도 순서도
        한 곳에서 온다.
      */}
      <nav
        aria-label="마이페이지 안에서 이동"
        className="sticky top-24 hidden w-[164px] flex-none flex-col gap-1 md:flex"
      >
        {SECTIONS.map(({ anchor, label, Icon, tab: name }) => {
          const active = activeAnchor === anchor
          return (
            <button
              key={anchor}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => goTo(anchor)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-[12px] border-0 px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors ${
                active ? 'bg-brand-tint text-brand-deep' : 'text-muted hover:bg-fill bg-transparent'
              }`}
            >
              {name === 'favorites' ? <Heart size={17} filled={active} /> : <Icon size={17} />}
              {label}
            </button>
          )
        })}
      </nav>

      <div className="flex w-full min-w-0 flex-col gap-5.5 pt-5 pb-10 md:flex-1">
        {/* 프로필 */}
        <section className="flex items-center gap-3.5 md:gap-4.5">
          {/*
          사진을 올리기 전의 기본 그림. 예전에는 닉네임 첫 글자를 박아 두었는데,
          바로 옆에 같은 닉네임이 전체로 다시 적혀 있어 같은 정보가 두 번 섰다.
          그림 정의는 ProfileAvatar 한 곳에 있다.
        */}
          <ProfileAvatar className="h-14 w-14 rounded-[18px] md:h-16 md:w-16 md:rounded-[20px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="text-fg text-[19px] font-bold tracking-[-0.015em] md:text-[22px]">
              {member.nickname}
            </span>
            {/* 소셜로만 가입한 회원은 이메일이 없다(카카오 선택 동의). 빈 줄로 두지 않는다 */}
            <span className="text-hint truncate text-[13px]">
              {member.email ?? '간편 로그인 계정'}
            </span>
          </div>
        </section>

        {/*
        ■ 좁은 화면의 탭. 넓은 화면에서는 왼쪽 이동 버튼이 같은 일을 한다.

        <p>둘 다 {@code SECTIONS} 하나에서 온다. 목록을 두 벌로 적으면 자리를 하나 더할 때
        한쪽만 고쳐져 화면 크기에 따라 다른 내용이 나온다.

        <p>켜진 칸은 <b>어두운 면</b>이다. 편집 화면의 일차 탭과 같은 신호라
        "지금 이걸 보고 있다"가 화면을 옮겨도 같은 모양으로 읽힌다.

        <p>⚠️ <b>계정이 넷째 칸으로 들어왔다</b> (2026-09-01). 예전에는 계정·로그아웃·탈퇴가
        <b>목록 세 개를 전부 지나친 맨 아래</b>에 있었다 — 코스가 쌓일수록 로그아웃이 멀어졌다.
        탭이 되면 목록 길이와 무관하게 한 번에 닿는다.
      */}
        <div className="grid grid-cols-4 gap-2 md:hidden">
          {SECTIONS.map(({ tab: name, label, Icon }) => {
            const active = name === tab
            return (
              <button
                key={name}
                type="button"
                aria-current={active}
                onClick={() => setTab(name)}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border-0 px-1 py-3 transition-colors ${
                  active ? 'bg-fg' : 'bg-surface shadow-rest'
                }`}
              >
                {/*
                하트만 켜졌을 때 <b>채운다.</b> 켜고 끄는 것이 채움뿐이라 눌러도 그림이
                튀지 않는다. 나머지 셋은 선으로 그린 형태라 채울 속이 없다 —
                {@code filled}를 억지로 받게 하면 아무 일도 안 하는 속성이 셋 생긴다.
              */}
                {name === 'favorites' ? (
                  <Heart
                    size={19}
                    filled={active}
                    className={active ? 'text-white' : 'text-muted'}
                  />
                ) : (
                  <Icon size={19} className={active ? 'text-white' : 'text-muted'} />
                )}
                <span className={`text-[11.5px] ${active ? 'text-white/75' : 'text-hint'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/*
        일회성 알림. 창을 띄우는 대신 띠로 두어 화면 흐름을 끊지 않는다.

        role이 tone에 따라 다르다. 실패는 alert(하던 일을 끊고 읽어야 한다),
        성공은 status(방해하지 않고 알린다). 성공에까지 alert를 쓰면 화면 낭독기가
        매번 사용자를 멈춰 세운다.

        <p>⚠️ <b>탭 바깥에 둔다</b>(2026-09-01). 저장한 코스 pane 안에 있었는데,
        좁은 화면에서 그 pane은 <b>다른 탭을 보고 있으면 통째로 숨는다</b> —
        여행을 지우다 실패해도 사용자는 아무 말도 듣지 못했다. 화면에서는 그냥
        아무 일도 안 일어난 것처럼 보인다.

        <p>알림을 만드는 곳은 코스·찜·여행 셋 다인데 알림이 서는 곳은 하나뿐이었다.
        어느 탭에서 생겼든 보이는 자리는 탭 위다.
      */}
        {notice && (
          <div
            className={`rounded-card flex items-center justify-between gap-3 p-3.5 ${
              notice.tone === 'error' ? 'bg-crowded-tint' : 'bg-quiet-tint'
            }`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
          >
            <span
              className={`text-[13px] whitespace-pre-line ${
                notice.tone === 'error' ? 'text-crowded-deep' : 'text-brand-deep'
              }`}
            >
              {notice.text}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="알림 닫기"
              className={`grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full bg-transparent text-sm ${
                notice.tone === 'error'
                  ? 'text-crowded-deep/70 hover:text-crowded-deep'
                  : 'text-brand-deep/70 hover:text-brand-deep'
              }`}
            >
              <Close />
            </button>
          </div>
        )}

        <div className={paneClass('courses')}>
          {/* 섹션 헤더. id는 넓은 화면 이동 버튼이 찾아오는 닻이다 */}
          <section
            id="my-courses"
            className="border-line flex scroll-mt-24 flex-wrap items-center justify-between gap-3 border-t pt-5"
          >
            <div className="flex items-baseline gap-2">
              <h2 className="text-fg m-0 text-[16.5px] font-bold tracking-[-0.015em] md:text-[18px]">
                내가 저장한 코스
              </h2>
              {courses.length > 0 && (
                <span className="text-hint text-[12.5px]">{courses.length}개</span>
              )}
            </div>
          </section>

          {list.status === 'error' && (
            <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
              저장한 코스를 불러오지 못했어요.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          )}

          {list.status === 'loading' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="bg-surface shadow-rest rounded-[20px] p-4.5 max-md:rounded-[16px] max-md:p-3.5"
                >
                  <div className="skeleton mb-3 h-4.5 w-32 max-md:mb-2.5 max-md:h-4" />
                  <div className="skeleton mb-4 h-3 w-24 max-md:mb-3" />
                  <div className="skeleton h-14 w-full rounded-[14px] max-md:h-12 max-md:rounded-[12px]" />
                </div>
              ))}
            </div>
          )}

          {list.status === 'loaded' && !empty && (
            <>
              {/*
          ⚠️ <b>"목록 끝으로 / 처음으로"를 걷어냈다</b> (2026-08-31).

          저장 코스가 회원당 50개까지라 목록이 길어질 수 있어 둔 버튼이었다. 아래 "더보기"가
          그 문제를 <b>원인 쪽에서</b> 푼다 — 긴 목록을 빨리 지나가게 해 주는 대신
          애초에 길어지지 않게 한다. 둘을 함께 두면 세 곳(위·아래·더보기)에 이동 수단이 서서
          어느 것을 눌러야 할지가 오히려 흐려진다.
        */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {courses.slice(0, courseLimit).map((course) => (
                  <SavedCourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => setOpened(course.id)}
                    onDelete={() => setPendingDelete(course)}
                  />
                ))}
              </div>

              {courses.length > courseLimit && (
                <MoreButton
                  remaining={courses.length - courseLimit}
                  onClick={() => setCourseLimit((n) => n + COURSE_PAGE)}
                />
              )}
            </>
          )}

          {empty && (
            <div className="border-line flex flex-col items-center gap-3.5 rounded-[22px] border border-dashed px-6 py-12 text-center">
              <span
                className="bg-brand-tint text-brand-deep grid h-14 w-14 place-items-center rounded-[18px] text-2xl"
                aria-hidden="true"
              >
                <ArrowDownToLine size={24} />
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="text-fg text-[16.5px] font-bold">아직 저장한 코스가 없어요</span>
                <span className="text-muted max-w-[340px] text-[13.5px] leading-[1.6]">
                  한적한 {regionNameOf(defaultRegionSlug())} 여행을 계획하고 저장하면 여기에 모여요.
                </span>
              </div>
              {/*
            PRIMARY_BUTTON을 쓰지 않는다. 거기엔 w-full이 들어 있어서 w-auto를 덧붙이면
            둘 중 무엇이 이길지가 Tailwind의 출력 순서에 달린다 —
            클래스를 적은 순서가 아니라 스타일시트 순서로 정해지기 때문이다.
          */}
              {/*
            들어가는 문 둘. 홈의 진입점 두 개와 같은 짝이다.

            빈 화면에서 한쪽만 내밀면 <b>경주를 모르는 사람은 여기서 막힌다</b> —
            "코스 짜러 가기"는 갈 곳을 이미 아는 사람의 문이고, 30개 목록에서 장소를
            담는 일이 첫 관문이 된다. 저장한 코스가 없다는 것은 아직 한 번도 끝까지
            가보지 않았다는 뜻이라, 오히려 이 자리에 두 문이 다 있어야 한다.

            모양은 홈과 같게 둔다 — 직접 짜기는 채운 면, 추천받기는 흰 면에 브랜드 테두리.
            같은 기능이 화면마다 다르게 생기면 사용자가 같은 문인 줄 알아보지 못한다.
            둘 다 실제로 열리므로 어느 쪽도 흐리게 그리지 않는다.
          */}
              <div className="mt-1 flex w-full max-w-70 flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
                <Link
                  to="/plan"
                  className="bg-brand hover:bg-brand-hover shadow-cta rounded-ui text-fg grid h-13.5 place-items-center px-6 text-base font-semibold no-underline transition-colors"
                >
                  코스 짜러 가기
                </Link>
                <Link
                  to="/recommend"
                  className="border-brand bg-surface hover:bg-bg text-fg rounded-ui grid h-13.5 place-items-center border-[1.5px] px-6 text-base font-semibold no-underline transition-colors"
                >
                  코스 발견하기
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={paneClass('favorites')}>
          {/*
        ■ 찜한 곳.

        넓은 화면에서는 저장한 코스 <b>아래</b>에 이어 선다. 이 화면의 주인공은 코스이고
        찜은 그 재료다 — 언젠가 갈 곳을 모아 둔 것이지 완성된 여행이 아니다.
        좁은 화면에서는 위쪽 탭이 둘을 갈아끼운다.

        <p>⚠️ <b>한적도를 붙이지 않는다.</b> 찜은 날짜가 없는 표시라("언젠가 가고 싶다")
        어느 날 기준으로 재야 할지 정해지지 않는다. 날짜 없이 점수를 붙이면 화면이
        재지 않은 것을 말하게 된다 — 한적도는 여행 날짜가 정해진 진단 화면의 몫이다.
      */}
          <section
            id="my-favorites"
            className="border-line flex scroll-mt-24 flex-col gap-3 border-t pt-5 max-md:border-t-0 max-md:pt-0"
          >
            <div className="flex items-baseline gap-2">
              <h2 className="text-fg m-0 text-[16.5px] font-bold tracking-[-0.015em] md:text-[18px]">
                찜한 곳
              </h2>
              {favorites.length > 0 && (
                <span className="text-hint text-[12.5px]">{favorites.length}곳</span>
              )}
            </div>

            {/*
          ⚠️ 빈 화면인지는 <b>lingering</b>으로 가른다. 마지막 하나의 하트를 껐을 때
          favorites는 곧바로 0이 되는데, 그것으로 가르면 방금 끈 카드가 사라지고
          "아직 찜한 곳이 없어요"가 서 버린다 — 자리를 지키려던 것이 무의미해진다.
        */}
            {lingering.length === 0 ? (
              /*
            빈 안내를 <b>탭이 생기면서 세우게 됐다.</b> 예전에는 줄 자체를 그리지 않았는데,
            이제 좁은 화면에서 "찜한 장소" 탭을 누를 수 있으므로 눌렀는데 아무것도 없으면
            고장으로 읽힌다. 눌러서 온 자리는 비어 있더라도 <b>왜 비었는지</b>는 말해야 한다.
          */
              <div className="border-line flex flex-col items-center gap-2 rounded-[18px] border border-dashed px-5 py-9 text-center">
                <span className="text-hint" aria-hidden="true">
                  <Heart size={26} />
                </span>
                <span className="text-fg text-[14.5px] font-semibold">아직 찜한 곳이 없어요</span>
                <span className="text-muted text-[12.5px] leading-[1.6]">
                  장소를 열고 하트를 누르면 여기에 모여요.
                </span>
              </div>
            ) : (
              /*
            ■ 사진을 세운 <b>타일</b>이다

            한 줄짜리 이름표였다가 바꿨다. 이름만 늘어놓으면 "어디였더라"를 짚어주지 못한다 —
            찜은 언젠가 갈 곳을 모아 두는 자리라 <b>기억을 되살리는 그림</b>이 목록의 값이다.
            진단 화면의 좁은 화면 카드가 같은 이유로 사진을 배너로 세운다.

            <p>두 칸으로 나눠 사진이 <b>정사각형에 가깝게</b> 선다. 한 칸이면 사진이
            가로로 길어져 배너가 되고, 세 칸이면 이름이 두 줄로 접힌다.
          */
              /*
            ■ 진단 화면의 <b>좁은 화면 카드와 같은 모양</b>이다

            사진이 카드 폭을 가로지르고, 그 아래 이름·분류가 서고, 맨 아래를 버튼이 가로지른다.
            같은 것(장소 한 곳)을 보여주는 카드가 화면마다 다르게 생기면 사용자가
            매번 다시 읽는다 — 진단 화면에서 익힌 모양을 여기서도 그대로 쓴다.

            <p>한 줄에 하나가 아니라 <b>화면이 넓어지면 나란히</b> 선다. 진단 카드는 넓은
            화면에서 가로로 눕지만(사진·이름·버튼이 한 줄) 여기는 그럴 이유가 없다 —
            거기는 순서가 있는 일정이라 세로로 이어져야 하고, 찜은 순서 없는 모음이다.
          */
              <>
                {/*
            ⚠️ 넓은 화면에서 <b>넉 줄</b>이다. 코스가 셋일 때 찜도 셋이면, 카드 하나가
            훨씬 단순한데도(사진·이름·분류·버튼) 코스 카드와 같은 폭을 차지해
            <b>같은 무게의 것</b>으로 보인다. 이 화면의 주인공은 코스다.
          */}
                {/*
            ■ <b>좁은 화면은 한 줄에 하나, 가로로 눕힌다</b> (2026-09-02)

            두 칸 타일이었다. 사진을 세운 카드가 나란히 서면 <b>보기에는 좋지만
            이름이 두 줄로 접히고</b>, 찜은 "어디였는지 알아보는" 목록이라 이름이 잘리면
            카드가 하는 일을 못 한다. 가로로 누우면 사진은 100px 정사각으로 작아지는 대신
            <b>이름이 한 줄을 통째로</b> 쓴다 — 중고거래 앱들이 같은 이유로 이 모양을 쓴다.

            <p>세로 길이도 줄어든다. 사진 160px + 이름 + 분류 + 버튼이 세로로 쌓이던 것이
            사진 높이(100px) 안에 다 들어간다.

            <p><b>sm부터는 그대로다</b> — 두 칸 타일, lg는 넉 줄.
          */}
                <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-sm:grid-cols-1 max-sm:gap-2.5 lg:grid-cols-4">
                  {lingering.slice(0, favoriteLimit).map((favorite) => {
                    /*
                하트가 켜져 있는가는 <b>진짜 목록에게 묻는다.</b> 이 카드가 서 있다는 것과
                찜이 살아 있다는 것은 이제 다른 사실이다 — 끈 카드는 자리만 지키고 있다.
              */
                    const liked = isFavorite(favorite.placeId)

                    return (
                      <li
                        key={favorite.placeId}
                        className={`${CARD} relative flex flex-col overflow-hidden p-0 max-sm:flex-row max-sm:items-stretch`}
                      >
                        <PlaceThumbnail
                          name={favorite.placeName}
                          imageUrl={favorite.imageUrl}
                          size="banner"
                          /*
                    ⚠️ sm:부터 작은 정사각형으로 돌아가는 것을 <b>되돌린다.</b>
                    banner는 진단 카드가 넓은 화면에서 가로로 눕는 것을 전제로 만들어졌는데,
                    이 카드는 어느 폭에서나 세로다 — 그대로 두면 넓은 화면에서만
                    사진이 64px 조각으로 쪼그라든다.
                  */
                          className="max-sm:h-25 max-sm:w-25 max-sm:flex-none max-sm:text-[22px] sm:h-40 sm:w-full sm:rounded-none sm:text-[30px]"
                        />

                        {/*
                  하트를 사진 위 오른쪽에 얹는다. 진단 카드가 같은 자리에 한적도 배지를
                  두는데, 찜 목록에는 그 값이 없다(날짜가 정해지지 않은 표시라서) —
                  <b>그 자리를 하트가 받는다.</b>

                  <p>⚠️ 흐린 <b>동그란 바탕을 걷어냈다.</b> 사진 위에 회색 알약이 하나 떠 있는
                  것으로 보였다. 바탕이 하던 일(밝은 하늘에 하트가 묻히지 않게)은
                  <b>그림자</b>가 대신한다 — 하트 모양을 따라 지므로 네모난 자국이 남지 않고,
                  꺼진 하트의 가는 획도 함께 받쳐준다.
                */}
                        <button
                          type="button"
                          onClick={() =>
                            toggle({
                              id: favorite.placeId,
                              name: favorite.placeName,
                              categoryName: favorite.categoryName,
                              imageUrl: favorite.imageUrl,
                              /*
                        ⚠️ 지역까지 넘긴다. 이제 <b>이 자리에서 다시 켤 수 있어서</b>다 —
                        끈 카드가 남아 있으므로 되살리는 길이 생겼는데, 그때 지역을 빼놓으면
                        서버가 채워줄 때까지 그 카드의 "여행가기" 문이 사라진다.
                      */
                              region: favorite.region,
                              regionName: favorite.regionName,
                            })
                          }
                          aria-pressed={liked}
                          aria-label={`${favorite.placeName} ${liked ? '찜 취소' : '다시 찜하기'}`}
                          /*
                    꺼지면 <b>흰 테두리 하트</b>다. 사진 위라 text-hint(회색)로 두면
                    어두운 사진에서 통째로 묻힌다 — 밝은 사진은 그림자가, 어두운 사진은
                    흰색이 받친다.
                  */
                          /*
                    ⚠️ 좁은 화면에서는 <b>사진이 아니라 흰 면 위</b>에 선다 — 카드가 가로로
                    누우면서 오른쪽 끝이 흰 바탕이 됐다. 흰 하트는 거기서 보이지 않으므로
                    꺼진 하트를 회색으로 돌리고, 사진을 받치던 그림자도 함께 끈다.
                  */
                          className={`press absolute top-2.5 right-2.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent drop-shadow-[0_1px_3px_rgb(42_62_84/0.55)] max-sm:top-1 max-sm:right-1 max-sm:h-8 max-sm:w-8 max-sm:drop-shadow-none ${
                            liked ? 'text-like' : 'text-white max-sm:text-hint'
                          }`}
                        >
                          <Heart size={18} filled={liked} />
                        </button>

                        <div className="flex min-w-0 flex-col gap-0.5 px-4 pt-3.5 max-sm:flex-1 max-sm:justify-center max-sm:gap-1 max-sm:px-3.5 max-sm:py-2.5 max-sm:pr-10">
                          <p className="text-fg m-0 text-[17px] font-bold tracking-[-0.01em] max-sm:line-clamp-2 max-sm:text-[14.5px] max-sm:leading-[1.35]">
                            {favorite.placeName}
                          </p>
                          {/*
                    분류가 없는 찜이 있다. 이 칸이 서버에 생기기 전에 찜한 곳이다 —
                    <b>빈 줄을 세우지 않는다.</b> 자리만 비워두면 "안 불러온 값"으로 읽힌다.
                  */}
                          {favorite.categoryName && (
                            <p className="text-hint m-0 text-[12.5px] max-sm:text-[12px]">
                              {favorite.categoryName}
                            </p>
                          )}
                        </div>

                        {/*
                  ■ 카드 아래를 가로지르는 문 하나

                  진단 카드에서는 이 자리가 "새로운 곳 발견하기"이고 분류 옆에 "상세보기"가
                  작은 글자로 붙어 있다. 여기서는 <b>상세보기가 그 자리로 내려온다</b> —
                  찜 목록에서 할 일은 대안을 찾는 것이 아니라 <b>이곳이 어디였는지 보는 것</b>이라,
                  그 하나가 카드의 주된 행동이면 작은 글자로 둘 이유가 없다.
                */}
                        {/*
                  가로 카드에서는 이 문이 <b>글 아래 작은 단추</b>다. 카드 폭을 가로지르던
                  버튼을 그대로 두면 100px 사진 옆에서 폭을 다 먹어 이름이 설 자리를 뺏는다.
                */}
                        <div className="px-4 pt-3 pb-4 max-sm:absolute max-sm:right-3 max-sm:bottom-2.5 max-sm:p-0">
                          <button
                            type="button"
                            onClick={() => setOpenedPlace(favorite)}
                            aria-label={`${favorite.placeName} 상세보기`}
                            className="press border-line bg-surface text-fg hover:bg-bg rounded-ui h-11 w-full cursor-pointer border text-[13.5px] font-semibold transition-colors max-sm:h-7.5 max-sm:w-auto max-sm:rounded-[9px] max-sm:px-2.5 max-sm:text-[11.5px]"
                          >
                            상세보기
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* 더보기도 화면에 선 개수(lingering)로 센다. 남은 수와 실제로 펼쳐지는 수가 어긋나면 안 된다 */}
                {lingering.length > favoriteLimit && (
                  <MoreButton
                    remaining={lingering.length - favoriteLimit}
                    onClick={() => setFavoriteLimit((n) => n + FAVORITE_PAGE)}
                  />
                )}
              </>
            )}
          </section>
        </div>

        <div className={paneClass('trips')}>
          {/*
        ■ 여행 — 저장한 코스의 묶음.

        코스는 지역 하나에 잠겨 있어 한라산(제주시)과 성산일출봉(서귀포시)을 한 코스에
        담을 수 없다. 여행이 그 제약을 코스 위 한 층에서 푼다 — 지역이 달라도 묶인다.

        <p>⚠️ <b>여행 총점을 만들지 않는다.</b> 코스 총점의 평균은 이 화면에서 걷어낸
        "평균 한적 지수"와 같은 물건이다. 여행 카드는 기간·지역·코스 수 같은
        <b>묶음의 사실만</b> 말하고, 점수는 각 코스가 자기 배지로 갖고 있다.
      */}
          <section
            id="my-trips"
            className="border-line flex scroll-mt-24 flex-col gap-4 border-t pt-5"
          >
            {/*
          제목 줄. <b>저장한 코스 쪽과 같은 모양이다</b> — 왼쪽에 제목과 개수,
          오른쪽에 만드는 버튼. 두 탭이 같은 자리에서 같은 일을 하면
          탭을 옮겨도 손이 다시 자리를 찾지 않는다.
        */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-fg m-0 text-[16.5px] font-bold tracking-[-0.015em] md:text-[18px]">
                  여행
                </h2>
                {tripsState.status === 'loaded' && tripsState.trips.length > 0 && (
                  <span className="text-hint text-[12.5px]">{tripsState.trips.length}개</span>
                )}
              </div>

              <button
                type="button"
                className="bg-brand hover:bg-brand-hover grid h-9.5 cursor-pointer place-items-center rounded-[12px] border-0 px-4 text-[13.5px] font-semibold text-fg transition-colors"
                onClick={() => setCreatorOpen(true)}
              >
                여행 만들기
              </button>
            </div>

            {tripsState.status === 'error' && (
              <p className="text-hint m-0 text-[13px]">
                여행 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
              </p>
            )}

            {tripsState.status === 'loaded' && tripsState.trips.length === 0 && (
              /*
            빈 상태가 이 기능의 존재 이유를 말한다 — 지역이 달라도 묶인다.
            "여행이 없다"만 적으면 왜 만들어야 하는지가 화면에 없다.
          */
              <div className="border-line rounded-card flex flex-col items-center gap-1.5 border border-dashed px-5 py-8 text-center">
                <p className="text-fg m-0 text-[14.5px] font-semibold">아직 만든 여행이 없어요</p>
                <p className="text-hint m-0 text-[13px] leading-relaxed">
                  지역이 달라도 한 여행으로 묶을 수 있어요.
                  <br />
                  제주시 코스와 서귀포 코스를 묶어 "제주 한 바퀴"를 만들어 보세요.
                </p>
                {/*
              빈 화면에서 다음 할 일을 가리킨다. 만들기 버튼이 제목 줄 오른쪽으로 올라가면서
              <b>여기서 눈이 멈추면 갈 곳이 안 보인다</b> — 위를 다시 훑게 하지 않는다.
            */}
                <button
                  type="button"
                  className="text-brand-deep mt-1 cursor-pointer border-0 bg-transparent text-[13px] font-semibold hover:underline"
                  onClick={() => setCreatorOpen(true)}
                >
                  첫 여행 만들기
                </button>
              </div>
            )}

            {/*
          넓은 화면에서 <b>두 열</b>로 눕힌다. 한 열로 두면 카드가 1180px를 다 써서
          이름과 "삭제"가 화면 양 끝으로 갈라지고, 코스 이름과 배지 사이도 그만큼 벌어진다 —
          읽을 것은 두세 줄인데 눈이 가로로 먼 길을 간다.
          위의 저장한 코스가 이미 격자라 리듬도 이어진다.
        */}
            {tripsState.status === 'loaded' && tripsState.trips.length > 0 && (
              /*
                카드 사이를 <b>카드 안쪽 여백(18px)보다 넓게</b> 둔다. 14px였을 때
                카드 안 코스 줄 간격과 비슷해서 어디까지가 한 여행인지가 흐렸다.

                ⚠️ <b>{@code items-start}다 — 카드끼리 높이를 맞추지 않는다</b>(2026-09-01).
                격자의 기본값({@code stretch})으로 두었더니 <b>한 장에서 담기 목록을 펴면
                옆 카드가 같이 늘어났다</b>. 상관없는 여행이 따라 자라는 것은 고장으로
                읽히고, 특히 검색해서 결과가 늘 때마다 옆이 들썩인다.

                <p>짧은 카드 아래로 바탕이 드러나는 것은 그 대가다. 나란한 두 카드의
                아랫변이 맞는 것보다 <b>내가 건드린 카드만 움직이는 것</b>이 중요하다.
              */
              <ul className="m-0 grid list-none grid-cols-1 items-start gap-5 p-0 md:grid-cols-2">
                {pagedTrips.map((trip) => {
                  /*
                담은 순서가 아니라 <b>시작일순</b>으로 세운다. 여행은 폴더가 아니라 시간표다 —
                9월 10일 코스가 9월 8일 코스 위에 서 있으면 머리글의 기간과 목록이 서로 다른
                이야기를 한다. 담은 순서는 서버가 그대로 갖고 있어 되돌릴 수 있다.
              */
                  const ordered = orderCourses(trip.courses)
                  const first = ordered[0]
                  const last = ordered[ordered.length - 1]
                  const span = first ? daysBetween(first.startDate, last.endDate) + 1 : 0
                  const regions = [...new Set(ordered.map((course) => regionNameOf(course.region)))]
                  /*
                    이음새를 <b>그리기 전에</b> 센다. 잠금 판단(붉은 이음새가 있는가)은
                    상세 창이 <b>제 손으로</b> 다시 센다 — 창은 카드 없이도 열릴 수 있어야
                    하고, 같은 부품({@code seamsOf})을 쓰므로 두 곳의 답이 갈리지 않는다.
                  */
                  const seams = seamsOf(ordered)
                  const inTrip = new Set(trip.courses.map((course) => course.id))
                  const addable = courses.filter((course) => !inTrip.has(course.id))
                  /*
                    ■ 담을 코스를 <b>이름으로도, 지역으로도</b> 찾는다.

                    <p>지역만으로 걸렀더니 <b>이름을 아는 코스를 찾는 길이 없었다</b> —
                    "제주 가족여행"을 찾으려면 그 코스가 제주였는지 서귀포였는지를 먼저
                    떠올려야 했다. 이름은 사용자가 직접 붙인 것이라 지역보다 잘 기억된다.

                    <p>둘을 <b>OR로 본다.</b> 어느 쪽이든 걸리면 남긴다 — 한 칸에 두 가지를
                    받으면서 "지금 무엇으로 찾는 중인가"를 사용자가 고르게 하면,
                    찾기 전에 분류부터 하라는 말이 된다.

                    <p><b>지역 쪽은 {@code searchRegions}가 정한다.</b> "강원"이라 치면 속초와
                    춘천 코스가 남아야 하는데 짧은 이름에는 그 글자가 없다 — 짧은 이름·정식
                    이름·시도·슬러그를 함께 본다. 여기서 따로 맞춰보면 코스 짜기 화면의
                    검색과 다르게 동작한다.

                    <p>공백을 지우고 견준다. "제주 코스"를 "제주코스"로 쳐도 찾아야 한다.
                  */
                  const needle = pickerQuery.replace(/\s+/g, '').toLowerCase()
                  const matchedRegions = new Set(
                    searchRegions(pickerQuery).map((option) => option.slug),
                  )
                  const pickable = needle
                    ? addable.filter(
                        (course) =>
                          matchedRegions.has(course.region) ||
                          course.name.replace(/\s+/g, '').toLowerCase().includes(needle),
                      )
                    : addable
                  const pickerOpen = pickerTripId === trip.id

                  return (
                    /*
                      {@code h-full}을 걸었다가 걷어냈다(2026-09-01) — 위 {@code items-start}
                      주석 참고. 카드는 제 내용만큼만 차지한다.
                    */
                    <li key={trip.id} className={`${CARD} flex flex-col p-4.5`}>
                      {/*
                    ■ 머리글 — 이름이 이끌고 나머지는 물러난다.

                    예전에는 이름과 "삭제"가 같은 줄에서 같은 무게로 맞섰고, 그 아래 한 줄에
                    기간·지역·코스 수가 가운뎃점으로 이어져 <b>성격이 다른 넷이 한 무게</b>였다.
                    지금은 기간이 한 줄을 갖고(여행의 뼈대다) 지역이 그 아래 작게 선다.
                    코스 수는 적지 않는다 — 바로 아래 목록이 그 수를 이미 보여준다.

                    <p>담은 코스가 없으면 이 줄은 <b>비운다.</b> 여기에도 "아직 담은 코스가
                    없어요"를 적었더니 아래 안내와 <b>같은 말이 두 번</b> 섰다. 날짜가 설
                    자리이므로 날짜가 없으면 그냥 없는 것이 맞다.
                  */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <h3 className="text-fg m-0 text-[17.5px] leading-tight font-bold tracking-[-0.02em]">
                            {trip.name}
                          </h3>
                          {first ? (
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-muted text-[13px] font-medium">
                                {formatMonthDay(first.startDate)} – {formatMonthDay(last.endDate)}
                              </span>
                              <span className="text-hint text-[12.5px]">{span}일간</span>
                            </div>
                          ) : null}
                          {regions.length > 0 && (
                            <span className="text-hint text-[12.5px]">{regions.join(' · ')}</span>
                          )}
                        </div>

                        {/*
                      되돌릴 수 없는 일이라 <b>제목과 무게를 맞추지 않는다.</b> 확인 시트를
                      한 번 더 거치므로 바로 사라지지는 않지만, 자리부터 조용해야 한다.
                    */}
                        <button
                          type="button"
                          className="text-hint hover:text-crowded-deep -mt-0.5 -mr-1 flex-none cursor-pointer border-0 bg-transparent p-1 text-[12px] font-medium transition-colors"
                          onClick={() => setPendingTripDelete(trip)}
                        >
                          삭제
                        </button>
                      </div>

                      {/*
                    ■ 담긴 코스. <b>이름만, 앞의 셋만</b> 세운다.

                    날짜·점수·빼기를 걷어냈다(2026-09-01). 한 줄이 세 가지를 말하니
                    여행 이름 아래가 <b>코스 카드들의 요약본</b>이 되어, 정작 이 카드의
                    주인공(여행 이름·기간·지역)이 그 아래 묻혔다. 코스마다의 날짜와
                    점수는 코스 자신의 것이라 저장 목록에도 상세 창에도 있다.

                    전부 세웠더니 코스 수만큼 카드 높이가 달라져 목록이 들쭉날쭉했다 —
                    카드는 <b>훑는 자리</b>라 높이가 고르게 서야 한다.
                    나머지는 "상세보기"가 받는다.

                    <p>목록 자체는 상세 창과 <b>같은 부품</b>이다. 카드에서 보던 것과
                    펼쳐 본 것이 다르게 생기면 같은 여행으로 읽히지 않는다.
                  */}
                      {ordered.length === 0 ? (
                        /*
                          빈 여행이 <b>다음 할 일을 말한다.</b> 예전에는 만들자마자 담기
                          목록이 저절로 열려 그 자리를 대신했는데, 이제 열지 않으므로
                          비어 있다는 사실과 무엇을 하면 되는지를 카드가 직접 말해야 한다.
                        */
                        <p className="text-hint m-0 mt-3.5 text-[13px] leading-[1.6]">
                          아직 여행에 아무 코스도 없어요.
                          <br />
                          아래 <span className="text-muted font-semibold">코스 담기</span>로 코스를
                          추가해 보세요.
                        </p>
                      ) : (
                        <div className="mt-3.5">
                          <TripCourseList
                            ordered={ordered}
                            seams={seams}
                            limit={TRIP_CARD_COURSES}
                            compact
                            onOpenCourse={(courseId) => setOpened(courseId)}
                            onRemove={(courseId) => void handleRemoveFromTrip(trip.id, courseId)}
                            onShowAll={() => setDetailTripId(trip.id)}
                          />
                        </div>
                      )}

                      {/*
                    ■ 행동. <b>하나가 이끈다.</b> 둘 다 테두리 버튼이면 무엇을 먼저 할지
                    화면이 말하지 않는다. 이 탭에서 자주 하는 일은 <b>담기</b>이고
                    ("이어서 짜기"는 화면을 떠나는 큰 걸음이다), 그래서 담기가 채운 버튼이다.
                  */}
                      {/*
                    ⚠️ <b>코스가 없으면 버튼이 폭을 다 쓰지 않는다.</b> 빈 여행이 채워진 여행보다
                    크게 외치는 것을 막는다 — 목록에서 가장 눈에 띄는 것이 "아직 비었다"가
                    되어서는 안 된다. 코스가 있으면 둘이 반씩 나눠 쓴다.
                  */}
                      <div className="flex gap-2 pt-4">
                        {/*
                          ⚠️ <b>채운 브랜드색이 아니라 옅은 브랜드색</b>이다(2026-09-01).
                          카드마다 채운 틸 버튼이 서니 <b>한 화면에 여섯 개</b>가 되어,
                          가장 강한 색이 반복되면서 강조가 아니라 배경 무늬가 됐다 —
                          머리글의 "여행 만들기"와도 무게가 겹쳤다. 이 탭에서 채운 틸은
                          <b>만들기 하나</b>가 갖고, 카드 안에서는 담기가 옅은 브랜드색으로
                          앞서고 상세보기가 테두리로 따라온다.

                          <p>빈 여행에서도 <b>같은 폭</b>이다. {@code w-fit}으로 줄여 두었더니
                          같은 버튼이 카드마다 크기가 달라 서로 다른 것으로 보였다.

                          ⚠️ 열렸을 때를 <b>테두리가 아니라 옅은 채움</b>으로 말한다.
                          {@code border-line … border}로 두었더니 <b>테두리가 아예 안 그려져</b>
                          버튼이 맨 글자로 떴다 — 앞에 붙은 {@code border-0}과 다투는데,
                          이길 쪽은 class에 적은 순서가 아니라 Tailwind가 CSS를 뽑아낸 순서로
                          정해진다(로그아웃 버튼이 같은 함정에 빠졌던 자리다). 채움은 그 다툼이
                          없고, 뜻 없는 옅은 바탕에는 {@code --c-fill}을 쓴다.
                        */}
                        <button
                          type="button"
                          aria-expanded={pickerOpen}
                          className={`h-10 flex-1 cursor-pointer rounded-[12px] border-0 px-4 text-[13.5px] font-semibold transition-colors ${
                            pickerOpen
                              ? 'bg-fill text-fg hover:bg-line/45'
                              : 'bg-brand-soft text-brand-deep hover:bg-brand hover:text-fg'
                          }`}
                          onClick={() => togglePicker(trip.id)}
                        >
                          {pickerOpen ? '닫기' : '코스 담기'}
                        </button>
                        {/*
                      ⚠️ <b>"이어서 짜기"를 걷어낸 자리다</b>(2026-09-01). 마지막 코스
                      다음 날로 코스 짜기에 들어가는 문이었는데, 여행 탭에서 하는 일은
                      <b>모아 둔 것을 보는 일</b>이지 새로 만드는 일이 아니다.
                      만드는 문은 저장 코스 쪽 빈 상태와 아래 이동 막대에 이미 있다.

                      <p>대신 <b>펼쳐 본다.</b> 카드는 앞의 셋만 세우므로 나머지 코스를
                      보는 길이 여기다. 창 안에서 <b>날짜로 이어 붙인 일정</b>으로도
                      갈아끼울 수 있다 — 코스는 지역 하나에 잠겨 있어 카드가 코스별로
                      끊겨 있는데, 정작 여행하는 사람에게 필요한 답은
                      "9월 10일에 나는 어디 있나"다.

                      <p>⚠️ 이 버튼 자체는 <b>잠기지 않는다</b>(2026-09-01). "한번에 보기"였을
                      때는 날짜가 겹치면 통째로 잠갔는데, 이제 이 문이 <b>코스 목록으로 가는
                      유일한 길</b>이기도 하다 — 겹쳤다는 이유로 목록까지 막으면 겹친 것을
                      고치러 들어갈 수조차 없다. 잠기는 것은 창 안의 일정 탭 하나다.
                    */}
                        {ordered.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDetailTripId(trip.id)}
                            className="border-line bg-surface text-fg hover:bg-bg h-10 flex-1 cursor-pointer rounded-[12px] border text-[13.5px] font-semibold transition-colors"
                          >
                            상세보기
                          </button>
                        )}
                      </div>

                      {/*
                    ■ 담을 코스. <b>테두리 상자를 두르지 않는다</b> — 카드 안의 카드가 되어
                    어느 것이 내용이고 어느 것이 그릇인지 흐려진다. 카드 면 위에 줄로만 눕히고
                    위쪽 실선 하나로 앞의 것과 가른다.
                  */}
                      {pickerOpen &&
                        (addable.length === 0 ? (
                          <p className="border-line text-hint m-0 mt-3.5 border-t pt-3.5 text-[12.5px]">
                            {courses.length === 0
                              ? '저장한 코스가 아직 없어요. 코스를 먼저 저장해 주세요.'
                              : '저장한 코스가 모두 이 여행에 담겨 있어요.'}
                          </p>
                        ) : (
                          <div className="border-line mt-3.5 flex flex-col gap-2 border-t pt-3.5">
                            <span className="text-hint text-[11.5px] font-semibold">담을 코스</span>

                            {/*
                              ■ 이름·지역으로 좁히기.

                              여행은 <b>지역이 다른 코스를 묶으려고</b> 만든 것이라, 이 목록에는
                              저장한 코스가 지역 구분 없이 전부 올라온다 — 코스가 쌓일수록
                              "제주 것만 먼저 담자"도, "그 가족여행 코스 어디 갔지"도 어려워진다.
                              코스 짜기·발견에서 지역을 칩 묶음에서 검색으로 바꾼 것과
                              같은 문제이고 같은 해법이다.

                              <p><b>지역 목록을 띄우지 않는다.</b> 여기서 고르는 것은 지역이
                              아니라 코스라, 목록을 띄우면 고를 것이 두 층이 된다.
                              친 글자에 맞는 코스만 남긴다.

                              <p>⚠️ <b>치기 전에는 아무것도 세우지 않는다</b>(2026-09-01).
                              열자마자 저장한 코스가 전부 쏟아지면, 담을 코스를 찾으려고 연
                              자리에서 <b>목록을 훑는 일이 먼저</b>가 된다 — 코스가 쌓일수록
                              카드가 그만큼 길어지기도 한다. 찾을 것을 아는 사람만 여는
                              자리라, 칸 하나만 세우고 기다린다. 무엇으로 찾는지는
                              {@code placeholder}가 말한다.

                              <p>칸은 카드 안에 들어가므로 <b>{@code TEXT_INPUT}보다 낮다.</b>
                              폼 화면의 기본 높이(52px)를 그대로 쓰면 아래 코스 줄보다 칸이
                              커서, 담는 일보다 찾는 일이 커 보인다.
                            */}
                            <input
                              type="search"
                              value={pickerQuery}
                              onChange={(event) => setPickerQuery(event.target.value)}
                              placeholder="코스 이름이나 지역으로 찾기"
                              aria-label="담을 코스를 이름이나 지역으로 찾기"
                              autoComplete="off"
                              className="border-line bg-surface text-fg rounded-ui h-10 w-full border px-3 font-sans text-[13.5px] transition-colors"
                            />

                            {!needle ? null : pickable.length === 0 ? (
                              <p className="text-hint m-0 py-1.5 text-[12.5px]">
                                "{pickerQuery.trim()}"에 해당하는 코스가 없어요.
                              </p>
                            ) : (
                              <ul className="m-0 flex list-none flex-col p-0">
                                {pickable.map((course) => (
                                  <li key={course.id} className="flex items-center gap-3 py-2">
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                      <span className="text-fg truncate text-[13.5px] font-semibold">
                                        {course.name}
                                      </span>
                                      {/*
                                        날짜 표기를 <b>위 목록과 같게</b> 둔다. 여기만
                                        "10월 2일부터 2일"이었는데, 바로 위 코스 줄은
                                        "10월 2일 – 10월 3일"이라 <b>한 카드 안에서 같은 것을
                                        두 말로</b> 적고 있었다.
                                      */}
                                      <span className="text-hint text-[11.5px]">
                                        {regionNameOf(course.region)} ·{' '}
                                        {formatMonthDay(course.startDate)} –{' '}
                                        {formatMonthDay(course.endDate)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="bg-brand-soft text-brand-deep hover:bg-brand hover:text-fg rounded-chip h-8 flex-none cursor-pointer border-0 px-3.5 text-[12.5px] font-semibold transition-colors"
                                      onClick={() => void handleAddToTrip(trip.id, course.id)}
                                    >
                                      담기
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                    </li>
                  )
                })}
              </ul>
            )}

            {/*
              ■ 쪽 넘기기.

              "더보기"를 쓰지 않는다. 더보기는 목록을 <b>늘리기만</b> 해서, 스무 개를
              담아 둔 사람이 아래쪽 여행을 보려면 카드 스무 장을 지나쳐야 한다 —
              여행은 코스와 달리 하나가 여러 줄을 쓴다. 쪽을 넘기면 지나칠 것이 없다.

              <p>⚠️ <b>가로로 미는 상자를 만들지 않는다.</b> 끝까지 민 제스처가 페이지로
              이어져 화면 전체가 옆으로 밀린다(CLAUDE.md). 옆으로 <b>넘기는</b> 것이지
              옆으로 <b>미는</b> 것이 아니다 — 버튼을 눌러 쪽을 갈아끼운다.

              <p>쪽 번호를 전부 세운다. 지금 몇 쪽인지, 몇 쪽이 있는지가 함께 보이고,
              여행 쪽수는 많아야 서넛이라 번호가 줄을 넘길 일이 없다.
            */}
            {tripPageCount > 1 && (
              <nav aria-label="여행 쪽 넘기기" className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  aria-label="이전 쪽"
                  disabled={currentTripPage === 0}
                  onClick={() => setTripPage(currentTripPage - 1)}
                  className="text-muted hover:bg-fill grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border-0 bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <ChevronLeft />
                </button>

                {Array.from({ length: tripPageCount }, (_, page) => {
                  const active = page === currentTripPage
                  return (
                    <button
                      key={page}
                      type="button"
                      aria-label={`${page + 1}쪽`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setTripPage(page)}
                      className={`h-9 min-w-9 cursor-pointer rounded-[11px] border-0 px-2 font-mono text-[13px] font-semibold transition-colors ${
                        active ? 'bg-fg text-white' : 'text-muted hover:bg-fill bg-transparent'
                      }`}
                    >
                      {page + 1}
                    </button>
                  )
                })}

                <button
                  type="button"
                  aria-label="다음 쪽"
                  disabled={currentTripPage === tripPageCount - 1}
                  onClick={() => setTripPage(currentTripPage + 1)}
                  className="text-muted hover:bg-fill grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border-0 bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <ChevronRight />
                </button>
              </nav>
            )}
          </section>
        </div>

        {/*
        계정.

        계정 관리 화면을 따로 두지 않고 여기로 합쳤다. 화면을 하나 더 거치게 할 만큼
        내용이 많지 않고, 로그아웃·탈퇴와 같은 자리에서 끝나는 편이 찾기 쉽다.

        <p>⚠️ <b>좁은 화면에서는 넷째 탭이다</b> (2026-09-01). 예전에는 코스·찜·여행
        <b>세 목록을 전부 지나친 맨 아래</b>에 있어서, 코스가 쌓일수록 로그아웃까지 가는 길이
        길어졌다 — 목록 길이가 계정 관리의 비용을 정하고 있었던 셈이다.
        넓은 화면에서는 예전처럼 아래에 이어 서고, 왼쪽 버튼이 한 번에 데려간다.
      */}
        <div className={paneClass('account')}>
          <section
            id="my-account"
            className="border-line flex scroll-mt-24 flex-col gap-3 border-t pt-5"
          >
            <span className="text-hint text-[12.5px] font-semibold">계정</span>

            {/*
          이메일에는 변경 버튼이 없다. 이메일이 곧 로그인 아이디라 바꾸려면
          "그 주소가 정말 본인 것인가"를 메일로 확인하는 절차가 따라와야 한다.
          그 절차 없이 바꾸게 두면 남의 주소를 적어 계정을 잠글 수 있다.
        */}
            <div className={`${CARD} flex flex-col px-4`}>
              {/* 소셜 전용 회원은 이메일이 없다. 빈 칸이면 고장으로 읽히니 이유를 적는다 */}
              <AccountRow label="이메일" value={member.email ?? '간편 로그인으로 가입한 계정'} />
              <AccountRow
                label="닉네임"
                value={member.nickname}
                action={
                  <button
                    type="button"
                    className={ROW_ACTION}
                    onClick={() => setAccountSheet('nickname')}
                  >
                    변경
                  </button>
                }
              />
              <AccountRow
                label="비밀번호"
                value="••••••••"
                last
                action={
                  <button
                    type="button"
                    className={ROW_ACTION}
                    onClick={() => setAccountSheet('password')}
                  >
                    변경
                  </button>
                }
              />
            </div>

            {/*
          ■ 약관·처리방침 (2026-09-02)

          가입할 때 동의하고 지나간 글을 <b>다시 읽을 자리</b>가 어디에도 없었다.
          동의를 받았으면 그 내용을 언제든 다시 볼 수 있어야 한다.

          <p>계정 카드와 <b>같은 모양의 줄</b>이다 — 이메일·닉네임 옆의 "변경"과 같은
          자리에 "보기"가 선다. 다른 모양으로 두면 계정 화면 안에 문법이 둘이 된다.

          <p>⚠️ 새 화면으로 보내지 않고 <b>시트로 덮는다.</b> 가입 화면이 같은 이유로
          시트를 쓴다 — 읽고 돌아왔을 때 있던 자리가 그대로여야 한다.
        */}
            <div className={`${CARD} flex flex-col px-4`}>
              <AccountRow
                label="약관"
                value="서비스 이용약관"
                action={
                  <button type="button" className={ROW_ACTION} onClick={() => setOpenedDoc('tos')}>
                    보기
                  </button>
                }
              />
              <AccountRow
                label="정책"
                value="개인정보 처리방침"
                last
                action={
                  <button
                    type="button"
                    className={ROW_ACTION}
                    onClick={() => setOpenedDoc('privacy')}
                  >
                    보기
                  </button>
                }
              />
            </div>

            {/*
          붉은 기를 <b>테두리와 글자에만</b> 준다. 채워버리면 탈퇴 같은 되돌릴 수 없는 일과
          같은 무게가 되는데, 로그아웃은 다시 들어오면 그만인 일이다.

          <b>SECONDARY_BUTTON에 색을 덧붙이지 않고 클래스를 다시 적었다.</b>
          덧붙이면 border-line·text-fg와 같은 속성을 두 클래스가 다투는데, 이길 쪽은
          class에 적은 순서가 아니라 Tailwind가 CSS를 뽑아낸 순서로 정해진다.
          실제로 확인해보니 .border-crowded-soft가 .border-line보다 앞에 있어
          회색 테두리가 이겼다 — 눌러보기 전에는 멀쩡해 보이는 종류의 어긋남이다.
        */}
            <button
              type="button"
              className="border-crowded-soft text-crowded-deep hover:bg-crowded-tint rounded-ui bg-surface min-h-13 w-full cursor-pointer border text-[15px] font-semibold transition-colors"
              /*
            로그아웃만 하고 화면 이동은 시키지 않는다. member가 비면 위 가드가
            <b>홈으로</b> 보낸다 — 같은 일을 두 곳에서 시키면 둘이 어긋나는 날이 온다.
          */
              onClick={logout}
            >
              로그아웃
            </button>

            {/*
          탈퇴는 맨 아래 마지막 줄이다. 되돌릴 수 없는 일이 목록 가운데 끼어 있으면
          다른 것을 누르러 왔다가 손이 스친다.

          로그아웃보다 <b>조용하게</b> 둔다. 테두리 없이 글자만 남겨, 위험한 쪽이
          더 눈에 띄는 역전이 생기지 않게 한다. 누르면 비밀번호를 한 번 더 묻는
          시트가 떠서 바로 사라지지는 않는다.
        */}
            <button
              type="button"
              className="text-crowded-deep hover:bg-crowded-tint rounded-ui min-h-11 w-full cursor-pointer bg-transparent text-[13.5px] font-medium transition-colors"
              onClick={() => setAccountSheet('delete')}
            >
              회원 탈퇴
            </button>

            <p className="text-muted m-0 px-1 text-center text-[12px] leading-[1.6]">
              탈퇴하면 저장한 코스가 함께 사라지고 되돌릴 수 없어요.
              <br />
              저장 기능만 필요 없다면 로그아웃으로 충분해요.
            </p>
          </section>
        </div>

        {openedDoc && <LegalSheet docId={openedDoc} onClose={() => setOpenedDoc(null)} />}

        {detailTrip && (
          <TripDetailSheet
            trip={detailTrip}
            onClose={() => setDetailTripId(null)}
            /*
              코스 상세는 <b>겹창을 갈아끼워</b> 연다. 시트 위에 시트를 또 띄우면
              닫기가 두 번이 되고, 뒤 화면 잠금도 두 겹이 된다.
            */
            onOpenCourse={(courseId) => {
              setDetailTripId(null)
              setOpened(courseId)
            }}
            onRemoveCourse={(courseId) => void handleRemoveFromTrip(detailTrip.id, courseId)}
          />
        )}

        {opened !== null && (
          <CourseDetailOverlay
            courseId={opened}
            onClose={() => setOpened(null)}
            onOpenInFlow={openInFlow}
          />
        )}

        {/*
        찜한 곳 펼쳐 보기. 한적도는 넘기지 않는다 — 찜은 날짜가 없는 표시라
        어느 날 기준으로 재야 할지 정해지지 않는다. 시트는 값이 없으면 배지를 그리지 않는다.

        <p>"이 장소로 여행가기"({@code onPlanTrip})도 넘기지 않는다. 그 버튼은 <b>지역과
        날짜를 아는 자리</b>에서만 선다(홈의 한적한 곳은 둘 다 안다). 찜에는 날짜가 없으므로
        여기서 열면 시트가 그 문을 세우지 않는다.
      */}
        {openedPlace && (
          <PlaceDetailSheet
            placeId={openedPlace.placeId}
            placeName={openedPlace.placeName}
            categoryName={openedPlace.categoryName}
            imageUrl={openedPlace.imageUrl}
            /*
            ⚠️ <b>지역을 아는 찜에만</b> 이 문을 세운다. 지역이 코스의 단위라, 모르는 채로
            조건 화면을 열면 사용자가 아무 지역이나 고르게 되고 그 장소는 <b>검색으로도
            찾을 수 없는 칸</b>이 된다(조건 화면이 지역이 어긋난 씨앗을 버린다).

            <p>지역을 모르는 찜은 이 칸이 생기기 전에 찜한 것뿐이다. 하트를 껐다 켜면 채워진다.
          */
            onPlanTrip={openedPlace.region === null ? undefined : () => planTripFrom(openedPlace)}
            onClose={() => setOpenedPlace(null)}
          />
        )}

        <AccountSheets
          open={accountSheet}
          onClose={() => setAccountSheet(null)}
          onDone={(text) => setNotice({ tone: 'ok', text })}
        />

        {creatorOpen && (
          <CreateTripSheet onCreate={handleCreateTrip} onClose={() => setCreatorOpen(false)} />
        )}

        {pendingTripDelete && (
          <ConfirmSheet
            title={`"${pendingTripDelete.name}" 여행을 지울까요?`}
            description={'묶음만 사라져요.\n담겨 있던 코스는 저장 목록에 그대로 남아요.'}
            confirmLabel="지우기"
            cancelLabel="그대로 두기"
            danger
            busy={deletingTrip}
            onConfirm={() => void handleDeleteTrip()}
            onCancel={() => setPendingTripDelete(null)}
          />
        )}

        {pendingDelete && (
          <ConfirmSheet
            title={`"${pendingDelete.name}"을(를) 지울까요?`}
            description={'지운 코스는 되돌릴 수 없어요.\n계정에서 완전히 사라집니다.'}
            confirmLabel="지우기"
            cancelLabel="그대로 두기"
            danger
            busy={deleting}
            onConfirm={() => void handleDelete()}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </div>
  )
}
