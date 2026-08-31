import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Close, Heart } from '../components/icons'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AccountSheets } from '../components/AccountSheets'
import type { AccountSheet } from '../components/AccountSheets'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { CourseDetailOverlay } from '../components/CourseDetailOverlay'
import { PlaceDetailSheet } from '../components/PlaceDetailSheet'
import { PlaceThumbnail } from '../components/PlaceThumbnail'
import { SavedCourseCard } from '../components/SavedCourseCard'
import { CARD } from '../components/styles'
import { ApiRequestError, deleteSavedCourse, fetchSavedCourses } from '../services/api'
import { useAuth } from '../state/authContext'
import { useFavorites } from '../state/favoriteContext'
import { defaultRegionSlug, regionNameOf } from '../constants/regions'
import { useBrowserChromeInset } from '../hooks/useBrowserChromeInset'
import { useTrip } from '../state/tripContext'
import type { FavoritePlace, SavedCourseDetail, SavedCourseSummary } from '../types/api'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; courses: SavedCourseSummary[] }
  | { status: 'error' }

/** 비교는 두 개를 맞대는 일이다. 셋을 늘어놓으면 어느 쪽이 나은지 판단이 흐려진다. */
const COMPARE_COUNT = 2

const STAT_VALUE = 'text-fg font-mono text-[19px] font-semibold'

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
type MyTab = 'courses' | 'favorites'

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
  const { favorites, toggle } = useFavorites()
  const { restore } = useTrip()
  // 아래 고정 CTA가 브라우저 도구막대 뒤로 숨지 않게 하는 보정.
  const chromeInset = useBrowserChromeInset()
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
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  /** 겹창에 펼칠 코스. 비어 있으면 닫힌 상태 */
  const [opened, setOpened] = useState<number[]>([])
  /** 지울지 묻고 있는 코스. null이면 확인 시트가 닫힌 상태 */
  const [pendingDelete, setPendingDelete] = useState<SavedCourseSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  /**
   * 일회성 알림. 창을 띄우지 않고 목록 위에 띠로 보여준다.
   *
   * <p>성공과 실패가 같은 자리를 쓴다. 자리를 나누면 알림 칸이 둘 생기고 대부분의 시간 동안
   * 둘 다 비어 있다. {@code tone}으로 색과 역할(alert/status)만 가른다.
   */
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  /** 열려 있는 계정 시트. 입력값과 처리 상태는 AccountSheets가 들고 있다 */
  const [accountSheet, setAccountSheet] = useState<AccountSheet | null>(null)

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

  /*
   * list를 의존성으로 둔다. courses를 렌더 중에 만들면(로딩 중에는 새 빈 배열)
   * 매 렌더 참조가 바뀌어 useMemo가 무의미해진다.
   */
  /**
   * 프로필 옆(넓은 화면)과 아래(좁은 화면)가 함께 쓰는 통계.
   *
   * <h3>둘은 세는 값이자 <b>가는 문</b>이다</h3>
   * 좁은 화면에서 "저장한 코스"·"찜한 곳" 칸이 그대로 탭이 된다({@code tab} 필드).
   * 아래에 탭 막대를 따로 뒀다가 걷어냈다 — <b>같은 두 낱말이 화면에 두 번</b> 서고,
   * 위의 숫자와 아래의 숫자가 같은 것을 두 번 세는 꼴이었다.
   * 이미 그 수를 말하고 있는 칸이 그 목록으로 가는 문이 되는 편이 짧다.
   *
   * <p>"평균 한적 지수"에는 {@code tab}이 없다. 갈 목록이 없는 값이라 눌러도 갈 곳이 없다.
   *
   * <p>순서는 <b>저장한 코스 → 찜한 곳 → 나머지</b>다. 앞의 둘이 탭이므로 나란히 붙어야
   * 하나의 스위치로 읽힌다 — 사이에 누를 수 없는 칸이 끼면 셋 다 버튼처럼 보인다.
   *
   * <p>list를 의존성으로 둔다. courses를 렌더 중에 만들면(로딩 중에는 새 빈 배열)
   * 매 렌더 참조가 바뀌어 useMemo가 무의미해진다.
   */
  const stats = useMemo(() => {
    const loaded = list.status === 'loaded' ? list.courses : []
    if (loaded.length === 0) {
      return [
        { label: '저장한 코스', value: '0', tab: 'courses' as const },
        { label: '찜한 곳', value: String(favorites.length), tab: 'favorites' as const },
        { label: '평균 한적 지수', value: '—', tab: undefined },
      ]
    }
    /*
     * 평균은 <b>진단된 코스만</b>으로 낸다. 점수 없는 코스를 0으로 세면 아직 재보지도 않은
     * 코스가 평균을 끌어내리고, 분모에 넣으면 저장만 해도 평균이 떨어진다.
     * 진단된 코스가 하나도 없으면 평균이라는 값 자체가 성립하지 않는다.
     */
    const scored = loaded.filter((course) => course.totalQuietness !== null)
    const total = scored.reduce((sum, course) => sum + (course.totalQuietness ?? 0), 0)
    return [
      { label: '저장한 코스', value: String(loaded.length), tab: 'courses' as const },
      /*
       * ⚠️ 이 칸이 <b>"다녀온 여행"에서 "찜한 곳"으로</b> 바뀌었고 자리도 둘째로 왔다.
       *
       * 지난 여행 수는 이 화면에서 <b>할 일이 없는 숫자</b>였다 — 늘기만 하고 눌러도
       * 아무 데도 가지 않으며, 여행이 끝났다는 사실은 코스 카드마다 이미 적혀 있다.
       * 찜한 곳은 아래 목록과 짝이 되는 값이고, 이제 그 목록으로 가는 문이기도 하다.
       */
      { label: '찜한 곳', value: String(favorites.length), tab: 'favorites' as const },
      {
        label: '평균 한적 지수',
        value: scored.length === 0 ? '—' : String(Math.round(total / scored.length)),
        tab: undefined,
      },
    ]
  }, [list, favorites])

  const courses = list.status === 'loaded' ? list.courses : []

  function toggleSelect(id: number) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id)
      }
      // 이미 두 개를 골랐으면 가장 먼저 고른 것을 밀어낸다.
      // "먼저 지우고 다시 고르세요"라고 막는 것보다 손이 덜 간다.
      return current.length < COMPARE_COUNT ? [...current, id] : [current[1], id]
    })
  }

  async function handleDelete() {
    if (!pendingDelete) {
      return
    }
    setDeleting(true)
    setNotice(null)
    try {
      await deleteSavedCourse(pendingDelete.id)
      setSelected((current) => current.filter((id) => id !== pendingDelete.id))
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
      { region: course.region, startDate: course.startDate, nights: course.nights },
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
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-5.5 px-4 pt-5 pb-10 md:max-w-app md:px-0">
      {/* 프로필 */}
      <section className="flex items-center gap-3.5 md:gap-4.5">
        <span
          className="bg-quiet-tint text-brand-deep grid h-14 w-14 flex-none place-items-center rounded-[18px] text-[23px] font-bold md:h-16 md:w-16 md:rounded-[20px] md:text-[26px]"
          aria-hidden="true"
        >
          {member.nickname.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="text-fg text-[19px] font-bold tracking-[-0.015em] md:text-[22px]">
            {member.nickname}
          </span>
          <span className="text-hint truncate text-[13px]">{member.email}</span>
        </div>

        {/* 넓은 화면에서는 통계가 프로필 옆에 선다. 좁으면 아래로 내려간다 */}
        <div className="hidden flex-none gap-3.5 md:flex">
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-16 flex-col items-center gap-0.5">
              <span className={STAT_VALUE}>{stat.value}</span>
              <span className="text-hint text-[11.5px]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/*
        좁은 화면용 통계. 위와 같은 stats를 돌린다 — 목록을 두 벌로 적으면
        항목을 하나 더할 때 한쪽만 고쳐져 화면 크기에 따라 다른 내용이 나온다.
        배치만 다르고(옆줄 vs 카드 3칸) 내용은 한 곳에서 온다.

        <p>■ <b>앞의 두 칸이 곧 탭이다</b> (2026-08-31)

        아래에 탭 막대를 따로 뒀다가 걷어냈다. <b>같은 두 낱말이 화면에 두 번</b> 서고,
        위의 숫자와 아래의 숫자가 같은 것을 두 번 세는 꼴이었다 — 게다가 통계 줄과
        탭 줄이 같은 폭의 상자 셋·둘로 잇달아 서서 어느 쪽이 누르는 것인지 흐렸다.
        이미 그 수를 말하고 있는 칸이 그 목록으로 가는 문이 되는 편이 짧다.

        <p>켜진 칸은 <b>어두운 면</b>이다. 편집 화면의 일차 탭과 같은 신호라
        "지금 이걸 보고 있다"가 화면을 옮겨도 같은 모양으로 읽힌다.

        <p>⚠️ 셋째 칸("평균 한적 지수")은 <b>버튼이 아니다.</b> 갈 목록이 없는 값이라
        눌러도 갈 곳이 없다. 그래서 {@code div}로 남기고 손가락 커서도 주지 않는다 —
        앞의 둘 중 하나는 언제나 켜져 있으므로, 셋이 늘어서도 어느 둘이 스위치인지 보인다.
      */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {stats.map((stat) => {
          const active = stat.tab !== undefined && stat.tab === tab
          const shell = 'flex flex-col items-center gap-0.75 rounded-[14px] p-3 transition-colors'

          if (stat.tab === undefined) {
            return (
              <div key={stat.label} className={`bg-surface shadow-rest ${shell}`}>
                <span className={STAT_VALUE}>{stat.value}</span>
                <span className="text-hint text-[11.5px]">{stat.label}</span>
              </div>
            )
          }

          return (
            <button
              key={stat.label}
              type="button"
              aria-current={active}
              onClick={() => setTab(stat.tab)}
              className={`cursor-pointer border-0 ${shell} ${
                active ? 'bg-fg' : 'bg-surface shadow-rest'
              }`}
            >
              <span className={`${STAT_VALUE} ${active ? 'text-white' : ''}`}>{stat.value}</span>
              <span className={`text-[11.5px] ${active ? 'text-white/70' : 'text-hint'}`}>
                {stat.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className={paneClass('courses')}>

      {/* 섹션 헤더 */}
      <section className="flex flex-wrap items-center justify-between gap-3 border-line border-t pt-5 md:border-t md:pt-5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-fg m-0 text-[16.5px] font-bold tracking-[-0.015em] md:text-[18px]">
            내가 저장한 코스
          </h2>
          {courses.length > 0 && (
            <span className="text-hint text-[12.5px]">{courses.length}개</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selecting ? (
            <>
              <span className="text-muted hidden text-[13px] sm:inline">
                {selected.length < COMPARE_COUNT
                  ? `비교할 코스 2개를 선택하세요 (${selected.length}/2)`
                  : '2개 선택 완료'}
              </span>
              <button
                type="button"
                className="border-line bg-surface text-muted hover:bg-bg h-9.5 cursor-pointer rounded-[12px] border px-3.5 text-[13.5px] font-semibold transition-colors"
                onClick={() => {
                  setSelecting(false)
                  setSelected([])
                }}
              >
                취소
              </button>
              {/* 비교 실행 버튼은 아래 고정 바 한 곳에만 둔다.
                  헤더에도 같은 버튼을 두면 어느 것을 눌러야 하는지 갈린다. */}
            </>
          ) : (
            <>
              {/* 하나뿐이면 비교할 상대가 없다 */}
              {courses.length >= COMPARE_COUNT && (
                <button
                  type="button"
                  className="border-line bg-surface text-fg hover:bg-bg h-9.5 cursor-pointer rounded-[12px] border px-3.5 text-[13.5px] font-semibold transition-colors"
                  onClick={() => setSelecting(true)}
                >
                  코스 비교
                </button>
              )}
              <Link
                to="/plan"
                className="bg-brand hover:bg-brand-hover grid h-9.5 cursor-pointer place-items-center rounded-[12px] px-4 text-[13.5px] font-semibold text-fg no-underline transition-colors"
              >
                새 코스 짜기
              </Link>
            </>
          )}
        </div>
      </section>

      {selecting && (
        <p className="border-quiet-soft bg-quiet-tint text-brand-deep m-0 rounded-[14px] border px-3.5 py-2.75 text-[12.5px] leading-[1.5] sm:hidden">
          {selected.length < COMPARE_COUNT
            ? `비교할 코스 2개를 선택하세요 (${selected.length}/2)`
            : '2개 선택 완료 · 아래 버튼을 누르세요'}
        </p>
      )}

      {list.status === 'error' && (
        <p className="bg-crowded-tint text-crowded-deep rounded-card m-0 p-4 text-center text-[13px]">
          저장한 코스를 불러오지 못했어요.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
      )}

      {/*
        일회성 알림. 창을 띄우는 대신 띠로 두어 화면 흐름을 끊지 않는다.

        role이 tone에 따라 다르다. 실패는 alert(하던 일을 끊고 읽어야 한다),
        성공은 status(방해하지 않고 알린다). 성공에까지 alert를 쓰면 화면 낭독기가
        매번 사용자를 멈춰 세운다.
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

      {list.status === 'loading' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="bg-surface shadow-rest rounded-[20px] p-4.5">
              <div className="skeleton mb-3 h-4.5 w-32" />
              <div className="skeleton mb-4 h-3 w-24" />
              <div className="skeleton h-14 w-full rounded-[14px]" />
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
              selecting={selecting}
              selected={selected.includes(course.id)}
              onOpen={() => setOpened([course.id])}
              onToggleSelect={() => toggleSelect(course.id)}
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
      <section className="border-line flex flex-col gap-3 border-t pt-5 max-md:border-t-0 max-md:pt-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-fg m-0 text-[16.5px] font-bold tracking-[-0.015em] md:text-[18px]">
            찜한 곳
          </h2>
          {favorites.length > 0 && (
            <span className="text-hint text-[12.5px]">{favorites.length}곳</span>
          )}
        </div>

        {favorites.length === 0 ? (
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
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.slice(0, favoriteLimit).map((favorite) => (
              <li
                key={favorite.placeId}
                className={`${CARD} relative flex flex-col overflow-hidden p-0`}
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
                  className="sm:h-40 sm:w-full sm:rounded-none sm:text-[30px]"
                />

                {/*
                  하트를 사진 위 오른쪽에 얹는다. 진단 카드가 같은 자리에 한적도 배지를
                  두는데, 찜 목록에는 그 값이 없다(날짜가 정해지지 않은 표시라서) —
                  <b>그 자리를 하트가 받는다.</b>

                  <p>흐린 검정 바탕을 깐다. 공사 사진은 밝은 하늘이 많아 빨간 하트만
                  얹으면 묻힌다.
                */}
                <button
                  type="button"
                  onClick={() =>
                    toggle({
                      id: favorite.placeId,
                      name: favorite.placeName,
                      // 지우는 길이라 이 값들은 쓰이지 않지만, 되돌릴 때 그대로 복원된다
                      categoryName: favorite.categoryName,
                      imageUrl: favorite.imageUrl,
                    })
                  }
                  aria-label={`${favorite.placeName} 찜 취소`}
                  className="press text-like absolute top-2.5 right-2.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-[rgb(42_62_84/0.42)]"
                >
                  <Heart size={18} filled />
                </button>

                <div className="flex min-w-0 flex-col gap-0.5 px-4 pt-3.5">
                  <p className="text-fg m-0 text-[17px] font-bold tracking-[-0.01em]">
                    {favorite.placeName}
                  </p>
                  {/*
                    분류가 없는 찜이 있다. 이 칸이 서버에 생기기 전에 찜한 곳이다 —
                    <b>빈 줄을 세우지 않는다.</b> 자리만 비워두면 "안 불러온 값"으로 읽힌다.
                  */}
                  {favorite.categoryName && (
                    <p className="text-hint m-0 text-[12.5px]">{favorite.categoryName}</p>
                  )}
                </div>

                {/*
                  ■ 카드 아래를 가로지르는 문 하나

                  진단 카드에서는 이 자리가 "새로운 곳 발견하기"이고 분류 옆에 "상세보기"가
                  작은 글자로 붙어 있다. 여기서는 <b>상세보기가 그 자리로 내려온다</b> —
                  찜 목록에서 할 일은 대안을 찾는 것이 아니라 <b>이곳이 어디였는지 보는 것</b>이라,
                  그 하나가 카드의 주된 행동이면 작은 글자로 둘 이유가 없다.
                */}
                <div className="px-4 pt-3 pb-4">
                  <button
                    type="button"
                    onClick={() => setOpenedPlace(favorite)}
                    aria-label={`${favorite.placeName} 상세보기`}
                    className="press border-line bg-surface text-fg hover:bg-bg rounded-ui h-11 w-full cursor-pointer border text-[13.5px] font-semibold transition-colors"
                  >
                    상세보기
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {favorites.length > favoriteLimit && (
            <MoreButton
              remaining={favorites.length - favoriteLimit}
              onClick={() => setFavoriteLimit((n) => n + FAVORITE_PAGE)}
            />
          )}
          </>
        )}
      </section>

      </div>

      {/*
        계정.

        계정 관리 화면을 따로 두지 않고 여기로 합쳤다. 화면을 하나 더 거치게 할 만큼
        내용이 많지 않고, 로그아웃·탈퇴와 같은 자리에서 끝나는 편이 찾기 쉽다.

        "로그인 정보"라는 작은 제목은 붙이지 않았다. 바로 위에 "계정"이 이미 서 있어
        라벨이 두 줄로 겹친다.
      */}
      <section className="border-line flex flex-col gap-3 border-t pt-5">
        <span className="text-hint text-[12.5px] font-semibold">계정</span>

        {/*
          이메일에는 변경 버튼이 없다. 이메일이 곧 로그인 아이디라 바꾸려면
          "그 주소가 정말 본인 것인가"를 메일로 확인하는 절차가 따라와야 한다.
          그 절차 없이 바꾸게 두면 남의 주소를 적어 계정을 잠글 수 있다.
        */}
        <div className={`${CARD} flex flex-col px-4`}>
          <AccountRow label="이메일" value={member.email} />
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

        <p className="text-muted m-0 px-1 text-[12px] leading-[1.6]">
          탈퇴하면 저장한 코스가 함께 사라지고 되돌릴 수 없어요.
          <br />
          저장 기능만 필요 없다면 로그아웃으로 충분해요.
        </p>
      </section>

      {/*
        모바일 비교 CTA. 목록을 훑으며 고르는 동안 버튼이 따라온다.
        아래 고정 막대가 사라져 이제 바닥에 바로 붙는다.

        <b>여전히 브라우저 도구막대만큼 끌어올린다.</b> 화면 바닥에 붙는 요소가 이것
        하나만 남았을 뿐, 크롬이 레이아웃 화면의 바닥을 도구막대 뒤에 깔아 두는 것은
        그대로라 보정이 없으면 이 버튼이 막대 뒤로 숨는다.
      */}
      {selecting && (
        <div
          className="fixed right-0 bottom-0 left-0 z-40"
          style={chromeInset > 0 ? { transform: `translateY(-${chromeInset}px)` } : undefined}
        >
          <div className="from-bg/0 to-bg h-6 bg-linear-to-b" aria-hidden="true" />
          <div className="bg-bg px-4 pb-3">
            <button
              type="button"
              disabled={selected.length < COMPARE_COUNT}
              onClick={() => setOpened(selected)}
              className="bg-brand shadow-cta disabled:bg-line disabled:text-hint disabled:shadow-none mx-auto flex h-13 w-full max-w-[430px] cursor-pointer items-center justify-center rounded-ui text-base font-semibold text-fg disabled:cursor-not-allowed"
            >
              {selected.length < COMPARE_COUNT
                ? `2개를 선택하세요 (${selected.length}/2)`
                : '선택한 2개 나란히 비교'}
            </button>
          </div>
        </div>
      )}

      {opened.length > 0 && (
        <CourseDetailOverlay
          courseIds={opened}
          onClose={() => setOpened([])}
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
          onPlanTrip={
            openedPlace.region === null ? undefined : () => planTripFrom(openedPlace)
          }
          onClose={() => setOpenedPlace(null)}
        />
      )}

      <AccountSheets
        open={accountSheet}
        onClose={() => setAccountSheet(null)}
        onDone={(text) => setNotice({ tone: 'ok', text })}
      />

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
  )
}
