import { useEffect, useRef, type RefObject } from 'react'

/**
 * 요소가 화면에 <b>처음 들어온 순간</b> {@code data-inview}를 단다. 한 번 달면 떼지 않는다.
 *
 * <h3>왜 상태가 아니라 DOM 속성인가</h3>
 * 나타났다는 사실은 화면을 다시 그릴 이유가 아니다. {@code useState}로 두면 진입할 때마다
 * 그 아래 트리가 통째로 리렌더되는데, 소개 화면은 그런 덩어리가 스무 개쯤 된다.
 * 속성 하나만 바꾸면 CSS가 알아서 전환을 돌리고 React는 아무 일도 하지 않는다 —
 * "프레임마다 리렌더가 일어나면 프레임이 떨어진다. 상태 대신 ref로 스타일을 직접 만진다."
 *
 * <p>React가 이 속성을 지우지 않는다. React는 <b>자기가 그린 속성만</b> 관리하고,
 * 이 속성은 JSX에 없다.
 *
 * <h3>관찰자는 하나다</h3>
 * 요소마다 {@code IntersectionObserver}를 만들면 스무 개가 각자 스크롤을 듣는다.
 * 하나를 두고 요소만 등록한다. 들어온 요소는 그 자리에서 등록을 푼다 — 다시 볼 일이 없다.
 *
 * <h3>움직임을 줄인 사용자</h3>
 * 관찰자를 세우지 않고 <b>바로</b> 단다. CSS 쪽에서도 전환을 끄지만, 이렇게 해 두면
 * 스크롤을 듣는 일 자체가 없다. 전정기관에 예민한 사람에게 "천천히 나타남"은 배려가
 * 아니라 멀미다 — 전부 끄는 것이 맞다.
 *
 * <h3>⚠️ 관찰자가 없는 환경</h3>
 * 아주 오래된 브라우저에는 없다. 그때도 바로 단다. 숨긴 채 영영 안 나타나는 것이
 * 애니메이션이 없는 것보다 훨씬 나쁘다.
 */

const ROOT_MARGIN = '0px 0px -10% 0px'

let observer: IntersectionObserver | null = null
const entered = new WeakMap<Element, () => void>()

function reveal(element: HTMLElement) {
  element.dataset.inview = ''
}

function watch(element: HTMLElement): () => void {
  if (
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    reveal(element)
    return () => {}
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          const done = entered.get(entry.target)
          if (done) {
            done()
            entered.delete(entry.target)
            observer?.unobserve(entry.target)
          }
        }
      },
      /*
       * 아래쪽 10%를 잘라 둔다. 화면 바닥에 1px 걸치자마자 나타나면 사용자는
       * 전환의 앞부분을 보지 못한다 — 조금 올라온 뒤 시작해야 움직임이 읽힌다.
       */
      { rootMargin: ROOT_MARGIN, threshold: 0.01 },
    )
  }

  entered.set(element, () => reveal(element))
  observer.observe(element)

  return () => {
    entered.delete(element)
    observer?.unobserve(element)
  }
}

export function useInView<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    return watch(element)
  }, [])

  return ref
}
