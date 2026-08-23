import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from '../components/icons'
import { Navigate, useNavigate } from 'react-router'
import { CourseMap } from '../components/CourseMap'
import { CARD, CHIP_BUTTON, NOTICE, PRIMARY_BUTTON, TEXT_INPUT } from '../components/styles'
import { ApiRequestError, fetchPlaces } from '../services/api'
import { regionNameOf } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import type { Place } from '../types/api'
import { formatDuration, formatKoreanDate } from '../utils/date'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded' }
  | { phase: 'error'; message: string }

/**
 * 모바일에서 손가락으로 누를 수 있는 최소 크기(36px)를 지킨다.
 *
 * 권고치(44px)보다는 작다. 세 버튼이 서로 붙어 있어서 닿는 자리를 44px로 넓히면
 * 서로 겹치고, 위로 옮기려다 <b>빼기</b>가 눌리는 사고가 난다 — 되돌릴 수 없는 쪽이 이겨서는 안 된다.
 * 넓히려면 버튼 사이를 벌리는 것이 먼저다. (index.css의 .touch-hitbox 주석 참고)
 *
 * press는 눌림 반응이다. 순서를 바꾸는 버튼은 화면이 즉시 변하지 않는 경우가 있어
 * (맨 위 항목의 '위로'는 잠겨 있다) 손끝 반응이 특히 필요하다.
 */
/**
 * 검색어를 친 뒤 실제로 부르기까지 기다리는 시간.
 *
 * 글자마다 부르면 "불" "불국" "불국사"로 세 번 나가고, 앞의 둘은 버려진다.
 * 너무 길면 다 치고 나서 멈칫하는 느낌이 든다.
 */
const DEBOUNCE_MS = 250

const ICON_BUTTON =
  'press grid h-9 w-9 place-items-center cursor-pointer rounded-chip bg-transparent text-[15px] text-muted hover:bg-bg hover:text-fg disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent'

export function CoursePage() {
  const navigate = useNavigate()
  const { state, addPlace, removePlace, movePlace, markBaseline } = useTrip()
  const plan = state.plan

  const [places, setPlaces] = useState<Place[]>([])
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const [currentDay, setCurrentDay] = useState(1)

  /**
   * 검색창에 친 글자.
   *
   * 비어 있으면 서버가 <b>대표 관광지</b>를 준다. 빈 목록을 두지 않는 이유는,
   * 경주를 모르는 사용자가 빈 검색창 앞에서 첫 글자를 치지 못하기 때문이다.
   */
  const [keyword, setKeyword] = useState('')

  const region = plan?.region

  useEffect(() => {
    if (!region) {
      return
    }
    const controller = new AbortController()

    setLoad({ phase: 'loading' })
    /*
     * 글자마다 부르지 않는다. 타이핑 중에는 요청이 계속 갈아엎히면서 화면이 깜빡이고,
     * 서버는 버려질 결과를 계속 계산한다. 잠깐 멈췄을 때 한 번만 부른다.
     */
    const timer = setTimeout(() => {
    fetchPlaces(region, { keyword, signal: controller.signal })
      .then((result) => {
        setPlaces(result)
        setLoad({ phase: 'loaded' })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoad({
          phase: 'error',
          message:
            error instanceof ApiRequestError ? error.message : '장소를 불러오지 못했습니다.',
        })
      })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [region, keyword])

  // 장소 ID로 빠르게 찾기 위한 표. 목록이 바뀔 때만 다시 만든다.
  const placesById = useMemo(() => {
    return new Map(places.map((place) => [place.id, place]))
  }, [places])

  const currentDayPlaceIds = useMemo(
    () => state.days[currentDay - 1] ?? [],
    [state.days, currentDay],
  )

  const handleSelect = useCallback(
    (placeId: string) => addPlace(currentDay, placeId),
    [addPlace, currentDay],
  )

  // 지도는 경로 배열을 받는다. 편집 화면은 현재 일차 하나만 넘긴다.
  const currentDayRoute = useMemo(() => [currentDayPlaceIds], [currentDayPlaceIds])

  /* 조건 없이 들어온 경우. 편집할 기준이 없으므로 첫 화면으로 돌려보낸다. */
  if (!plan) {
    return <Navigate to="/plan" replace />
  }

  const totalDays = plan.nights + 1
  const allDaysFilled =
    state.days.length === totalDays && state.days.every((day) => day.length > 0)
  const emptyDays = state.days
    .map((day, index) => (day.length === 0 ? index + 1 : 0))
    .filter((day) => day > 0)
  const totalCount = state.days.flat().length
  /*
    장소별로 코스에 몇 번 담겼는지. 여행 전체 기준이라 다른 날에 담은 것도 센다.

    막기 위한 값이 아니라 알려주기 위한 값이다 — 같은 곳을 여러 번 담는 것은
    막지 않는다(TripProvider의 ADD_PLACE 주석 참고).
  */
  const chosenCounts = state.days.flat().reduce<Map<string, number>>((counts, placeId) => {
    counts.set(placeId, (counts.get(placeId) ?? 0) + 1)
    return counts
  }, new Map())

  return (
    /*
      데스크톱은 화면 높이를 꽉 채우는 앱 셸이다 — 지도가 왼쪽에 고정되고
      오른쪽 편집 패널만 안에서 스크롤한다. 장소를 담고 빼는 동안 지도가 계속
      보여야 "어디를 담았는지"를 놓치지 않는다.

      모바일은 지도를 위에 깔고 그 아래 목록이 이어진다. 화면이 좁아 둘을
      나란히 놓을 수 없다. 컴포넌트는 하나로 두고 클래스로만 갈랐다.
    */
    // 높이 = 화면 − (헤더 3.5rem + 본문 위 2rem + 본문 아래 3rem)
    <div className="flex flex-col gap-0 lg:h-[calc(100svh-8.5rem)] lg:flex-row lg:gap-6">
      <div className="lg:min-w-0 lg:flex-1">
        {/* 편집 중에는 현재 일차만 선으로 잇는다. 다른 날 경로까지 겹치면 읽기 어렵다. */}
        <CourseMap
          places={places}
          routes={currentDayRoute}
          onSelect={handleSelect}
          className="lg:h-full"
        />
      </div>

      {/*
        시안은 시트가 지도를 살짝 덮으며 올라오지만, 그건 지도가 화면 끝까지
        닿아 있을 때 성립한다. 여기는 지도가 여백 안에 둥근 카드로 들어앉아 있어
        겹치면 지도의 아래 모서리만 잘려 보인다. 겹치지 않고 그냥 이어 붙인다.
      */}
      <div className="flex flex-col gap-4 pt-4 lg:w-[400px] lg:flex-none lg:overflow-y-auto lg:pt-0">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-fg text-xl font-bold tracking-tight">코스 편집</h1>
          <p className="text-[13px]">
            {formatKoreanDate(plan.startDate)}부터 {formatDuration(plan.nights)}
          </p>
        </header>

        {/*
          당일치기면 고를 일차가 없다. 탭이 하나뿐이면 누를 수 있다는 신호만 주고
          아무것도 바뀌지 않아 오히려 헷갈린다.

          일차가 늘어나면 가로로 넘칠 수 있어 이 줄만 스크롤되게 둔다.

          <b>shrink-0이 없으면 넓은 화면에서 이 줄이 통째로 사라진다.</b>
          overflow-x-auto가 이 요소를 스크롤 컨테이너로 만드는데, 플렉스 항목의
          자동 최소 크기(min-height: auto)는 스크롤 컨테이너에 적용되지 않는다.
          즉 0까지 눌릴 수 있다. 데스크톱에서는 오른쪽 패널 높이가 화면에 고정돼 있고
          아래 장소 목록이 길어서, 줄어들 수 있는 유일한 항목인 이 줄이 먼저 눌렸다.
          모바일은 높이 제한이 없어 증상이 안 보였다.
        */}
        <nav
          className={`shrink-0 gap-2 overflow-x-auto pb-1 ${totalDays > 1 ? 'flex' : 'hidden'}`}
          aria-label="일차 선택"
        >
          {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => {
            const count = state.days[day - 1]?.length ?? 0
            const active = day === currentDay
            return (
              <button
                key={day}
                type="button"
                className={`rounded-ui flex h-13 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border-0 px-3 transition-colors ${
                  active ? 'bg-fg' : 'bg-surface shadow-rest'
                }`}
                aria-current={active}
                onClick={() => setCurrentDay(day)}
              >
                <span
                  className={`text-sm font-semibold ${active ? 'text-white' : 'text-fg'}`}
                >
                  Day {day}
                </span>
                {/* 4일 일정이면 탭이 네 개다. "비어 있음" 같은 긴 문구를 넣으면
                    탭 폭이 좁아졌을 때 두 줄로 접혀 탭 높이를 밀어낸다. */}
                <span
                  className={`text-[11.5px] ${active ? 'text-white/60' : 'text-hint'}`}
                >
                  {count}곳
                </span>
              </button>
            )
          })}
        </nav>

        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-fg text-sm font-semibold">
              Day {currentDay} 코스
            </h2>
            <span className="text-hint text-[12.5px]">
              {currentDayPlaceIds.length > 0 ? `${currentDayPlaceIds.length}곳` : '장소 없음'}
            </span>
          </div>

          {currentDayPlaceIds.length === 0 ? (
            <p className="border-line rounded-card border border-dashed p-6 text-center text-[13.5px] leading-[1.6]">
              아직 이 날 장소가 없어요.
              <br />
              아래에서 가고 싶은 곳을 골라보세요.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {currentDayPlaceIds.map((placeId, index) => {
                const place = placesById.get(placeId)
                return (
                  <li
                    key={placeId}
                    className={`${CARD} flex items-center gap-3 py-3 pr-3 pl-3.5`}
                  >
                    <span className="bg-brand grid h-7 w-7 flex-none place-items-center rounded-full font-mono text-[13px] font-semibold text-fg">
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-fg truncate text-[15px] font-semibold">
                        {place?.name ?? placeId}
                      </span>
                      <span className="text-hint text-[12.5px]">
                        {place?.categoryName ?? ''}
                      </span>
                    </div>
                    <span className="ml-auto flex flex-none items-center">
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        onClick={() => movePlace(currentDay, index, -1)}
                        disabled={index === 0}
                        aria-label={`${place?.name ?? ''} 위로 옮기기`}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        onClick={() => movePlace(currentDay, index, 1)}
                        disabled={index === currentDayPlaceIds.length - 1}
                        aria-label={`${place?.name ?? ''} 아래로 옮기기`}
                      >
                        <ArrowDown />
                      </button>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} hover:bg-crowded-tint hover:text-crowded`}
                        onClick={() => removePlace(currentDay, index)}
                        aria-label={`${place?.name ?? ''} 빼기`}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="pb-2">
          <h2 className="text-fg mb-2.5 text-sm font-semibold">장소 추가</h2>

          {/*
            검색창. 지역 전체를 늘어놓지 않는 대신 여기로 찾는다 — 경주만 621곳이라
            목록으로는 훑을 수 없고, 지역이 늘면 더 그렇다.

            type="search"인 이유: 모바일 키보드에 "검색" 키가 서고, 브라우저가 지우기
            버튼을 붙여 준다. 우리가 만들지 않아도 되는 것을 만들지 않는다.
          */}
          <label className="mb-2.5 block">
            <span className="sr-only">장소 검색</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="가고 싶은 곳을 검색해 보세요"
              className={TEXT_INPUT}
              autoComplete="off"
            />
          </label>

          {load.phase === 'loading' && <p className={NOTICE}>불러오는 중…</p>}
          {load.phase === 'error' && (
            <p className={`${NOTICE} text-crowded-deep`}>{load.message}</p>
          )}

          {/*
            검색 전에는 서버가 대표 관광지를 준다. 빈 검색창 앞에서 첫 글자를 못 치는
            사용자를 위한 자리라, "검색어를 입력하세요" 같은 빈 화면을 두지 않는다.
          */}
          {load.phase === 'loaded' && places.length === 0 && (
            <p className={NOTICE}>
              {keyword ? `'${keyword}'로 찾은 곳이 없어요.` : '보여줄 장소가 없어요.'}
            </p>
          )}

          {load.phase === 'loaded' && places.length > 0 && (
            <>
              {!keyword && (
                <p className="text-hint mb-2 text-[12.5px]">
                  {regionNameOf(plan.region)}에서 많이 찾는 곳이에요
                </p>
              )}
            <ul className="flex flex-col gap-2">
              {places.map((place) => {
                /*
                  이미 담았어도 버튼은 그대로 둔다. 아침에 들렀다 저녁에 다시 오는 곳,
                  이틀 연속 가는 카페처럼 다시 담을 이유가 실제로 있다.

                  대신 몇 번 담겼는지는 알려준다. 버튼만 있고 아무 표시가 없으면
                  이미 담은 줄 모르고 또 누르게 된다 — 막지는 않되 알려는 준다.
                */
                const addedCount = chosenCounts.get(place.id) ?? 0
                return (
                  <li
                    key={place.id}
                    className={`${CARD} flex items-center gap-2.5 px-3 py-2.75`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-fg truncate text-[14.5px] font-semibold">
                        {place.name}
                      </span>
                      <span className="text-hint text-xs">{place.categoryName}</span>
                    </div>
                    {addedCount > 0 && (
                      <span className="text-hint flex-none text-[12.5px] whitespace-nowrap">
                        {addedCount > 1 ? `${addedCount}번 담김` : '담김'}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${CHIP_BUTTON} flex-none`}
                      onClick={() => addPlace(currentDay, place.id)}
                    >
                      추가
                    </button>
                  </li>
                )
              })}
            </ul>
            </>
          )}
        </section>

        {/*
          목록이 길어 스크롤이 생기므로 버튼을 아래에 붙여둔다.
          끝까지 내려야 진단 버튼을 만나는 구조면 다 담고도 뭘 해야 할지 모른다.
        */}
        {/* bottom-15: BottomNav(60px) 위에 얹는다. 막대가 사라지는 md부터는 바닥으로 내려온다. */}
        {/* z-30 — 진단 화면과 같은 이유다. 값이 없으면 지도와 겹치는 구간에서 뒤로 숨는다 */}
        <div className="from-bg/0 to-bg sticky bottom-15 z-30 mt-auto bg-gradient-to-b to-[30%] pt-3.5 pb-5 md:bottom-0">
          {!allDaysFilled && emptyDays.length > 0 && (
            <p className="mb-2.5 text-center text-[13px]">
              {emptyDays.map((day) => `Day ${day}`).join(', ')}에 장소를 담아주세요.
            </p>
          )}
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!allDaysFilled}
            onClick={() => {
              // 지금 코스를 원안으로 찍는다. 이후 교체해도 이 시점 코스와 비교할 수 있다.
              markBaseline()
              navigate('/diagnosis')
            }}
          >
            코스 진단하기 · {totalCount}곳
          </button>
          <p className="text-hint mt-2.5 text-center text-xs">
            날짜별 예상 혼잡을 한 번에 계산해요
          </p>
        </div>
      </div>
    </div>
  )
}
