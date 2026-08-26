import { useCallback, useRef, useState } from 'react'

/**
 * 세로 목록을 <b>잡아 끌어</b> 순서를 바꾼다.
 *
 * <h3>라이브러리를 쓰지 않은 이유</h3>
 * 이 저장소의 런타임 의존성은 react·react-dom·react-router 셋뿐이다. 정렬 하나 때문에
 * 그 목록을 늘리기보다, 필요한 만큼만 직접 쓰는 편이 이 프로젝트의 결에 맞는다.
 *
 * <h3>왜 Pointer Events인가</h3>
 * HTML5 drag &amp; drop({@code dragstart} 등)은 <b>터치에서 동작하지 않는다.</b>
 * 모바일 우선 서비스에서 그것을 쓰면 정작 주 사용 환경에서 못 쓰는 기능이 된다.
 * Pointer Events는 마우스·터치·펜을 한 벌로 다룬다.
 *
 * <h3>⚠️ 손잡이에서만 잡힌다</h3>
 * {@code touch-action: none}은 <b>그 요소 위에서 브라우저의 기본 제스처를 끈다.</b>
 * 줄 전체에 걸면 목록 위에서 세로 스크롤이 죽어 화면을 내릴 수 없다.
 * 그래서 손잡이에만 걸고, 나머지 자리에서는 평소처럼 스크롤된다.
 *
 * <h3>한 칸씩 즉시 반영한다</h3>
 * 끌린 거리가 한 줄 높이를 넘을 때마다 <b>그 자리에서 목록을 바꾸고</b> 기준점을 옮긴다.
 * 놓을 때까지 미리보기를 따로 들고 있지 않아 상태가 하나뿐이고, 손가락 아래에서
 * 목록이 실제로 움직이므로 결과를 놓기 전에 확인할 수 있다.
 *
 * @param onReorder 실제로 순서를 바꾸는 함수. 한 칸 이동마다 불린다
 */
export interface DragSort {
  /** 지금 끌리고 있는 항목의 인덱스. 없으면 null */
  draggingIndex: number | null
  /** 그 항목을 화면에서 얼마나 띄울지(px). 한 줄 높이 안쪽의 나머지다 */
  offsetY: number
  /**
   * 손잡이에 그대로 펼쳐 붙인다.
   *
   * <p>move·up·cancel까지 <b>손잡이에</b> 단다. 문서(document)에 붙이지 않는 이유는
   * setPointerCapture가 이미 포인터를 이 요소에 붙들어 두기 때문이다 —
   * 손가락이 손잡이 밖으로 나가도 이벤트는 계속 여기로 온다.
   */
  handleProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
    style: { touchAction: 'none' }
  }
}

/** 이만큼 움직이기 전에는 한 칸도 넘기지 않는다. 손 떨림으로 순서가 바뀌지 않게 한다 */
const STEP_TOLERANCE = 0.6

export function useDragSort(
  count: number,
  onReorder: (from: number, to: number) => void,
): DragSort {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [offsetY, setOffsetY] = useState(0)

  /**
   * 끄는 동안의 기준점. 상태가 아니라 ref인 이유는 <b>포인터가 움직일 때마다</b>
   * 값이 바뀌는데, 그때마다 다시 그리면 목록 전체가 매 프레임 재렌더된다.
   */
  const drag = useRef<{ index: number; startY: number; rowHeight: number } | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, index: number) => {
      // 오른쪽 클릭·보조 버튼으로는 끌지 않는다.
      if (event.button !== 0) {
        return
      }
      const row = event.currentTarget.closest('li')
      if (!row) {
        return
      }

      /*
       * 포인터를 손잡이에 붙들어 둔다. 이게 없으면 빠르게 끌 때 포인터가 손잡이 밖으로
       * 나가는 순간 move 이벤트가 끊겨 항목이 손가락을 놓친다.
       */
      event.currentTarget.setPointerCapture(event.pointerId)

      /*
       * 한 칸 넘기는 거리 = 줄 높이 + 줄 사이 간격.
       *
       * ⚠️ 간격을 줄의 margin에서 읽으면 안 된다. 이 목록은 flex {@code gap}으로 띄우는데
       * gap은 자식의 margin에 잡히지 않아 언제나 0이 나온다. <b>부모의 rowGap</b>을 본다.
       */
      const rect = row.getBoundingClientRect()
      const gap = row.parentElement
        ? Number.parseFloat(getComputedStyle(row.parentElement).rowGap) || 0
        : 0
      drag.current = { index, startY: event.clientY, rowHeight: rect.height + gap }
      setDraggingIndex(index)
      setOffsetY(0)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (!current) {
        return
      }
      const delta = event.clientY - current.startY
      const steps = Math.trunc(delta / current.rowHeight + Math.sign(delta) * (1 - STEP_TOLERANCE))

      if (steps !== 0) {
        const to = Math.min(Math.max(current.index + steps, 0), count - 1)
        if (to !== current.index) {
          onReorder(current.index, to)
          /*
           * 기준점을 옮긴 만큼 되돌린다. 이걸 안 하면 한 칸 넘긴 뒤에도 delta가 계속 커져
           * 손가락을 조금만 더 움직여도 두 칸·세 칸씩 튄다.
           */
          current.startY += (to - current.index) * current.rowHeight
          current.index = to
          setDraggingIndex(to)
        }
      }
      setOffsetY(event.clientY - current.startY)
    },
    [count, onReorder],
  )

  const endDrag = useCallback(() => {
    drag.current = null
    setDraggingIndex(null)
    setOffsetY(0)
  }, [])

  /**
   * 키보드로도 옮길 수 있다.
   *
   * <p><b>위/아래 버튼을 없앤 대신 반드시 필요하다.</b> 끌기만 남기면 키보드만 쓰는
   * 사람은 순서를 영영 바꿀 수 없다. 손잡이에 초점을 두고 ↑/↓를 누르면 한 칸씩 움직인다.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, index: number) => {
      const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
      if (direction === 0) {
        return
      }
      const to = index + direction
      if (to < 0 || to >= count) {
        return
      }
      // 화살표는 원래 화면을 스크롤한다. 여기서는 항목을 옮기는 뜻이므로 막는다.
      event.preventDefault()
      onReorder(index, to)

      /*
       * 옮긴 뒤에도 <b>같은 항목에 초점을 남긴다.</b> 그러지 않으면 한 칸 옮길 때마다
       * 초점이 사라져 연달아 누를 수가 없다. 목록이 다시 그려진 뒤에 찾아야 하므로
       * 한 프레임 뒤로 미룬다.
       */
      const handle = event.currentTarget
      const list = handle.closest('ol')
      requestAnimationFrame(() => {
        const handles = list?.querySelectorAll<HTMLElement>('[data-drag-handle]')
        handles?.[to]?.focus()
      })
    },
    [count, onReorder],
  )

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
        handlePointerDown(event, index),
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => handleKeyDown(event, index),
      // 손잡이 위에서만 브라우저 기본 제스처를 끈다. 나머지 자리에서는 평소처럼 스크롤된다.
      style: { touchAction: 'none' as const },
    }),
    [handlePointerDown, handlePointerMove, endDrag, handleKeyDown],
  )

  return { draggingIndex, offsetY, handleProps }
}
