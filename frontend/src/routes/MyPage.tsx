import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, Close } from '../components/icons'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AccountSheets } from '../components/AccountSheets'
import type { AccountSheet } from '../components/AccountSheets'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { CourseDetailOverlay } from '../components/CourseDetailOverlay'
import { SavedCourseCard } from '../components/SavedCourseCard'
import { CARD } from '../components/styles'
import { ApiRequestError, deleteSavedCourse, fetchSavedCourses } from '../services/api'
import { useAuth } from '../state/authContext'
import { useTrip } from '../state/tripContext'
import type { SavedCourseDetail, SavedCourseSummary } from '../types/api'
import { isPastDate } from '../utils/date'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; courses: SavedCourseSummary[] }
  | { status: 'error' }

/** 비교는 두 개를 맞대는 일이다. 셋을 늘어놓으면 어느 쪽이 나은지 판단이 흐려진다. */
const COMPARE_COUNT = 2

const STAT_VALUE = 'text-fg font-mono text-[19px] font-semibold'

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
  const { restore } = useTrip()

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
   * <p>list를 의존성으로 둔다. courses를 렌더 중에 만들면(로딩 중에는 새 빈 배열)
   * 매 렌더 참조가 바뀌어 useMemo가 무의미해진다.
   */
  const stats = useMemo(() => {
    const loaded = list.status === 'loaded' ? list.courses : []
    if (loaded.length === 0) {
      return [
        { label: '저장한 코스', value: '0' },
        { label: '평균 한적 지수', value: '—' },
        { label: '다녀온 여행', value: '0' },
      ]
    }
    const total = loaded.reduce((sum, course) => sum + course.totalQuietness, 0)
    return [
      { label: '저장한 코스', value: String(loaded.length) },
      { label: '평균 한적 지수', value: String(Math.round(total / loaded.length)) },
      {
        label: '다녀온 여행',
        value: String(loaded.filter((course) => isPastDate(course.endDate)).length),
      },
    ]
  }, [list])

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
            : '코스를 지우지 못했어요. 잠시 후 다시 시도해 주세요.',
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

    restore(
      { region: course.region, startDate: course.startDate, nights: course.nights },
      days,
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
  if (!member) {
    return <Navigate to="/login" replace />
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
      */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface shadow-rest flex flex-col items-center gap-0.75 rounded-[14px] p-3"
          >
            <span className={STAT_VALUE}>{stat.value}</span>
            <span className="text-hint text-[11.5px]">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* 섹션 헤더 */}
      <section className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-5">
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
          저장한 코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
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
            className={`text-[13px] ${
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
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
              한적한 경주 여행을 계획하고 저장하면 여기에 모여요.
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
              코스 추천받기
            </Link>
          </div>
        </div>
      )}

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
          onClick={() => {
            logout()
            navigate('/')
          }}
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
          탈퇴하면 저장한 코스가 함께 사라지고 되돌릴 수 없어요. 저장 기능만 필요 없다면
          로그아웃으로 충분해요.
        </p>
      </section>

      {/*
        모바일 비교 CTA. 목록을 훑으며 고르는 동안 버튼이 따라온다.
        bottom-15로 BottomNav(60px) 바로 위에 얹는다 — 겹치면 둘 다 못 누른다.
      */}
      {selecting && (
        <div className="fixed right-0 bottom-15 left-0 z-40 md:bottom-0">
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

      <AccountSheets
        open={accountSheet}
        onClose={() => setAccountSheet(null)}
        onDone={(text) => setNotice({ tone: 'ok', text })}
      />

      {pendingDelete && (
        <ConfirmSheet
          title={`"${pendingDelete.name}"을(를) 지울까요?`}
          description="지운 코스는 되돌릴 수 없어요. 계정에서 완전히 사라집니다."
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
