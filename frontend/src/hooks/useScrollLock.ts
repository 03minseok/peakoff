import { useEffect } from 'react'

/**
 * 시트·모달이 떠 있는 동안 <b>뒤 화면이 따라 움직이지 않게</b> 잠근다.
 *
 * <h3>⚠️ body가 아니라 html에 건다</h3>
 * 모든 시트가 {@code document.body.style.overflow = 'hidden'}을 쓰고 있었는데,
 * 그것이 <b>sticky를 얼어붙게 했다.</b>
 *
 * <p>body에 overflow를 걸면 body가 <b>새 스크롤 컨테이너</b>가 된다. 그 안의
 * {@code position: sticky} 요소는 화면이 아니라 <b>body를 기준</b>으로 다시 자리를 잡는데,
 * 뒤 화면은 이미 아래로 내려가 있으므로 그 순간 제자리(문서 맨 위 근처)로 튀어 오른다.
 * 진단 화면에서 "상세보기를 눌렀더니 왼쪽 패널이 훅 올라간다"가 이것이었다.
 * (이 원리는 {@code index.css}의 html/body 주석에 이미 적혀 있었다.)
 *
 * <p>반면 <b>루트(html)의 overflow는 화면 자체로 넘겨지고 html은 도로 visible이 된다</b> —
 * 새 스크롤 컨테이너가 생기지 않으므로 sticky는 예전처럼 화면을 기준으로 붙어 있는다.
 *
 * <h3>⚠️ 스크롤바가 사라진 만큼 자리를 채운다</h3>
 * html은 평소 {@code overflow-y: scroll}이라 데스크톱에서 16px을 늘 차지한다
 * (그 이유도 index.css에 있다 — 화면을 옮길 때 가운데 정렬이 밀리지 않게 하려는 것).
 * 잠그면서 그 막대가 사라지면 표시 영역이 16px 넓어져 <b>뒤 화면 전체가 8px 옆으로
 * 밀린다.</b> 시트를 여닫을 때마다 배경이 들썩이는 것으로 보인다.
 *
 * <p>그래서 <b>잠그기 직전에</b> 막대 너비를 재어 같은 만큼 padding으로 메운다.
 * 순서가 중요하다 — 잠근 뒤에 재면 이미 막대가 없어 0이 나온다.
 *
 * <p>모바일은 겹침형 스크롤바라 너비가 0이고, 그때는 padding을 건드리지 않는다.
 */
export function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement

    // 화면 전체 폭과 내용 폭의 차이가 곧 스크롤바 너비다. 반드시 잠그기 전에 잰다.
    const gutter = window.innerWidth - root.clientWidth

    const previousOverflow = root.style.overflowY
    const previousPadding = root.style.paddingRight

    root.style.overflowY = 'hidden'
    if (gutter > 0) {
      root.style.paddingRight = `${gutter}px`
    }

    return () => {
      /*
       * 빈 문자열로 되돌린다. 다른 값을 넣으면 CSS에 적힌 값(overflow-y: scroll)을
       * 인라인으로 덮어써, 시트를 한 번 연 뒤로는 그 값이 영영 인라인에 남는다.
       */
      root.style.overflowY = previousOverflow
      root.style.paddingRight = previousPadding
    }
  }, [])
}
