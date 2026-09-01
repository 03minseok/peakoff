import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Alert } from './icons'

/** 알아두면 되는 것(앰버)과 고쳐야 하는 것(붉은색) */
export type HintTone = 'warn' | 'danger'

const TONE: Record<HintTone, string> = {
  warn: 'text-moderate-strong hover:text-moderate-deep',
  danger: 'text-crowded-strong hover:text-crowded-deep',
}

/**
 * 짚으면 뜨는 쪽지. 동그라미 안의 느낌표를 누르거나 손을 올리면 설명이 나온다.
 *
 * <h3>왜 글자를 아이콘으로 바꿨나</h3>
 * 여행 카드에 "앞 코스와 1일 겹쳐요" 같은 글이 <b>제 줄을 하나 차지하고</b> 서 있었다.
 * 대부분의 여행에는 이 줄이 아예 없고, 있어도 한 번 읽으면 그만인 말인데,
 * 있을 때마다 카드가 한 줄씩 길어졌다.
 *
 * <p>표시는 자리를 거의 안 쓰면서 "여기 볼 것이 있다"를 말하고, 내용은 원할 때만 편다.
 *
 * <h3>두 단계다 — 앰버와 붉은색</h3>
 * <b>고쳐야 하는 것</b>과 <b>알아두면 되는 것</b>은 같은 색으로 말할 수 없다.
 * 코스 사이가 비어 있거나 앞 코스가 끝나는 날 다음 코스가 시작하는 것은 <b>그냥 그런
 * 일정</b>이지 잘못이 아니다 — 앰버. 이틀 넘게 겹치는 것은 같은 시간에 두 곳에 있겠다는
 * 뜻이라 <b>고치기 전에는 이어 볼 수 없다</b> — 붉은색.
 *
 * <p>이 등급이 화면 아래 "한번에 보기"의 활성 여부를 정한다. 색과 버튼이 <b>한 몸</b>이라,
 * 붉은 표시가 있으면 버튼이 잠기고 앰버만 있으면 열린다.
 *
 * <h3>색은 이 서비스의 주의 표시에서 가져온다</h3>
 * 잉크로 두었다가 앰버로 바꿨다(2026-09-01). 회색 표시는 <b>눌러볼 것이 있다는 사실
 * 자체를 말하지 못했다</b> — 옆의 삭제·닫기 같은 보조 장치와 같은 무게라 그냥 지나친다.
 *
 * <p>앰버는 이미 이 서비스의 주의 색이다 — 로그인의 게스트 안내, 코스 짜기의 예측 창
 * 안내가 {@code moderate-tint} 상자에 {@code moderate-deep} 글자로 선다.
 * 새 경고색을 만들지 않고 <b>있는 것을 쓴다.</b>
 *
 * <p>⚠️ 이 팔레트에서 앰버는 혼잡 "보통", 붉은색은 "붐빔"이기도 하다. 같은 줄 오른쪽에
 * 그 배지가 설 수 있어 <b>모양으로 갈라 둔다</b> — 배지는 채운 칩에 점과 숫자가 있고
 * 이쪽은 선으로만 그린 동그라미다. 색이 겹쳐도 생김새가 겹치지 않으면 서로 다른 것으로 읽힌다.
 *
 * <h3>손가락에도 열린다</h3>
 * hover만으로 만들면 터치 기기에서는 아무 일도 일어나지 않는다. 눌러서도 열리고,
 * 키보드 초점으로도 열리며, 바깥을 누르거나 Esc로 닫힌다.
 */
export function HintDot({ label, tone = 'warn' }: { label: string; tone?: HintTone }) {
  /*
   * ⚠️ <b>"짚었다"와 "눌러 붙였다"를 갈라 둔다.</b> 하나로 두면 마우스에서 고장난다 —
   * 손을 올리는 순간 열리고, 그 상태에서 누르면 토글이 <b>닫아 버린다.</b>
   * 열려고 눌렀는데 닫히는 셈이라 실제로 그렇게 동작했다.
   *
   * <p>둘 중 하나라도 참이면 열린다. 눌러 붙인 것은 손을 떼도 남고, 바깥을 누르거나
   * Esc로 푼다.
   */
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const id = useId()
  /** 쪽지를 어느 쪽으로 펼지와 그때 허용되는 폭. 열릴 때마다 다시 잰다 */
  const [tip, setTip] = useState<{ align: 'left' | 'right'; maxWidth: number }>({
    align: 'left',
    maxWidth: 208,
  })

  /*
   * ⚠️ <b>쪽지가 화면 밖으로 나가지 않게 잰다.</b> 이 표시는 코스 <b>이름 옆</b>에 서는데,
   * 이름이 길면 잘려서 표시가 카드 오른쪽 끝까지 밀린다. 거기서 왼쪽 끝을 맞춰 오른쪽으로
   * 펴면 쪽지가 화면을 넘고, <b>넘친 만큼 페이지 전체가 옆으로 밀린다</b> —
   * 이 저장소가 가장 자주 겪은 모바일 사고다.
   *
   * <p>그래서 열리는 순간 표시의 자리를 재어 <b>넓은 쪽으로 편다.</b> 양쪽 다 좁으면
   * 넓은 쪽에 붙이고 폭을 남은 자리까지 줄인다 — 잘려 보이느니 줄바꿈이 낫다.
   *
   * <p>{@code useLayoutEffect}다. 그려진 뒤에 재면 <b>한 프레임 동안 잘못된 자리</b>에
   * 쪽지가 떴다가 옮겨 앉는 것이 보인다.
   */
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const EDGE = 12 // 화면 가장자리에서 이만큼은 띄운다
    const IDEAL = 208 // 평소 폭(13rem). 자리가 되면 이 이상 넓히지 않는다
    const toRight = window.innerWidth - EDGE - rect.left
    const toLeft = rect.right - EDGE
    setTip(
      toRight >= IDEAL || toRight >= toLeft
        ? { align: 'left', maxWidth: Math.min(IDEAL, toRight) }
        : { align: 'right', maxWidth: Math.min(IDEAL, toLeft) },
    )
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false)
        setHovered(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPinned(false)
        setHovered(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((current) => !current)}
        /* 마우스만 짚기로 연다. 터치는 pointerenter가 눌림과 함께 와서 둘이 겹친다 */
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') {
            setHovered(true)
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') {
            setHovered(false)
          }
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`-m-1.5 cursor-pointer rounded-full border-0 bg-transparent p-1.5 transition-colors ${TONE[tone]}`}
      >
        <Alert size={15} />
      </button>

      {open && (
        /*
         * 쪽지. <b>절대 위치</b>라 열려도 줄이 밀리지 않는다 — 무엇인지 보려고 열었는데
         * 보고 있던 줄이 움직이면 안 된다.
         *
         * <p>펴는 방향과 폭은 위에서 잰 값으로 정한다. 붙박이로 두면 화면 밖으로 나가고,
         * 그 순간 페이지가 통째로 옆으로 밀린다.
         */
        <span
          id={id}
          role="tooltip"
          style={{ maxWidth: `${tip.maxWidth}px` }}
          className={`bg-fg shadow-raised pointer-events-none absolute top-full z-30 mt-1.5 w-max rounded-[10px] px-2.5 py-1.5 text-[12px] leading-[1.45] font-medium text-white ${
            tip.align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  )
}
