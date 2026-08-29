import { ArrowDown, ArrowUp } from './icons'

/**
 * 긴 목록의 <b>끝으로 / 처음으로</b> 한 번에 가는 줄.
 *
 * <h3>왜 필요한가</h3>
 * 코스가 3박 4일이 되면 장소 카드가 열몇 장이다. 사진을 키우고 나서는 더 길어졌다.
 * 아래를 보다가 위 요약으로 돌아가려면 그 열몇 장을 손으로 되짚어야 했다.
 *
 * <h3>떠 있는 버튼을 쓰지 않는다</h3>
 * ⚠️ 흔한 방법은 화면 구석에 고정해 두는 것인데, 이 저장소에는 그러지 않기로 한 규칙이 있다 —
 * {@code position: fixed}로 바닥에 붙인 것이 크롬 안드로이드 도구막대 뒤로 숨는 문제를
 * 겪고 하단 이동 막대를 걷어냈다(CLAUDE.md 모바일 규칙). 같은 함정을 다시 팔 이유가 없다.
 *
 * <p>대신 <b>목록의 위아래 끝</b>에 둔다. 목록 끝에 닿았을 때 바로 그 자리에 버튼이
 * 있으므로, 떠 있는 버튼이 하던 일을 그대로 하면서 화면을 가리지 않는다.
 *
 * <h3>⚠️ 자리를 스스로 잡지 않는다</h3>
 * 이 컴포넌트는 <b>버튼 하나만</b> 돌려준다. 처음에는 가운데 정렬한 상자로 감쌌는데
 * 두 가지가 어긋났다 — 목록 위에서 <b>한 줄을 통째로 차지해</b> 정작 봐야 할 카드가
 * 아래로 밀렸고, 마이페이지에서는 부모가 격자라 <b>카드 한 칸을 먹었다</b>(넓은 화면에서
 * 3열 중 하나). 자리는 부르는 쪽이 정한다 — 곁들일 줄이 있으면 그 줄에 얹고,
 * 없으면 오른쪽에 붙인다.
 *
 * <h3>부드럽게 움직이되, 원하지 않는 사람에게는 아니다</h3>
 * {@code behavior: 'smooth'}는 브라우저가 사용자의 "동작 줄이기" 설정을 존중한다 —
 * 그 설정이 켜져 있으면 즉시 이동한다. 우리가 따로 분기하지 않아도 된다.
 */
interface Props {
  /** 옮겨 갈 자리의 id. 그 요소가 없으면 아무 일도 하지 않는다 */
  targetId: string
  direction: 'down' | 'up'
  /** 무엇의 끝인지. "코스", "목록"처럼 */
  label: string
}

export function ListEdgeJump({ targetId, direction, label }: Props) {
  function jump() {
    /*
     * 요소를 못 찾으면 조용히 넘어간다. 목록이 비었거나(담긴 장소가 없다) 아직 안 그려진
     * 순간이 있는데, 그때 버튼이 오류를 내는 것보다 아무 일도 안 하는 편이 낫다.
     */
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      type="button"
      onClick={jump}
      className="press text-hint hover:text-brand-deep rounded-chip -mr-1 flex flex-none cursor-pointer items-center gap-1 bg-transparent px-1 py-0.5 text-[12px] font-semibold whitespace-nowrap transition-colors"
    >
      {direction === 'down' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
      {label} {direction === 'down' ? '끝으로' : '처음으로'}
    </button>
  )
}
