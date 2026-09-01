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
 *   <li><b>화면 밖으로 자라지 않는다.</b> 아래가 좁으면 칸 <b>위로</b> 펼친다 — 아래 {@link Placement}
 * </ul>
 */

/**
 * 달력이 서는 자리.
 *
 * <p>{@code below}가 기본이다 — 누른 칸에서 아래로 자라는 것이 이 컴포넌트가 말하려던 동작이고,
 * 애니메이션도 그 방향으로 만들어져 있다.
 *
 * <h3>왜 뒤집는 장치가 필요한가</h3>
 * 좁은 화면에서 날짜 칸은 대개 화면 <b>중간 아래</b>에 있다. 390×664에서 재보니
 * 코스 짜기는 달력의 <b>154px</b>이, 코스 발견은 <b>57px</b>이 화면 밖으로 나갔다 —
 * 마지막 주와 안내 문장이 잘려서, 달을 넘기려면 페이지를 먼저 스크롤해야 했다.
 *
 * <p><b>스크롤로 풀지 않는다.</b> 절대 위치라 문서가 그만큼 늘어나므로 밀어 내리면
 * 보이기는 하는데, 크롬 안드로이드는 도구막대가 떠 있는 동안 <b>레이아웃 화면을 실제보다
 * 크게</b> 잡는다 — 문서 끝까지 밀어도 마지막 한 줄이 도구막대 뒤에 남는다.
 * CLAUDE.md가 하단 고정 막대를 금지한 것과 같은 사정이다. 그래서 <b>보이는 높이
 * (visualViewport)로 재서 자리를 옮긴다.</b>
 */
type Placement = 'below' | 'above'

/** 요일 머리글. 일요일 시작 — 한국 달력의 관습이다 */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
  /** 아래로 펼칠지 위로 펼칠지. {@link Placement} */
  const [placement, setPlacement] = useState<Placement>('below')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
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
   * 달력이 화면 안에 다 들어오는지 재고, 아니면 칸 위로 옮긴다.
   *
   * <p><b>{@code useLayoutEffect}다.</b> 그려진 뒤 화면에 칠해지기 <b>전</b>에 옮겨야
   * 아래에 잠깐 폈다가 위로 튀는 것이 안 보인다.
   *
   * <p>재는 높이는 {@code innerHeight}가 아니라 <b>{@code visualViewport.height}</b>다 —
   * 주소창·도구막대가 떠 있는 만큼 실제로 보이는 높이는 그보다 작고, 잘리는 것도 그 차이만큼이다.
   *
   * <h3>⚠️ 한 번 위로 간 달력은 열려 있는 동안 다시 내려오지 않는다</h3>
   * 달을 넘기면 주가 다섯이었다 여섯이 되어 높이가 한 줄씩 달라진다. 그때마다 다시 재면
   * <b>‹ › 를 누를 때마다 달력이 위아래로 뛰어</b>, 짚고 있던 자리를 놓친다.
   * 그래서 {@code below → above}는 한 방향으로만 간다. 닫으면 원래대로 돌아간다.
   *
   * <p>양쪽 다 좁으면(아주 낮은 화면) 아래에 두고 <b>스크롤로 최선을 다한다</b> —
   * 위로 옮겨도 어차피 잘리는 자리라, 적어도 눌러서 연 칸 가까이에는 있어야 한다.
   */
  useLayoutEffect(() => {
    if (!open) {
      setPlacement('below')
      return
    }
    const panel = panelRef.current
    const trigger = triggerRef.current
    if (!panel || !trigger) {
      return
    }
    const visibleHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = trigger.getBoundingClientRect()
    const height = panel.offsetHeight
    /** 칸과 달력 사이 여백(mt-1.5 = 6px) */
    const gap = 6
    const roomBelow = visibleHeight - rect.bottom - gap
    const roomAbove = rect.top - gap

    /*
     * ⚠️ 판단을 {@code setPlacement}의 콜백 안에서 하지 않는다. StrictMode가 갱신 함수를
     * <b>두 번 부르며</b> 순수한지 확인하는데, 그 안에서 스크롤을 걸면 두 번 걸린다.
     * 여기서는 값을 정하고, 미는 일은 아래에서 한 번만 한다.
     */
    if (placement === 'above' || height <= roomBelow) {
      return
    }
    if (height <= roomAbove) {
      setPlacement('above')
      return
    }

    /*
     * 양쪽 다 좁다(아주 낮은 화면). 아래에 둔 채 <b>넘친 만큼</b> 페이지를 민다.
     *
     * <p>⚠️ <b>한 번에 못 민다.</b> 달력은 절대 위치라 문서를 그만큼 늘리는데,
     * 방금 그려진 그 높이가 <b>스크롤 한계에 아직 반영되기 전</b>이라 미는 값이 거기서
     * 잘린다 — 390×560에서 9px을 남기고 멈췄다. 그래서 <b>남은 만큼을 다음 프레임에
     * 다시 민다.</b> 더 밀 곳이 없으면 스스로 멈추고, 세 프레임을 넘기지 않는다.
     *
     * <p>{@code scrollIntoView({block:'nearest'})}에 맡기지 않는 것도 같은 이유다.
     */
    let frame = 0
    /* 화살표 함수다 — 호이스팅되는 function 선언은 위의 null 검사를 물려받지 못한다 */
    const nudge = (tries: number) => {
      const over =
        panel.getBoundingClientRect().bottom -
        (window.visualViewport?.height ?? window.innerHeight)
      if (over < 1 || tries === 0) {
        return
      }
      window.scrollBy({ top: over })
      frame = requestAnimationFrame(() => nudge(tries - 1))
    }
    frame = requestAnimationFrame(() => nudge(3))
    return () => cancelAnimationFrame(frame)
    /*
     * ⚠️ 달({@code ym})과 예측 창이 바뀌면 다시 잰다 — 주가 다섯이었다 여섯이 되거나
     * 아래 안내 한 줄이 붙었다 떨어지면서 높이가 달라진다. 위의 한 방향 규칙이
     * 여기서 튀는 것을 막는다.
     */
  }, [open, ym, forecastEnd, placement])

  /*
   * 짚은 날로 초점을 옮긴다. 그려진 <b>뒤</b>에 옮겨야 해서 useLayoutEffect다 —
   * 달을 넘기면 짚고 있던 버튼이 사라지고 새 버튼이 그려지는데, 그 사이에 초점이
   * body로 떨어지면 화살표 키가 더는 달력에 닿지 않는다.
   */
  useLayoutEffect(() => {
    if (open) {
      /*
       * ⚠️ <b>{@code preventScroll}이다.</b> 그냥 focus()하면 브라우저가 그 칸을 보이게
       * 하려고 페이지를 밀어 올리는데, 그 판단이 <b>자리를 옮기기 전 위치</b>로 이뤄진다 —
       * 위의 효과가 달력을 칸 위로 옮기는 같은 순간에 페이지가 190px 내려가,
       * 잘리지 않게 하려던 장치가 오히려 달력의 윗부분을 화면 밖으로 밀어냈다(390×560 실측).
       *
       * <p>스크롤이 필요한 경우는 위에서 이미 가려낸다. 여기서는 초점만 옮긴다.
       */
      cellsRef.current.get(focusIso)?.focus({ preventScroll: true })
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
  /*
   * 예측이 닿지 않는 날을 어떻게 알릴지.
   *
   * <p>⚠️ <b>온 달이 창 밖이면 날마다 점을 찍지 않는다.</b> 처음엔 그렇게 했더니
   * 10월 서른한 칸에 점이 빠짐없이 박혀, 무엇을 가리키는 표시가 아니라 <b>무늬</b>가 됐다.
   * 모두에게 붙은 표시는 아무것도 구별하지 못한다.
   *
   * <p>점은 <b>경계가 이 달 안에 있을 때</b>만 뜻이 있다 — "여기부터 비어 있다"를
   * 날짜 위에서 가리키는 일이다. 달 전체가 밖이면 그 사실을 한 문장으로 말하는 편이 짧다.
   */
  const selectable = cells.filter((iso): iso is string => iso !== null && iso >= todayIso)
  const beyondCount =
    forecastEnd === null ? 0 : selectable.filter((iso) => iso > forecastEnd).length
  /** 고를 수 있는 날이 전부 창 밖인 달 */
  const wholeMonthBeyond = beyondCount > 0 && beyondCount === selectable.length
  /** 경계가 이 달 안에 있다. 이때만 점을 찍는다 */
  const marksForecastEdge = beyondCount > 0 && !wholeMonthBeyond

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
        {/*
          ⚠️ 모바일은 <b>14.5px</b>, lg는 예전 16px이다 (2026-09-02).
          좁은 화면에서 이 칸의 날짜만 16px이라 같은 화면의 다른 글자들보다 커 보였다 —
          입력칸의 값은 <b>읽는 글</b>이지 제목이 아니다.
        */}
        <span className="text-fg flex-1 text-[14.5px] font-semibold lg:text-base">
          {formatKoreanDate(value)}
        </span>
        {/* 며칠 뒤인지. 날짜만으로는 "얼마나 먼 여행인가"가 안 읽힌다 */}
        <span className="text-hint flex-none text-[12.5px]">{relativeLabel(value, todayIso)}</span>
        <ChevronDown
          className={`text-hint flex-none transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        /*
         * 달력. <b>절대 위치로 띄운다</b> — 흐름에 넣으면 열 때마다 아래 기간 칸이
         * 300px씩 밀려 내려간다. RegionPicker의 목록과 같은 규칙이다.
         *
         * <p><b>폭에 상한을 둔다.</b> 데스크톱에서 카드가 600px까지 넓어지는데 그대로 따라가면
         * 일곱 칸이 흩어져 <b>달력이 아니라 표</b>로 보인다. 390px에서는 상한에 닿지 않으므로
         * 모바일은 그대로다.
         */
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="날짜 선택 달력"
          onKeyDown={handleKeyDown}
          /*
           * 자라나는 방향이 자리에 따라 갈린다. 위로 펼치면서 아래에서 자라는 움직임을
           * 그대로 두면 <b>달력이 칸에서 멀어지는 쪽으로</b> 움직여, 어느 칸을 눌러서
           * 열린 것인지가 흐려진다. 축은 언제나 칸에 붙은 변이다.
           */
          className={`calendar-pop border-line bg-surface shadow-raised rounded-card absolute left-0 z-20 w-full max-w-[22rem] border p-3 ${
            placement === 'above' ? 'calendar-pop-up bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
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

                    <p>숫자 자체를 앰버로 칠해 봤다가 되돌렸다 — 날짜 글자는
                    <b>고를 수 있다/없다</b>를 말하는 자리라, 거기에 다른 뜻의 색을 얹으면
                    "고르면 안 되는 날"로 읽힌다. 점은 숫자 아래에 따로 서서 덧붙이기만 한다.

                    <p>달이 통째로 예측 밖이어도 찍는다. 아래 한 줄이 같은 말을 하지만,
                    <b>날짜 칸을 보고 있는 눈</b>이 그 줄까지 내려가지 않는다.

                    <p>고른 날 위에서는 잉크 점으로 바뀐다. 밝은 틸 위의 앰버는 서로를 지운다.
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

          {/*
            막지 않는다는 것을 함께 적는다. 표시만 두면 "고르면 안 되는 날"로 읽힌다 —
            여행은 원래 미리 계획하는 것이고, 예측은 여행이 가까워지면 채워진다.
          */}
          {marksForecastEdge && (
            <p className="text-hint m-0 flex items-center gap-1.5 px-1 pt-2.5 text-[11.5px]">
              <span className="bg-moderate h-1.5 w-1.5 flex-none rounded-full" aria-hidden="true" />
              예상 혼잡이 아직 나오지 않은 날 — 코스는 짤 수 있어요
            </p>
          )}
          {wholeMonthBeyond && (
            <p className="text-hint m-0 px-1 pt-2.5 text-[11.5px]">
              {month}월은 예상 혼잡이 아직 나오지 않았어요 — 코스는 짤 수 있어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}
