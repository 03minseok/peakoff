import { useEffect, useState } from 'react'

/**
 * 이보다 큰 가림은 <b>도구막대가 아니라 키보드</b>로 본다.
 *
 * <p>안드로이드·iOS의 브라우저 아래 막대는 대개 50~90px이고, 키보드는 250px을 훌쩍 넘는다.
 * 키보드까지 따라 올라가면 입력하는 내내 이동 막대가 자판 위에 얹혀 화면을 더 좁힌다 —
 * 그때는 아래에 그냥 두는 편이 맞다(어차피 자판에 가려 안 보인다).
 */
const KEYBOARD_INSET_THRESHOLD = 160

/**
 * 브라우저 아래 도구막대에 가려지지 않도록 막대를 <b>끌어올릴 높이</b>.
 *
 * <h3>왜 필요한가</h3>
 * {@code position: fixed; bottom: 0}은 <b>레이아웃 화면</b>의 바닥에 붙는다. 그런데
 * 크롬 안드로이드는 도구막대가 나타났다 사라질 때마다 화면이 재배치되지 않도록,
 * 레이아웃 화면을 <b>항상 도구막대가 숨은 상태의 큰 크기로</b> 잡아 둔다.
 *
 * <p>그래서 도구막대가 <b>떠 있는 동안 그 바닥은 막대 뒤에 깔려 있다.</b> 아래로 쓸어
 * 도구막대가 올라오는 순간 이동 막대가 그 뒤로 숨는 것이 이 때문이다 — 위로 쓸어
 * 도구막대가 사라지면 멀쩡해 보이는 것도 같은 이유다.
 * 네이버 앱처럼 자체 아래 막대가 없는 브라우저에서 멀쩡한 것도 맞아떨어진다.
 *
 * <p>CSS만으로는 이 값을 알 수 없다. {@code env(safe-area-inset-bottom)}은 노치·홈
 * 인디케이터 같은 <b>기기</b>의 여백이지 브라우저 UI가 아니다. 실제로 지금 보이는 영역을
 * 아는 것은 visualViewport뿐이라 여기서만 자바스크립트를 쓴다.
 *
 * <p>지원하지 않는 브라우저에서는 0을 돌려주고, 그러면 예전과 똑같이 동작한다.
 */
export function useBrowserChromeInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const update = () => {
      /*
       * 레이아웃 화면 중 <b>지금 안 보이는 아래쪽</b> 높이.
       *
       * clientHeight(레이아웃 화면, 도구막대와 무관하게 고정) 에서
       * 실제로 보이는 높이와 위쪽으로 밀린 양을 빼면 아래에 가려진 만큼이 남는다.
       * 도구막대가 위에 있는 브라우저에서는 offsetTop이 그것을 흡수해 0이 나온다.
       */
      const hidden =
        document.documentElement.clientHeight - viewport.height - viewport.offsetTop

      setInset(hidden > 0 && hidden < KEYBOARD_INSET_THRESHOLD ? Math.round(hidden) : 0)
    }

    update()
    /*
     * resize는 도구막대가 나타나고 사라질 때, scroll은 확대한 채 화면을 밀 때 온다.
     * 전환 애니메이션 중에도 계속 오므로 막대가 따라 움직인다 —
     * 여기에 transition을 걸면 오히려 한 박자씩 늦어 더 흔들린다.
     */
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
