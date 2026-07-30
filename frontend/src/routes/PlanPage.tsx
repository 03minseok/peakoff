import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PRIMARY_BUTTON } from '../components/styles'
import { DEFAULT_REGION, REGIONS } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import { daysFromToday, formatKoreanDate, today } from '../utils/date'

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

/*
 * 선택 버튼. 라디오 입력을 sr-only로 숨기고 옆의 span을 버튼처럼 꾸민다.
 * peer-checked로 선택 상태를 표현하므로 자바스크립트 상태 분기가 필요 없다.
 *
 * sr-only는 화면에서만 감추고 초점은 살려둔다 — display:none이면 키보드로 못 고른다.
 */
const SEGMENT =
  'block cursor-pointer rounded-card border border-line bg-bg px-2 py-3 text-center text-sm font-semibold text-muted transition-colors peer-checked:border-brand peer-checked:bg-quiet-bg peer-checked:text-brand-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand'

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
    <div>
      <section className="pt-4 pb-8">
        <h1 className="text-brand-strong text-[32px] font-extrabold tracking-[-1px]">
          PEAKOFF
        </h1>
        <p className="text-fg mt-3 text-[17px] leading-snug">
          가고 싶은 곳은 그대로.{' '}
          <strong className="text-brand-strong font-bold">덜 붐빌 때, 덜 붐비는 곳으로.</strong>
        </p>
        <p className="mt-2 text-sm">
          직접 짠 여행 코스를 공공데이터로 진단하고, 한적한 대안을 찾아드립니다.
        </p>
      </section>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-fg mb-2 p-0 text-[15px] font-semibold">
            어디로 가시나요?
          </legend>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((option) => (
              <label key={option.slug} className="min-w-22 flex-auto">
                <input
                  type="radio"
                  name="region"
                  className="peer sr-only"
                  value={option.slug}
                  checked={region === option.slug}
                  onChange={() => setRegion(option.slug)}
                />
                <span className={SEGMENT}>{option.name}</span>
              </label>
            ))}
          </div>
          {REGIONS.length === 1 && (
            <p className="mt-2 text-[13px]">지금은 경주만 이용할 수 있어요.</p>
          )}
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="text-fg mb-2 p-0 text-[15px] font-semibold">
            언제 출발하시나요?
          </legend>
          <input
            type="date"
            className="border-line bg-bg text-fg focus-visible:border-brand w-full rounded-card border p-3 font-sans text-base"
            value={startDate}
            min={today()}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
          <p className={`mt-2 text-[13px] ${isPastDate ? 'text-danger' : ''}`}>
            {isPastDate ? '오늘 이후 날짜를 골라주세요.' : formatKoreanDate(startDate)}
          </p>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="text-fg mb-2 p-0 text-[15px] font-semibold">
            얼마나 머무시나요?
          </legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((option) => (
              <label key={option.nights} className="min-w-22 flex-auto">
                <input
                  type="radio"
                  name="nights"
                  className="peer sr-only"
                  value={option.nights}
                  checked={nights === option.nights}
                  onChange={() => setNights(option.nights)}
                />
                <span className={SEGMENT}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className={PRIMARY_BUTTON} disabled={isPastDate}>
          코스 짜러 가기
        </button>

        <p className="text-center text-[13px]">로그인 없이 바로 이용할 수 있어요.</p>
      </form>
    </div>
  )
}
