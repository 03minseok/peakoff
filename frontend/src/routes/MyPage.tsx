import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { CourseDetailOverlay } from '../components/CourseDetailOverlay'
import { SavedCourseCard } from '../components/SavedCourseCard'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/styles'
import { deleteSavedCourse, fetchSavedCourses } from '../services/api'
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

export function MyPage() {
  const navigate = useNavigate()
  const { member, loading: authLoading, logout } = useAuth()
  const { restore } = useTrip()

  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  /** 겹창에 펼칠 코스. 비어 있으면 닫힌 상태 */
  const [opened, setOpened] = useState<number[]>([])

  const load = useCallback((signal?: AbortSignal) => {
    setList({ status: 'loading' })
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
  const stats = useMemo(() => {
    const loaded = list.status === 'loaded' ? list.courses : []
    if (loaded.length === 0) {
      return { count: 0, average: '—', past: 0 }
    }
    const total = loaded.reduce((sum, course) => sum + course.totalQuietness, 0)
    return {
      count: loaded.length,
      average: String(Math.round(total / loaded.length)),
      past: loaded.filter((course) => isPastDate(course.endDate)).length,
    }
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

  async function handleDelete(course: SavedCourseSummary) {
    if (!window.confirm(`"${course.name}"을(를) 지울까요? 되돌릴 수 없어요.`)) {
      return
    }
    try {
      await deleteSavedCourse(course.id)
      // 서버가 지운 뒤 목록을 다시 읽는다. 화면에서만 지우면 실제로 지워졌는지 알 수 없다.
      setSelected((current) => current.filter((id) => id !== course.id))
      load()
    } catch {
      window.alert('코스를 지우지 못했어요. 잠시 후 다시 시도해 주세요.')
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
    navigate('/course')
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
          {[
            { label: '저장한 코스', value: String(stats.count) },
            { label: '평균 한적 지수', value: stats.average },
            { label: '다녀온 여행', value: String(stats.past) },
          ].map((stat) => (
            <div key={stat.label} className="flex min-w-16 flex-col items-center gap-0.5">
              <span className={STAT_VALUE}>{stat.value}</span>
              <span className="text-hint text-[11.5px]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 md:hidden">
        {[
          { label: '저장한 코스', value: String(stats.count) },
          { label: '평균 한적 지수', value: stats.average },
          { label: '다녀온 여행', value: String(stats.past) },
        ].map((stat) => (
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
                className="bg-brand hover:bg-brand-hover grid h-9.5 cursor-pointer place-items-center rounded-[12px] px-4 text-[13.5px] font-semibold text-white no-underline transition-colors"
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
              onDelete={() => void handleDelete(course)}
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
            ↓
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-fg text-[16.5px] font-bold">아직 저장한 코스가 없어요</span>
            <span className="text-muted max-w-[340px] text-[13.5px] leading-[1.6]">
              한적한 경주 여행을 계획하고 저장하면 여기에 모여요.
            </span>
          </div>
          <Link
            to="/plan"
            className={`${PRIMARY_BUTTON} mt-1 grid w-auto place-items-center px-6 no-underline`}
          >
            코스 짜러 가기
          </Link>
        </div>
      )}

      {/*
        계정 관리.
        여기에는 로그아웃만 둔다. 닉네임 변경·비밀번호 변경·회원탈퇴는 성격이 달라
        (되돌리기 어렵거나 확인이 필요한 일) 계정 관리 화면으로 따로 묶는다.
      */}
      <section className="border-line flex flex-col gap-3 border-t pt-5">
        <span className="text-hint text-[12.5px] font-semibold">계정</span>
        <button
          type="button"
          className={`${SECONDARY_BUTTON} w-full md:w-auto md:px-6`}
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          로그아웃
        </button>
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
              className="bg-brand shadow-cta disabled:bg-line disabled:text-hint disabled:shadow-none mx-auto flex h-13 w-full max-w-[430px] cursor-pointer items-center justify-center rounded-ui text-base font-semibold text-white disabled:cursor-not-allowed"
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
    </div>
  )
}
