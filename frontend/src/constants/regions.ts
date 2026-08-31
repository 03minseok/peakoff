import type { RegionOption } from '../types/api'

/**
 * 서비스가 지원하는 지역. <b>서버가 정하고 화면은 받아 쓴다.</b>
 *
 * 예전에는 이 파일이 서버의 {@code SupportedRegion}을 그대로 베껴 들고 있었다.
 * 지역이 셋일 때는 견딜 만했지만, 한쪽만 고치면 <b>화면에는 보이는데 서버가 거절하는</b>
 * 상태가 되고 그건 화면에서 원인이 안 보인다. 임계값을 서버에 두는 것과 같은 이유로
 * 목록도 서버에 둔다 — 이제 지역을 늘리는 일은 enum 한 줄이다.
 *
 * <h3>왜 훅이 아니라 모듈 변수인가</h3>
 * {@link regionNameOf}를 <b>화면 여덟 곳이 동기 함수로</b> 쓰고 있다. 이것을 비동기로
 * 바꾸면 여덟 곳 전부에 로딩 상태가 생기는데, 정작 그 화면들이 기다릴 것은 지역 목록이
 * 아니라 자기 데이터다.
 *
 * 그래서 <b>앱이 목록을 받은 뒤에 화면을 그린다</b>({@code RegionProvider}).
 * 그 뒤로는 목록이 세션 중에 바뀌지 않으므로, 여기 담아 두고 동기로 읽어도 안전하다.
 *
 * <p>⚠️ 그러니 {@code RegionProvider} <b>바깥에서 이 함수들을 부르지 말 것.</b>
 * 목록이 비어 있어 이름이 빈 문자열로 나오고, 원인이 화면에서 안 보인다.
 */
let regions: RegionOption[] = []

/**
 * 서버에서 받은 목록을 채운다. {@code RegionProvider}만 부른다.
 *
 * 화면을 그리기 <b>전에</b> 불려야 한다 — 그리고 나서 채우면 이미 그려진 화면이
 * 빈 이름을 들고 서 있게 된다.
 */
export function setRegions(loaded: RegionOption[]): void {
  regions = loaded
}

/** 지원 지역 전부. 서버가 준 순서 그대로다 — 파일럿(경주)이 맨 앞이라는 뜻이 담겨 있다. */
export function regionOptions(): RegionOption[] {
  return regions
}

/**
 * 아무것도 안 고른 사람에게 줄 지역.
 *
 * 목록의 첫 번째다. 서버가 파일럿부터 순서대로 주므로 경주가 된다 —
 * 화면에 슬러그를 박아두면 서버가 순서를 바꿔도 화면만 옛 지역을 기본으로 든다.
 */
export function defaultRegionSlug(): string {
  return regions[0]?.slug ?? ''
}

/**
 * 슬러그를 화면에 쓸 지역명으로 바꾼다.
 *
 * <b>이 조회가 화면 네 곳에 복사돼 있었다.</b> 지역이 늘거나 이름 표기가 바뀌면
 * 고쳐야 할 곳을 전부 찾아다녀야 하고, 하나를 놓치면 그 화면만 옛 이름으로 남는다.
 *
 * 모르는 슬러그에는 빈 문자열을 준다. "알 수 없는 지역" 같은 말을 끼워 넣으면
 * "오늘의 알 수 없는 지역"이 되어 오히려 더 이상하다.
 */
export function regionNameOf(slug: string): string {
  return regions.find((option) => option.slug === slug)?.name ?? ''
}

/**
 * 지금 지역 다음에 올 지역. 마지막이면 처음으로 돌아온다.
 *
 * 홈 화면이 일정 시간마다 지역을 넘기는 데 쓴다. <b>지역이 하나뿐이면 자기 자신을
 * 돌려주므로</b>, 호출하는 쪽은 개수를 세지 않아도 된다.
 */
export function nextRegion(slug: string): string {
  const index = regions.findIndex((option) => option.slug === slug)
  if (index < 0) {
    return defaultRegionSlug()
  }
  return regions[(index + 1) % regions.length].slug
}

/** 넘길 지역이 둘 이상인지. 하나뿐일 때 타이머를 걸거나 화살표를 그리지 않기 위해 쓴다 */
export function hasMultipleRegions(): boolean {
  return regions.length > 1
}

/**
 * 검색어로 지역을 거른다.
 *
 * <p>무엇으로 걸리는지는 <b>서버가 준 {@code searchText}</b>가 정한다 — 짧은 이름("속초")과
 * 정식 이름("강원특별자치도 속초시")과 시도("강원특별자치도")와 슬러그("sokcho")가 들어 있다.
 * 화면이 이어 붙이면 "무엇으로 검색되는가"가 화면 규칙이 되어, 나중에 별칭("제주도")을
 * 붙일 때 서버와 화면을 함께 고쳐야 한다.
 *
 * <p><b>빈 검색어에는 전부 돌려준다.</b> 지역이 일곱뿐이라 처음부터 다 보여주는 편이 낫다 —
 * 빈 목록을 세워 두면 "무엇을 칠 수 있는지"를 사용자가 알 방법이 없다.
 *
 * <p>공백은 지우고 견준다. "강원 특별"처럼 띄어 친 사람도 찾아지게 하기 위해서다.
 */
export function searchRegions(keyword: string): RegionOption[] {
  const needle = keyword.replace(/\s+/g, '').toLowerCase()
  if (!needle) {
    return regions
  }
  return regions.filter((option) =>
    option.searchText.replace(/\s+/g, '').toLowerCase().includes(needle),
  )
}
