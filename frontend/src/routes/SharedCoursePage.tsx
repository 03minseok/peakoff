import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageStub } from '../components/PageStub'
import { PlaceDetailSheet } from '../components/PlaceDetailSheet'
import { PublicCourseArticle } from '../components/PublicCourseSheet'
import { ApiRequestError, fetchSharedCourse } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { PublicPlace, SharedCourse } from '../types/api'
import { formatDateRange, formatNights } from '../utils/date'

type Phase =
  | { status: 'loading' }
  | { status: 'loaded'; course: SharedCourse }
  /** 토큰이 없거나 코스가 지워졌다(404). 잘못 친 주소와 만료된 링크를 화면은 가르지 못한다 */
  | { status: 'missing' }
  | { status: 'error'; message: string }

/**
 * 공유 링크 `/s/{token}` — 다른 사람이 보낸 코스를 로그인 없이 본다.
 *
 * <h3>왜 시트가 아니라 페이지인가</h3>
 * 홈의 {@code PublicCourseSheet}는 목록 위에 <b>겹쳐</b> 뜬다. 링크로 들어온 사람에게는 그 아래
 * 깔릴 화면이 없다 — 홈을 깔고 시트를 띄우면 닫는 순간 낯선 홈에 서게 되고, 왜 여기 왔는지 잊는다.
 * 그래서 본문({@code PublicCourseArticle})만 같은 것을 쓰고 껍데기는 페이지다. Layout 안이라
 * 헤더의 로고와 바닥의 출처가 함께 선다.
 *
 * <h3>할 수 있는 일은 둘</h3>
 * 보기, 그리고 <b>"이 코스로 짜보기"</b>. 받은 사람은 주인이 아니라 고칠 수 없고, 베껴 와서
 * 자기 날짜로 짜는 것이 이 화면의 출구다 — 홈의 남들 코스와 같은 규칙, 같은 길이다.
 *
 * <h3>⚠️ 코스 id는 여기도 없다</h3>
 * 주소에 실린 것은 추측 불가한 토큰이고 응답에도 id가 없다. 이 화면이 아는 것으로는
 * 마이페이지의 그 코스에 닿을 수 없다 — 그래야 링크가 "보여주기"에서 끝난다.
 */
export function SharedCoursePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { restore } = useTrip()
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  /** 코스 안에서 펼친 장소. 없으면 시트가 서지 않는다 */
  const [openedPlace, setOpenedPlace] = useState<PublicPlace | null>(null)

  useEffect(() => {
    if (token === '') {
      setPhase({ status: 'missing' })
      return
    }
    const controller = new AbortController()
    setPhase({ status: 'loading' })
    fetchSharedCourse(token, controller.signal)
      .then((course) => setPhase({ status: 'loaded', course }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') {
          setPhase({ status: 'missing' })
          return
        }
        setPhase({
          status: 'error',
          message:
            error instanceof ApiRequestError
              ? error.message
              : '코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
        })
      })
    return () => controller.abort()
  }, [token])

  /*
    홈의 copyToFlow와 같은 일이다. 장소와 순서만 가져가고 날짜는 여기서 고른 것을 쓴다.
    캐시는 fetchSharedCourse가 이미 심었다 — 여기서 또 심지 않는다(HomePage 주석과 같은 이유).
  */
  function copyToFlow(course: SharedCourse, startDate: string) {
    const days: string[][] = Array.from({ length: course.days }, () => [])
    course.places.forEach((place) => {
      days[place.day - 1]?.push(place.placeId)
    })
    restore({ region: course.region, startDate, nights: course.nights }, days)
    navigate('/course')
  }

  if (phase.status === 'loading') {
    return (
      <section className="mx-auto w-full lg:max-w-[560px]">
        <p className="text-hint py-10 text-center text-sm" role="status">
          코스를 불러오는 중…
        </p>
      </section>
    )
  }

  if (phase.status === 'missing' || phase.status === 'error') {
    return (
      <section className="mx-auto flex w-full flex-col gap-4 lg:max-w-[560px]">
        <PageStub
          step="공유된 코스"
          title={phase.status === 'missing' ? '링크가 만료됐거나 지워진 코스예요' : '코스를 불러오지 못했어요'}
          description={
            phase.status === 'missing'
              ? '보낸 사람이 코스를 지웠거나 주소가 잘려서 왔을 수 있어요. 링크를 다시 받아 보세요.'
              : phase.message
          }
        />
        <Link to="/" className="text-brand-deep text-sm font-semibold">
          처음으로
        </Link>
      </section>
    )
  }

  const { course } = phase
  // "경상북도 경주시" → "경주시". 시트와 같은 잘라내기 — 같은 코스가 두 곳에서 다르게 읽히면 안 된다.
  const shortRegion = course.regionName.replace(/^.*\s/, '')

  return (
    <section className="mx-auto flex w-full flex-col gap-4 lg:max-w-[560px]">
      {/*
        머리글. 시트의 "저장된 여행"에 해당하는 자리인데 여기는 누가 보냈는지가 먼저다 —
        링크를 받은 사람은 "OO님이 보낸 코스"라는 맥락으로 이 화면에 왔다.
      */}
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-brand-deep m-0 text-xs font-semibold tracking-[0.12em]">공유된 코스</p>
        <h1 className="text-fg m-0 text-[22px] font-bold tracking-[-0.02em]">
          {course.nickname}님이 보낸 {course.regionShortName} 여행
        </h1>
      </header>

      <PublicCourseArticle
        course={course}
        /* 여기서는 코스 이름이 제목이다 — 받은 사람이 무엇을 받았는지는 이름이 말한다 */
        title={course.name}
        subtitle={`${shortRegion} ${formatNights(course.nights)} · ${formatDateRange(course.startDate, course.nights)}`}
        onCopyToFlow={(startDate) => copyToFlow(course, startDate)}
        onOpenPlace={setOpenedPlace}
      />

      {/*
        코스 안의 장소 펼쳐 보기. 홈의 시트와 <b>같은 규칙</b>이다 — 한적도도
        "이 장소로 여행가기"도 넘기지 않는다(HomePage 주석 참고).

        <p>여기는 위가 시트가 아니라 페이지라 순서를 다툴 상대가 없다.
      */}
      {openedPlace && (
        <PlaceDetailSheet
          placeId={openedPlace.placeId}
          placeName={openedPlace.name}
          categoryName={openedPlace.place?.categoryName ?? null}
          imageUrl={openedPlace.place?.imageUrl ?? null}
          onClose={() => setOpenedPlace(null)}
        />
      )}

      <Link to="/" className="text-brand-deep self-start text-sm font-semibold">
        PEAKOFF 둘러보기
      </Link>
    </section>
  )
}
