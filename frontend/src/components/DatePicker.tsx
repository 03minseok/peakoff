import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from './icons'
import { addDays, daysBetween, formatKoreanDate, today } from '../utils/date'

/**
 * 여행 시작일을 고르는 칸.
 *
 * <h3>왜 {@code <input type="date">}를 걷어냈나</h3>
 * 네이티브 달력은 <b>브라우저가 그린다.</b> 우리 팔레트도, 우리 모서리도, 우리 글꼴도
 * 닿지 않는 면이 폼 한가운데에서 열린다 — 크롬 데스크톱에서는 회색 상자가 뜨고
 * 사파리는 또 다른 것이 뜬다. 화면을 하나하나 맞춰 온 서비스에서 <b>가장 자주 여는 칸</b>이
 * 유일하게 남의 디자인이었다.
 *
 * <p>직접 그리면 이 서비스가 아는 것을 달력 위에 얹을 수 있다는 이득도 따라온다 —
 * 아래 {@code forecastEnd}가 그것이다. 어느 날부터 예상 혼잡이 비는지를
 * <b>고르기 전에</b> 날짜 위에서 알린다. 예전에는 고르고 난 뒤 아래 안내문으로만 알았다.
 *
 * <h3>고르는 방식은 여기 한 곳에만 둔다</h3>
 * 코스 짜기와 코스 발견이 같은 칸을 각자 그리고 있었다. RegionPicker를 모은 것과
 * 같은 이유다 — 한쪽만 고치면 두 진입로가 다르게 동작한다.
 *
 * <h3>지키는 것들</h3>
 * <ul>
 *   <li><b>가로로 미는 상자를 만들지 않는다.</b> 달을 넘기는 것은 스크롤이 아니라 버튼이다.
 *       민 제스처가 페이지로 이어지는 사고를 애초에 만들지 않는다
 *   <li><b>흐름에 끼우지 않고 띄운다.</b> 펼칠 때마다 아래 기간 칸이 통째로 밀려 내려가면,
 *       무엇을 고를지 보려고 열었는데 보고 있던 것이 움직인다
 *   <li><b>지난 날짜는 아예 못 누른다.</b> {@code min}으로 막던 것과 같은 규칙을 우리가 맡는다
 * </ul>
 */

/** 요일 머리글. 일요일 시작 — 한국 달력의 관습이다 */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/*
 * 빠른 선택.
 *
 * <b>기본값이 아니라 지름길이다.</b> 미리 켜 두는 답과 다르다 — 누른 적 없으면
 * 아무 칩도 켜지지 않고, 켜진 칩은 사용자가 그 날을 골랐다는 뜻이다.
 * (달력을 열지 않고도 가장 흔한 세 날을 고를 수 있어, 실제로는 이쪽이 주 통로가 된다)
 */
interface Shortcut {
  label: string
  /** 오늘을 받아 날짜를 만든다. 자정을 넘겨도 다시 계산되도록 값이 아니라 식으로 둔다 */
  resolve: (todayIso: string) => string
}

const SHORTCUTS: Shortcut[] = [
  { label: '오늘', resolve: (t) => t },
  { label: '내일', resolve: (t) => addDays(t, 1) },
  {
    label: '이번 주말',
    /*
     * 다가오는 토요일. 오늘이 토요일이면 오늘이고, 일요일이면 엿새 뒤다.
     * "이번 주말"이 지난 토요일을 가리키는 일은 없어야 한다 — 고를 수 없는 날이다.
     */
    resolve: (t) => {
      const [year, month, day] = t.split('-').map(Number)
      const weekday = new Date(year, month - 1, day).getDay()
      return addDays(t, (6 - weekday + 7) % 7)
    },
  },
]

/** "2026-09" → 그 달의 날 수 */
function daysInMonth(ym: string): number {
  const [year, month] = ym.split('-').map(Number)
  // 다음 달의 0일 = 이번 달의 마지막 날
  return new Date(year, month, 0).getDate()
}

/** "2026-09" → 1일의 요일 (0=일) */
function firstWeekday(ym: string): number {
  const [year, month] = ym.split('-').map(Number)
  return new Date(year, month - 1, 1).getDay()
}

/** "2026-09" + 1 → "2026-10" */
function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split('-').map(Number)
  const moved = new Date(year, month - 1 + delta, 1)
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`
}

/** 며칠 뒤인지를 짧게. 고른 날이 얼마나 먼 미래인지가 숫자보다 빨리 읽힌다 */
function relativeLabel(iso: string, todayIso: string): string {
  const gap = daysBetween(todayIso, iso)
  if (gap === 0) {
    return '오늘'
  }
  if (gap === 1) {
    return '내일'
  }
  if (gap === 2) {
    return '모레'
  }
  return `${gap}일 뒤`
}

export function DatePicker({
  value,
  onChange,
  forecastEnd = null,
  ariaLabel = '여행 시작일',
}: {
  value: string
  onChange: (iso: string) => void
  /**
   * 예상 혼잡이 닿는 마지막 날. 모르면 {@code null}이고, 그때는 달력이 아무 표시도 하지 않는다.
   * <b>없는 제약을 그려두지 않는다</b> — 서버가 창을 늘리면 달력이 저절로 따라온다.
   */
  forecastEnd?: string | null
  ariaLabel?: string
}) {
  const todayIso = today()
  const [open, setOpen] = useState(false)
  /** 펼쳐 놓은 달. 열 때마다 고른 날의 달로 되맞춘다 */
  const [ym, setYm] = useState(() => value.slice(0, 7))
  /**
   * 키보드로 짚고 있는 날 (roving tabindex).
   *
   * 날짜 버튼이 서른 개가 넘어 전부 탭 정거장이 되면, 달력을 지나 다음 칸으로 가는 데만
   * 서른 번을 눌러야 한다. 짚고 있는 하나만 탭에 걸고 나머지는 화살표로 옮긴다.
   */
  const [focusIso, setFocusIso] = useState(value)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const cellsRef = useRef(new Map<string, HTMLButtonElement>())
  const panelId = useId()

  const canGoPrev = ym > todayIso.slice(0, 7)

  /* 바깥을 누르면 닫는다. click이 아니라 pointerdown인 이유는 RegionPicker 주석 참고 */
  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  /*
   * 짚은 날로 초점을 옮긴다. 그려진 <b>뒤</b>에 옮겨야 해서 useLayoutEffect다 —
   * 달을 넘기면 짚고 있던 버튼이 사라지고 새 버튼이 그려지는데, 그 사이에 초점이
   * body로 떨어지면 화살표 키가 더는 달력에 닿지 않는다.
   */
  useLayoutEffect(() => {
    if (open) {
      cellsRef.current.get(focusIso)?.focus()
    }
  }, [open, focusIso])

  function openPanel() {
    // 고른 날의 달을 펴고 그 날을 짚는다. 지난번에 넘겨 둔 달이 남아 있으면 안 된다
    setYm(value.slice(0, 7))
    setFocusIso(value < todayIso ? todayIso : value)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    // 달력이 사라진 자리에 초점을 두고 올 수 없다. 열었던 버튼으로 돌려준다
    triggerRef.current?.focus()
  }

  function pick(iso: string) {
    onChange(iso)
    close()
  }

  /** 짚는 날을 옮긴다. 지난 날짜로는 내려가지 않고, 달을 벗어나면 달도 함께 넘긴다 */
  function moveFocus(days: number) {
    const next = addDays(focusIso, days)
    if (next < todayIso) {
      return
    }
    setFocusIso(next)
    setYm(next.slice(0, 7))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      close()
      return
    }
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -daysInMonth(shiftMonth(ym, -1)),
      PageDown: daysInMonth(ym),
    }
    if (event.key in step) {
      // 화살표로 페이지가 스크롤되지 않게. 달력 안에서만 움직인다
      event.preventDefault()
      moveFocus(step[event.key])
    }
  }

  const [year, month] = ym.split('-').map(Number)
  const lead = firstWeekday(ym)
  const total = daysInMonth(ym)
  /** 앞의 빈 칸 + 이번 달 날짜들. 뒤는 채우지 않는다 — 그리드가 알아서 끝난다 */
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, index) => `${ym}-${String(index + 1).padStart(2, '0')}`),
  ]
  /** 이 달에 예측이 닿지 않는 날이 있는가. 있을 때만 범례를 세운다 */
  const showsForecastEdge =
    forecastEnd !== null && cells.some((iso) => iso !== null && iso > forecastEnd)

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${ariaLabel}: ${formatKoreanDate(value)}`}
        /*
         * 높이·테두리·모서리를 다른 입력칸과 맞춘다(TEXT_INPUT과 같은 규격).
         * 폼 안에서 이 칸만 다른 크기면 "입력하는 칸"으로 안 읽힌다.
         */
        className={`rounded-ui bg-surface flex h-13 w-full cursor-pointer items-center gap-2.5 border px-3.5 text-left transition-colors ${
          open ? 'border-brand-deep' : 'border-line hover:border-brand-soft'
        }`}
      >
        <Calendar className="text-brand-deep flex-none" />
        <span className="text-fg flex-1 text-base font-semibold">{formatKoreanDate(value)}</span>
        {/* 며칠 뒤인지. 날짜만으로는 "얼마나 먼 여행인가"가 안 읽힌다 */}
        <span className="text-hint flex-none text-[12.5px]">{relativeLabel(value, todayIso)}</span>
        <ChevronDown
          className={`text-hint flex-none transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/*
        빠른 선택. 달력을 열지 않고 고를 수 있는 세 날이다.
        켜진 칩은 <b>사용자가 그 날을 골랐다</b>는 표시이지 미리 정해둔 답이 아니다.
      */}
      <div className="flex gap-1.5">
        {SHORTCUTS.map((shortcut) => {
          const iso = shortcut.resolve(todayIso)
          const active = iso === value
          return (
            <button
              key={shortcut.label}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={active}
              className={`rounded-chip h-8 cursor-pointer border px-3 text-[12.5px] font-semibold transition-colors ${
                active
                  ? 'bg-brand-tint text-brand-deep border-brand-soft'
                  : 'border-line text-muted hover:bg-fill bg-transparent'
              }`}
            >
              {shortcut.label}
            </button>
          )
        })}
      </div>

      {open && (
        /*
         * 달력. <b>절대 위치로 띄운다</b> — 흐름에 넣으면 열 때마다 아래 기간 칸이
         * 300px씩 밀려 내려간다. RegionPicker의 목록과 같은 규칙이다.
         */
        <div
          id={panelId}
          role="group"
          aria-label="날짜 선택 달력"
          onKeyDown={handleKeyDown}
          className="calendar-pop border-line bg-surface shadow-raised rounded-card absolute top-full right-0 left-0 z-20 mt-1.5 border p-3"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYm(shiftMonth(ym, -1))}
              disabled={!canGoPrev}
              aria-label="이전 달"
              /* 지난 달로는 못 간다. 지난 날짜를 못 고르므로 볼 것이 없는 달이다 */
              className="rounded-chip text-muted hover:bg-fill disabled:text-line grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronLeft />
            </button>
            <span className="text-fg text-[15px] font-semibold">
              {year}년 {month}월
            </span>
            <button
              type="button"
              onClick={() => setYm(shiftMonth(ym, 1))}
              aria-label="다음 달"
              className="rounded-chip text-muted hover:bg-fill grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent transition-colors"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-hint pb-1 text-center text-[11.5px] font-medium">
                {day}
              </span>
            ))}
            {cells.map((iso, index) => {
              if (iso === null) {
                return <span key={`blank-${index}`} aria-hidden="true" />
              }
              const past = iso < todayIso
              const selected = iso === value
              const isToday = iso === todayIso
              const beyond = forecastEnd !== null && iso > forecastEnd

              return (
                <button
                  key={iso}
                  type="button"
                  ref={(node) => {
                    if (node) {
                      cellsRef.current.set(iso, node)
                    } else {
                      cellsRef.current.delete(iso)
                    }
                  }}
                  disabled={past}
                  tabIndex={iso === focusIso ? 0 : -1}
                  onClick={() => pick(iso)}
                  onFocus={() => setFocusIso(iso)}
                  aria-label={formatKoreanDate(iso)}
                  aria-pressed={selected}
                  aria-current={isToday ? 'date' : undefined}
                  className={`rounded-chip relative mx-auto grid h-10 w-full max-w-11 cursor-pointer place-items-center border-0 text-[14px] transition-colors ${
                    selected
                      ? /* 밝은 틸 위에는 흰 글자가 아니라 잉크다. 흰 글자는 2.2:1로 안 보인다 */
                        'bg-brand text-fg font-bold'
                      : past
                        ? 'text-hint/45 cursor-not-allowed bg-transparent'
                        : isToday
                          ? 'text-brand-deep hover:bg-brand-tint bg-transparent font-bold'
                          : 'text-fg hover:bg-fill bg-transparent font-medium'
                  }`}
                >
                  {Number(iso.slice(8))}
                  {/*
                    예측이 닿지 않는 날. <b>경고(붐빔)가 아니라 보통(앰버)이다</b> —
                    잘못된 날짜가 아니라 "지금은 아직"이라는 뜻이라서다.
                    고른 날 위에서는 잉크 점으로 바뀐다. 밝은 틸 위의 앰버는 서로를 지운다.
                  */}
                  {beyond && !past && (
                    <span
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        selected ? 'bg-fg/60' : 'bg-moderate'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>

          {showsForecastEdge && (
            <p className="text-hint m-0 flex items-center gap-1.5 px-1 pt-2.5 text-[11.5px]">
              <span className="bg-moderate h-1.5 w-1.5 flex-none rounded-full" aria-hidden="true" />
              예상 혼잡이 아직 나오지 않은 날 — 코스는 짤 수 있어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
