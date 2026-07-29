import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import { daysFromToday, formatKoreanDate, today } from '../utils/date'
import './PlanPage.css'

/** 1박2일 ~ 3박4일. 값은 박 수이고, 일수는 박 수 + 1이다. */
const DURATIONS = [
  { nights: 1, label: '1박 2일' },
  { nights: 2, label: '2박 3일' },
  { nights: 3, label: '3박 4일' },
]

/**
 * 기본 날짜를 일주일 뒤로 둔다.
 *
 * 오늘로 두면 "지금 당장 출발"이라는 비현실적인 기본값이 되고,
 * 비워두면 심사위원이 달력을 열어 고르는 단계가 하나 늘어난다.
 */
const DEFAULT_DAYS_AHEAD = 7

export function PlanPage() {
  const navigate = useNavigate()
  const { state, setPlan } = useTrip()

  // 이전에 입력한 값이 있으면 그것부터 보여준다 (뒤로 왔을 때 다시 채우지 않게).
  const [region, setRegion] = useState(state.plan?.region ?? DEFAULT_REGION)
  const [startDate, setStartDate] = useState(
    state.plan?.startDate ?? daysFromToday(DEFAULT_DAYS_AHEAD),
  )
  const [nights, setNights] = useState(state.plan?.nights ?? 1)

  const isPastDate = startDate < today()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isPastDate) {
      return
    }
    setPlan({ region, startDate, nights })
    navigate('/course')
  }

  return (
    <div className="plan">
      <section className="intro">
        <h1 className="intro-title">PEAKOFF</h1>
        <p className="intro-lead">
          가고 싶은 곳은 그대로. <strong>덜 붐빌 때, 덜 붐비는 곳으로.</strong>
        </p>
        <p className="intro-sub">
          직접 짠 여행 코스를 공공데이터로 진단하고, 한적한 대안을 찾아드립니다.
        </p>
      </section>

      <form className="plan-form" onSubmit={handleSubmit}>
        <fieldset className="field">
          <legend className="field-label">어디로 가시나요?</legend>
          <div className="segmented">
            {REGIONS.map((option) => (
              <label key={option.slug} className="segment">
                <input
                  type="radio"
                  name="region"
                  value={option.slug}
                  checked={region === option.slug}
                  onChange={() => setRegion(option.slug)}
                />
                <span>{option.name}</span>
              </label>
            ))}
          </div>
          {REGIONS.length === 1 && (
            <p className="field-hint">지금은 경주만 이용할 수 있어요.</p>
          )}
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">언제 출발하시나요?</legend>
          <input
            type="date"
            className="date-input"
            value={startDate}
            min={today()}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
          <p className={`field-hint ${isPastDate ? 'field-hint--error' : ''}`}>
            {isPastDate ? '오늘 이후 날짜를 골라주세요.' : formatKoreanDate(startDate)}
          </p>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">얼마나 머무시나요?</legend>
          <div className="segmented">
            {DURATIONS.map((option) => (
              <label key={option.nights} className="segment">
                <input
                  type="radio"
                  name="nights"
                  value={option.nights}
                  checked={nights === option.nights}
                  onChange={() => setNights(option.nights)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="submit" disabled={isPastDate}>
          코스 짜러 가기
        </button>

        <p className="guest-note">로그인 없이 바로 이용할 수 있어요.</p>
      </form>
    </div>
  )
}
