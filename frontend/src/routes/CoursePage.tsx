import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { CourseMap } from '../components/CourseMap'
import { ApiRequestError, fetchPlaces } from '../services/api'
import { useTrip } from '../state/tripContext'
import type { Place } from '../types/api'
import { formatKoreanDate } from '../utils/date'
import './CoursePage.css'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded' }
  | { phase: 'error'; message: string }

export function CoursePage() {
  const navigate = useNavigate()
  const { state, addPlace, removePlace, movePlace } = useTrip()
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
    <div className="course">
      <header className="course-head">
        <h1 className="course-title">코스 편집</h1>
        <p className="course-sub">
          {formatKoreanDate(plan.startDate)}부터 {plan.nights}박 {totalDays}일
        </p>
      </header>

      <CourseMap
        places={places}
        selectedPlaceIds={currentDayPlaceIds}
        onSelect={handleSelect}
      />

      <nav className="day-tabs" aria-label="일차 선택">
        {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => {
          const count = state.days[day - 1]?.length ?? 0
          return (
            <button
              key={day}
              type="button"
              className={`day-tab ${day === currentDay ? 'day-tab--active' : ''}`}
              aria-current={day === currentDay}
              onClick={() => setCurrentDay(day)}
            >
              Day {day}
              <span className="day-tab-count">{count}</span>
            </button>
          )
        })}
      </nav>

      <section className="section">
        <h2 className="section-title">Day {currentDay} 코스</h2>

        {currentDayPlaceIds.length === 0 ? (
          <p className="empty">아직 담은 곳이 없어요. 아래에서 골라 담아보세요.</p>
        ) : (
          <ol className="slot-list">
            {currentDayPlaceIds.map((placeId, index) => {
              const place = placesById.get(placeId)
              return (
                <li key={placeId} className="slot">
                  <span className="slot-order">{index + 1}</span>
                  <span className="slot-name">{place?.name ?? placeId}</span>
                  <span className="slot-category">{place?.categoryName ?? ''}</span>
                  <span className="slot-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => movePlace(currentDay, index, -1)}
                      disabled={index === 0}
                      aria-label={`${place?.name ?? ''} 위로 옮기기`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => movePlace(currentDay, index, 1)}
                      disabled={index === currentDayPlaceIds.length - 1}
                      aria-label={`${place?.name ?? ''} 아래로 옮기기`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
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

      <section className="section">
        <h2 className="section-title">장소 고르기</h2>

        {load.phase === 'loading' && <p className="empty">불러오는 중…</p>}
        {load.phase === 'error' && <p className="empty empty--error">{load.message}</p>}

        {load.phase === 'loaded' && (
          <ul className="picker-list">
            {places.map((place) => {
              const added = currentDayPlaceIds.includes(place.id)
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    className="picker"
                    onClick={() => addPlace(currentDay, place.id)}
                    disabled={added}
                  >
                    <span className="picker-name">{place.name}</span>
                    <span className="picker-category">{place.categoryName}</span>
                    <span className="picker-action">{added ? '담김' : '담기'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="course-footer">
        {!allDaysFilled && emptyDays.length > 0 && (
          <p className="footer-hint">
            {emptyDays.map((day) => `Day ${day}`).join(', ')}에 장소를 담아주세요.
          </p>
        )}
        <button
          type="button"
          className="submit"
          disabled={!allDaysFilled}
          onClick={() => navigate('/diagnosis')}
        >
          코스 진단하기
        </button>
      </div>
    </div>
  )
}
