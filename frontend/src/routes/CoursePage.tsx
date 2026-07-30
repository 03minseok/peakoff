import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { CourseMap } from '../components/CourseMap'
import { CARD, NOTICE, PRIMARY_BUTTON } from '../components/styles'
import { ApiRequestError, fetchPlaces } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { Place } from '../types/api'
import { formatKoreanDate } from '../utils/date'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded' }
  | { phase: 'error'; message: string }

/** 모바일에서 손가락으로 누를 수 있는 최소 크기(36px)를 지킨다. */
const ICON_BUTTON =
  'h-9 w-9 cursor-pointer rounded-md border border-line bg-bg text-[15px] text-muted hover:border-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30'

export function CoursePage() {
  const navigate = useNavigate()
  const { state, addPlace, removePlace, movePlace, markBaseline } = useTrip()
  const plan = state.plan

  const [places, setPlaces] = useState<Place[]>([])
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const [currentDay, setCurrentDay] = useState(1)

  const region = plan?.region

  useEffect(() => {
    if (!region) {
      return
    }
    const controller = new AbortController()

    setLoad({ phase: 'loading' })
    fetchPlaces(region, controller.signal)
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

    return () => controller.abort()
  }, [region])

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
    return <Navigate to="/" replace />
  }

  const totalDays = plan.nights + 1
  const allDaysFilled =
    state.days.length === totalDays && state.days.every((day) => day.length > 0)
  const emptyDays = state.days
    .map((day, index) => (day.length === 0 ? index + 1 : 0))
    .filter((day) => day > 0)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-fg text-xl font-semibold tracking-tight">코스 편집</h1>
        <p className="text-[13px]">
          {formatKoreanDate(plan.startDate)}부터 {plan.nights}박 {totalDays}일
        </p>
      </header>

      {/* 편집 중에는 현재 일차만 선으로 잇는다. 다른 날 경로까지 겹치면 읽기 어렵다. */}
      <CourseMap places={places} routes={currentDayRoute} onSelect={handleSelect} />

      {/* 일차가 늘어나면 가로로 넘칠 수 있어 이 줄만 스크롤되게 둔다. */}
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="일차 선택">
        {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => {
          const count = state.days[day - 1]?.length ?? 0
          const active = day === currentDay
          return (
            <button
              key={day}
              type="button"
              className={`rounded-card inline-flex min-h-10 flex-none cursor-pointer items-center justify-center gap-2 border px-3 text-sm font-semibold ${
                active
                  ? 'border-brand bg-quiet-bg text-brand-strong'
                  : 'border-line bg-bg text-muted'
              }`}
              aria-current={active}
              onClick={() => setCurrentDay(day)}
            >
              Day {day}
              <span
                className={`min-w-5 rounded-full px-1.5 py-px text-xs font-bold text-white ${
                  active ? 'bg-brand-strong' : 'bg-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

      <section>
        <h2 className="text-fg mb-2 text-[15px] font-semibold">Day {currentDay} 코스</h2>

        {currentDayPlaceIds.length === 0 ? (
          <p className={NOTICE}>아직 담은 곳이 없어요. 아래에서 골라 담아보세요.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {currentDayPlaceIds.map((placeId, index) => {
              const place = placesById.get(placeId)
              return (
                <li
                  key={placeId}
                  className={`${CARD} grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 p-3`}
                >
                  <span className="bg-brand-strong row-span-2 grid h-6.5 w-6.5 place-items-center rounded-full text-[13px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-fg text-[15px]">{place?.name ?? placeId}</span>
                  <span className="row-span-2 flex gap-1">
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      onClick={() => movePlace(currentDay, index, -1)}
                      disabled={index === 0}
                      aria-label={`${place?.name ?? ''} 위로 옮기기`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      onClick={() => movePlace(currentDay, index, 1)}
                      disabled={index === currentDayPlaceIds.length - 1}
                      aria-label={`${place?.name ?? ''} 아래로 옮기기`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`${ICON_BUTTON} hover:border-danger hover:text-danger`}
                      onClick={() => removePlace(currentDay, index)}
                      aria-label={`${place?.name ?? ''} 빼기`}
                    >
                      ✕
                    </button>
                  </span>
                  <span className="col-start-2 text-xs">{place?.categoryName ?? ''}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section>
        <h2 className="text-fg mb-2 text-[15px] font-semibold">장소 고르기</h2>

        {load.phase === 'loading' && <p className={NOTICE}>불러오는 중…</p>}
        {load.phase === 'error' && (
          <p className={`${NOTICE} text-danger`}>{load.message}</p>
        )}

        {load.phase === 'loaded' && (
          <ul className="border-line border-t">
            {places.map((place) => {
              const added = currentDayPlaceIds.includes(place.id)
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    className="border-line text-fg hover:bg-surface disabled:hover:bg-bg grid min-h-12 w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-2 py-3 text-left disabled:cursor-default"
                    onClick={() => addPlace(currentDay, place.id)}
                    disabled={added}
                  >
                    <span className="text-[15px]">{place.name}</span>
                    <span className="text-muted text-xs">{place.categoryName}</span>
                    <span
                      className={`text-[13px] ${added ? 'text-muted' : 'text-brand-strong font-semibold'}`}
                    >
                      {added ? '담김' : '담기'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/*
        목록이 길어 스크롤이 생기므로 버튼을 화면 아래에 붙여둔다.
        끝까지 내려야 진단 버튼을 만나는 구조면 다 담고도 뭘 해야 할지 모른다.
      */}
      <div className="bg-bg border-line sticky bottom-0 border-t pt-3 pb-4">
        {!allDaysFilled && emptyDays.length > 0 && (
          <p className="mb-2 text-center text-[13px]">
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
          코스 진단하기
        </button>
      </div>
    </div>
  )
}
