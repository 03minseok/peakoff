import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Close, Route } from './icons'
import { CourseMap } from './CourseMap'
import { PlaceThumbnail } from './PlaceThumbnail'
import { LEVEL_COLOR_VAR, LEVEL_TINT } from './levelStyles'
import { DatePicker } from './DatePicker'
import { fetchForecastWindow } from '../services/api'
import type { Place, PublicCourse, PublicPlace, SharedCourse } from '../types/api'
import {
  addDays,
  formatDateRange,
  formatKoreanDate,
  formatMonthDay,
  formatNights,
  formatWeekday,
  today,
} from '../utils/date'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props {
  course: PublicCourse
  onClose: () => void
  /**
   * 이 코스를 그대로 내 편집 화면에 담는다.
   *
   * <p>⚠️ <b>날짜는 이 시트가 받아서 넘긴다.</b> 남의 코스에서 가져오는 것은 장소와
   * 순서이고, 언제 떠날지는 베끼는 사람이 정할 일이다 — 남의 출발일을 그대로 물려주면
   * 이미 지난 날짜이기 십상이고(예측 밖이라 진단이 통째로 빈다), 지나지 않았더라도
   * 그 사람 사정에 맞춘 날이다.
   */
  onCopyToFlow: (course: PublicCourse, startDate: string) => void
  /**
   * 코스 안의 장소 하나를 펼쳐 본다.
   *
   * <p>⚠️ <b>시트가 스스로 열지 않고 넘겨받는다.</b> 장소 상세도 시트라, 이 시트 안에서
   * 띄우면 <b>패널 안에 갇힌다</b> — 패널이 올라오는 애니메이션 동안 {@code position: fixed}가
   * 패널을 기준으로 잡히기 때문이다. 마이페이지가 겹창과 장소 상세를 <b>화면 층에서 나란히</b>
   * 세우는 것과 같은 방식으로, 부르는 쪽이 이 시트 뒤에 세운다.
   */
  onOpenPlace?: (place: PublicPlace) => void
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
 *
 * <p>■ <b>본문은 {@link PublicCourseArticle}로 떼어 두었다</b> (2026-09-09). 공유 링크
 * 화면({@code SharedCoursePage})이 같은 코스를 시트 없이 한 페이지로 펴는데, 두 곳이 장소
 * 목록·게이지·"이 코스로 짜보기"를 따로 그리면 같은 코스가 홈과 링크에서 다르게 보인다.
 */
export function PublicCourseSheet({ course, onClose, onCopyToFlow, onOpenPlace }: Props) {
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

  // "경상북도 경주시" → "경주시". 카드가 좁아 앞쪽 도명까지는 들어가지 않는다.
  const shortRegion = course.regionName.replace(/^.*\s/, '')

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] lg:max-h-[82svh] lg:max-w-[560px] lg:rounded-[24px]"
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
            저장된 여행
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted hover:bg-line/40 grid h-8.5 w-8.5 cursor-pointer place-items-center rounded-chip bg-transparent text-base press"
          >
            <Close />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PublicCourseArticle
            course={course}
            /* 홈 카드와 같은 제목을 쓴다. 눌러서 열었는데 제목이 달라지면 같은 코스로 안 읽힌다 */
            title={`${course.nickname}님의 ${course.regionShortName}`}
            subtitle={`${shortRegion} ${formatNights(course.nights)} · ${formatDateRange(course.startDate, course.nights)}`}
            onCopyToFlow={(startDate) => onCopyToFlow(course, startDate)}
            onOpenPlace={onOpenPlace}
          />
        </div>
      </div>
    </div>
  )
}

interface ArticleProps {
  /**
   * 홈 목록의 코스({@link PublicCourse})거나 공유 링크의 코스({@link SharedCourse}).
   * 뒤쪽은 <b>점수가 비어 있을 수 있다</b> — 진단 전 코스도 공유되기 때문이다.
   */
  course: PublicCourse | SharedCourse
  title: string
  subtitle: string
  /** 날짜를 고르고 나면 부른다. 장소·순서는 {@code course}가 이미 들고 있다 */
  onCopyToFlow: (startDate: string) => void
  /** 없으면 장소 줄이 눌리지 않는다 — 읽기만 하는 자리가 된다 */
  onOpenPlace?: (place: PublicPlace) => void
}

/**
 * 코스 한 장의 본문 — 제목·게이지·일차별 장소·"이 코스로 짜보기".
 * 시트({@link PublicCourseSheet})와 공유 링크 화면이 함께 쓴다.
 */
export function PublicCourseArticle({
  course,
  title,
  subtitle,
  onCopyToFlow,
  onOpenPlace,
}: ArticleProps) {
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

  /**
   * 고른 출발일. <b>빈 문자열이면 아직 안 골랐다.</b>
   *
   * <h3>왜 미리 채워두지 않는가</h3>
   * 남의 출발일을 넣어두면 <b>그 날로 가겠다고 고른 것처럼</b> 보인다. 이 시트가 묻는 것은
   * 딱 하나이므로 그 하나만큼은 사용자가 실제로 골라야 한다 — 조건 화면에서
   * 기본 선택을 걷어낸 것과 같은 판단이다.
   *
   * <h3>왜 시트 안에서 묻는가</h3>
   * 조건 화면으로 보내면 지역·기간까지 다시 묻게 된다. 그 둘은 <b>베껴 오는 코스가 이미
   * 정하고 있다</b> — 장소가 그 지역의 것이고, 일차 수가 곧 기간이다.
   * 이미 답이 있는 것을 다시 묻는 화면은 베끼는 일을 번거롭게만 만든다.
   */
  /*
    오늘로 연다. 예전에는 빈 값으로 두고 고르기 전까지 버튼을 잠갔는데, 달력은 늘 어느 한 날을
    가리키고 있어야 한다(코스 짜기 화면과 같은 규칙). 오늘이 서 있고 사용자가 옮긴다.
  */
  const [startDate, setStartDate] = useState(() => today())

  /** 날짜를 묻는 중인가. 버튼을 누르기 전에는 이 시트가 <b>읽는 자리</b>다 */
  const [picking, setPicking] = useState(false)

  /** 동선을 펼쳤는가. 닫혀 있는 동안에는 지도를 아예 만들지 않는다 */
  const [mapOpen, setMapOpen] = useState(false)

  /*
    ⚠️ {@code useMemo}가 필수다. 매 렌더 새 배열을 만들면 CourseMap의 다시 그리기 effect가
    매번 돌아 지도가 깜박인다 — 진단·최종 화면이 같은 이유로 memo를 쓴다.
  */
  const mapPlaces = useMemo<Place[]>(
    () =>
      course.places
        .map((place) => place.place)
        .filter((place): place is Place => place !== null),
    [course.places],
  )
  /*
    일차별로 선을 따로 긋는다. 하나로 이으면 <b>밤사이 이동이 경로처럼</b> 보인다.
    지도에 못 오른 장소(좌표 없음)는 여기서도 빠져야 선이 끊긴 자리를 건너뛰지 않는다.
  */
  const mapRoutes = useMemo(() => {
    const onMap = new Set(mapPlaces.map((place) => place.id))
    return Array.from({ length: course.days }, (_, index) =>
      course.places
        .filter((place) => place.day === index + 1 && onMap.has(place.placeId))
        .map((place) => place.placeId),
    ).filter((route) => route.length > 0)
  }, [course.places, course.days, mapPlaces])

  /**
   * 예측이 닿는 마지막 날. 코스 짜기 화면과 <b>같은 달력</b>을 쓰므로 같은 값을 넘긴다 —
   * 이게 없으면 여기서 고른 달력에만 앰버 점이 안 떠, 두 화면의 달력이 다른 물건으로 보인다.
   * 못 받아오면 null이고, 달력은 점 없이 서 있다(없는 제약을 설명하는 것보다 조용한 편이 낫다).
   */
  const [forecastEnd, setForecastEnd] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchForecastWindow(controller.signal)
      .then((window) => setForecastEnd(window.lastDate))
      .catch(() => setForecastEnd(null))
    return () => controller.abort()
  }, [])
  const beyondForecast = forecastEnd !== null && startDate > forecastEnd

  /*
    점수 셋을 한 번에 좁힌다. 서버가 셋을 함께 null로 내리므로(SharedCourseView) 하나만 봐도
    되지만, 타입이 그것을 알지 못해 셋을 다 확인한다.
  */
  const level = course.level
  const quietness = course.totalQuietness
  const scored = level !== null && quietness !== null && course.levelLabel !== null

  return (
    <article className="bg-surface shadow-rest flex flex-col gap-3.5 rounded-card p-4.5 lg:p-5">
      <div className="flex flex-col gap-1">
        <span className="text-fg text-[16.5px] font-bold tracking-[-0.01em]">{title}</span>
        <span className="text-hint text-[12.5px]">{subtitle}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* 마이페이지 겹창과 같은 원형 게이지 — 같은 값이 화면마다 다르게 보이면 안 된다 */}
        <div
          className="grid h-[92px] w-[92px] flex-none place-items-center rounded-full p-2"
          style={{
            /*
              점수가 없으면 띠를 채우지 않는다. 0%로 그리면 결과는 같지만 "0점"을 그린 것이 된다 —
              마이페이지 카드가 등급색을 입히지 않는 것과 같은 이유다.
            */
            background: scored
              ? `conic-gradient(${LEVEL_COLOR_VAR[level]} ${quietness}%, var(--c-line) 0)`
              : 'var(--c-line)',
          }}
        >
          <div className="bg-surface flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full">
            <span className="text-fg font-mono text-[26px] leading-none font-semibold">
              {/* 0으로 채우지 않는다. 0은 "매우 붐빔"으로 읽혀 없는 것과 뜻이 정반대다 */}
              {scored ? quietness : '—'}
            </span>
            <span className="text-hint text-[10.5px]">한적 지수</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5">
          {scored ? (
            <span
              className={`rounded-full px-2.75 py-1 text-[12.5px] font-semibold ${LEVEL_TINT[level]}`}
            >
              {course.levelLabel}
            </span>
          ) : (
            <span className="bg-bg text-hint rounded-full px-2.75 py-1 text-[12.5px] font-semibold">
              아직 진단 전
            </span>
          )}
          <span className="text-muted text-[12.5px]">담긴 장소 {course.places.length}곳</span>
          {/*
            저장 시점의 점수라는 것을 밝힌다. 예측은 매일 갱신되므로 지금 다시 계산하면
            다른 값이 나온다 — 계산하지 않은 것을 지금 값처럼 말하지 않는다.
          */}
          <span className="text-hint text-[11.5px]">
            {scored ? '저장할 때의 점수예요' : '저장할 때 진단하지 않은 코스예요'}
          </span>
        </div>
      </div>

      <div className="border-line/60 flex flex-col gap-4 border-t pt-4">
        {byDay.map((places, index) => (
          <div key={index} className="flex flex-col gap-2">
            {/*
              일차 옆에 <b>실제 날짜</b>를 적는다. "1일차"만으로는 언제 떠나는 여행인지
              위 부제("9월 23일 → 9월 24일")를 되짚어 세어야 알 수 있다 — 이틀이면 되짚을
              만하지만 3박 4일이면 못 센다.
            */}
            <div className="flex items-baseline gap-2">
              <span className="text-fg text-[13px] font-bold">{index + 1}일차</span>
              <span className="text-hint text-[11.5px]">
                {formatMonthDay(addDays(course.startDate, index))} (
                {/* "화요일" → "화". 줄이 짧아 요일까지 적으면 날짜보다 길어진다 */}
                {formatWeekday(addDays(course.startDate, index)).charAt(0)})
              </span>
            </div>
            {places.length === 0 ? (
              // 빈 일차를 건너뛰지 않는다. 건너뛰면 2박 3일인데 이틀만 있는 것처럼 보인다.
              <span className="text-hint pl-1 text-[13px]">담긴 장소가 없어요</span>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {places.map((place, placeIndex) => (
                  <PlaceRow
                    key={`${place.day}-${place.order}-${place.placeId}`}
                    place={place}
                    last={placeIndex === places.length - 1}
                    onOpen={onOpenPlace}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/*
        ■ <b>동선은 접어 둔다</b>

        이 시트는 먼저 <b>읽는 자리</b>라 지도가 펴진 채로 열리면 목록이 아래로 밀려,
        무엇이 담겼는지 보려고 스크롤부터 해야 한다. 그리고 지도는 카카오 SDK를 부르므로
        <b>열지 않은 사람은 부르지 않는 편</b>이 낫다 — 코스를 훑고 닫는 사람이 대부분이다.

        <p>⚠️ 좌표가 있는 장소만 지도에 오른다. 공사 카탈로그에서 사라진 장소는
        {@code place}가 비어 있어(PublicPlace 주석) 찍을 자리가 없다.
      */}
      {mapPlaces.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
            className="bg-brand-tint/60 hover:bg-brand-tint rounded-card flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left press"
          >
            <span className="text-brand-deep flex-none">
              <Route />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-fg text-[14px] font-bold">코스 동선 보기</span>
              <span className="text-muted text-[12px]">
                {mapPlaces.length}곳을 지도에서 한눈에 확인해요
              </span>
            </span>
            <span className="text-brand-deep flex-none">
              {mapOpen ? <ChevronDown /> : <ChevronRight />}
            </span>
          </button>
          {/*
            ⚠️ 열었다 닫으면 <b>지도를 떼어낸다</b>(조건부 렌더). 감춰만 두면 카카오 지도가
            폭 0인 상자 안에서 계속 살아 있다가, 다시 열 때 타일을 못 그린다.
          */}
          {mapOpen && <CourseMap places={mapPlaces} routes={mapRoutes} className="h-[240px]" />}
        </div>
      )}

      {/*
        남의 코스는 고칠 수 없다. 할 수 있는 것은 <b>베껴 와서 내 것으로 짜는 일</b>이고,
        그러면 편집 화면으로 간다 — 진단 화면이 아니다. 남의 일정을 그대로 진단해 봐야
        내 여행이 아니고, 대개 날짜부터 갈아야 한다.

        <p>■ <b>날짜 하나만 묻고 보낸다</b> (2026-08-31)

        예전에는 누르는 즉시 넘어갔다. 남의 출발일을 그대로 물려주고, 지난 날짜면
        일주일 뒤로 <b>대신 정해</b> 주었다 — 사용자는 자기 여행이 언제 시작하는지
        모르는 채 편집 화면에 도착했다.

        <p>대신 <b>이 시트가 그 한 가지만 묻는다.</b> 조건 화면으로 보내면 지역·기간까지
        다시 묻게 되는데, 그 둘은 베껴 오는 코스가 이미 정하고 있다(장소가 그 지역의
        것이고 일차 수가 곧 기간이다). 이미 답이 있는 것을 다시 묻는 화면은
        베끼는 일을 번거롭게만 만든다.

        <p>누르기 <b>전에는</b> 날짜 칸을 세우지 않는다. 이 시트는 먼저 읽는 자리이고,
        펼치자마자 입력칸이 서 있으면 남의 여행을 구경하러 온 사람에게 숙제가 생긴다.
      */}
      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          /*
            ⚠️ 테두리 버튼에서 <b>채운 버튼</b>으로 바꿨다. 이 시트에서 할 수 있는 일이
            이것 하나뿐인데 테두리로 두면 아래 여백에 묻혀, 코스를 다 읽고도 다음 걸음이
            안 보였다. 누르면 이 버튼이 달력에 자리를 내주므로 채운 버튼이 둘로 겹치지 않는다.
          */
          className="bg-brand hover:bg-brand-hover text-fg rounded-ui mt-1 h-12 cursor-pointer text-sm font-semibold press"
        >
          {/*
            ⚠️ <b>"나도"를 뺐다</b> (2026-08-31). 목록에 <b>내 코스도 섞이면서</b>
            남의 것을 따라 한다는 뜻이 늘 참이지는 않게 됐다. 화면은 이 코스가
            누구 것인지 모른다 — 닉네임으로 견주는 방법도 있지만, 그러면 같은 이름을
            쓰는 두 사람에게 화면이 거짓말을 한다.
          */}
          이 코스로 짜보기
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-2.5">
          <span className="text-fg text-[13.5px] font-semibold">언제 떠나세요?</span>
          {/*
            ■ 코스 짜기 화면과 <b>같은 달력</b>이다 (2026-09-09)

            예전에는 여기만 {@code <input type="date">}였다. 브라우저가 그리는 달력이라
            기기마다 모양이 다르고, 코스 짜기에서 본 달력(앰버 점·지난 날 잠금·눌림 반응)과
            <b>확연히 다른 물건</b>이 떴다 — 같은 서비스에서 날짜를 두 가지 달력으로 고르게
            하고 있었다. DatePicker가 지난 날짜를 잠그고 예측 창 밖에 점을 찍는 일을
            이미 하고 있으므로, 여기서 {@code min}을 따로 걸 필요도 없다.

            <p>⚠️ 예측 창 <b>끝</b>은 여전히 막지 않는다 — 여행은 원래 미리 계획한다.
          */}
          {/*
            {@code dense}: 시트는 카드 제목이 14.5px·본문이 12.5px라, 달력이 기본 크기면
            월 제목(15px)이 <b>이 시트에서 가장 큰 글자</b>가 된다 — 날짜를 고르는 도구가
            자기가 들어앉은 카드의 제목보다 커진다.
          */}
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            forecastEnd={forecastEnd}
            ariaLabel="여행 시작일"
            dense
          />
          {/*
            예측 창 밖 안내. 코스 짜기 화면의 그 줄과 같은 말·같은 색(보통=앰버)이다.
            달력 안의 점이 이미 말하지만, 달력을 닫으면 그 점도 사라진다 — 고른 결과
            옆에 남는 한 줄이 있어야 "왜 진단이 비어 나오나"를 나중에 묻지 않는다.
          */}
          {beyondForecast && (
            <div className="bg-moderate-tint rounded-ui flex items-start gap-2.5 px-3.5 py-3">
              <span className="bg-moderate mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden="true" />
              <p className="text-moderate-deep m-0 text-[12.5px] leading-[1.6]">
                예상 혼잡은{' '}
                <strong className="font-semibold">{formatKoreanDate(forecastEnd!)}</strong>
                까지만 나와 있어요.
                <br />
                이 날짜로도 코스를 짤 수 있지만 지금은 혼잡 진단이 비어 나와요 —
                여행이 가까워지면 다시 진단할 수 있어요.
              </p>
            </div>
          )}
          <button
            type="button"
            /* 달력이 늘 한 날을 가리키므로 잠글 조건이 없다. 지난 날은 달력이 이미 막는다 */
            onClick={() => onCopyToFlow(startDate)}
            className="bg-brand hover:bg-brand-hover text-fg rounded-ui disabled:bg-bg disabled:text-hint h-12 cursor-pointer text-sm font-semibold press disabled:cursor-not-allowed"
          >
            이 날짜로 코스 짜기
          </button>
        </div>
      )}
      {/*
        ⚠️ <b>"지난 날짜의 여행이라 장소만 담고 날짜는 새로 골라요"를 걷어냈다</b>
        (2026-09-09).

        지난 코스에만 이 줄을 세웠는데, <b>지나지 않은 코스도 똑같이 동작한다</b> —
        위 달력은 어느 코스에서 열든 늘 오늘부터 시작하고(남의 출발일을 물려주지
        않는다), 담아 오는 것은 어느 쪽이든 장소뿐이다. 모든 코스에 해당하는 일을
        한쪽에만 적으면 <b>다른 쪽은 날짜까지 따라오는 것처럼</b> 읽힌다.
      */}
    </article>
  )
}

/**
 * 코스 한 줄 — 번호·사진·이름·분류, 그리고 누르면 장소 상세.
 *
 * <h3>왜 사진과 분류가 붙었나</h3>
 * 이름만 늘어놓던 목록은 <b>어느 코스나 같은 모양</b>이었다. 여수와 경주가 글자만 다른
 * 여섯 줄로 보이니, 남의 여행을 구경하러 열어도 볼 것이 없었다.
 *
 * <p>분류 자리에 <b>한 줄 소개를 쓰고 싶지만 가진 것이 없다.</b> 공사 국문 관광정보에는
 * 짧은 설명 필드가 없고({@code overview}는 118~1,399자다) 장소마다 상세를 부르면 이 시트
 * 하나에 호출이 여섯 번 나간다. 그래서 <b>이미 들고 있는 분류명</b>을 세운다 —
 * 지어내지 않고, 가진 것으로 말한다.
 *
 * <h3>줄을 잇는 선</h3>
 * 번호 아래로 점선이 다음 줄까지 내려간다. 마지막 줄에는 긋지 않는다 — 이어질 곳이 없다.
 * 선이 있어야 여섯 줄이 <b>목록이 아니라 순서</b>로 읽힌다.
 *
 * <h3>⚠️ 누를 수 있는 줄과 아닌 줄</h3>
 * {@code onOpen}이 없으면 {@code <div>}로 선다. 눌러도 아무 일이 없는 {@code <button>}은
 * 키보드로 훑는 사람에게 <b>있지도 않은 문</b>을 하나씩 세워 보인다.
 */
function PlaceRow({
  place,
  last,
  onOpen,
}: {
  place: PublicPlace
  last: boolean
  onOpen?: (place: PublicPlace) => void
}) {
  const body = (
    <>
      {/* 번호와 점선. 줄 높이가 사진(56px)에 맞춰지므로 선도 그만큼 내려간다 */}
      <span className="flex flex-none flex-col items-center self-stretch">
        <span className="bg-bg text-hint grid h-6 w-6 flex-none place-items-center rounded-full font-mono text-[11px] font-semibold">
          {place.order}
        </span>
        {!last && (
          <span
            className="border-line mt-1 w-0 flex-1 border-l border-dashed"
            aria-hidden="true"
          />
        )}
      </span>

      <PlaceThumbnail imageUrl={place.place?.imageUrl ?? null} size="row" />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-fg truncate text-[14px] font-semibold">{place.name}</span>
        {/*
          분류를 못 받은 줄은 <b>자리를 비운다.</b> "정보 없음" 같은 말을 채우면
          공사가 안 준 것을 우리가 못 채운 것처럼 읽힌다.
        */}
        {place.place?.categoryName && (
          <span className="text-hint truncate text-[12px]">{place.place.categoryName}</span>
        )}
      </span>

      {onOpen && (
        <span className="text-hint flex-none">
          <ChevronRight />
        </span>
      )}
    </>
  )

  return (
    <li>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(place)}
          className="hover:bg-bg rounded-ui flex w-full cursor-pointer items-center gap-3 bg-transparent px-1 py-1.5 text-left press"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-1 py-1.5">{body}</div>
      )}
    </li>
  )
}
