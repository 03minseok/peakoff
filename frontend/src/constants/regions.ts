/**
 * 서비스가 지원하는 지역.
 *
 * 서버의 {@code SupportedRegion} enum과 짝을 이룬다. <b>지역을 늘릴 때는 양쪽을 함께 고쳐야 한다.</b>
 * 한쪽만 고치면 화면에는 보이는데 서버가 거절하는 상태가 된다.
 *
 * 지역이 여러 개가 되면 서버에 목록 조회 엔드포인트를 두고 여기를 지우는 편이 낫다.
 * 지금은 파일럿 한 곳이라 상수로 둔다.
 */
export interface RegionOption {
  slug: string
  name: string
}

/*
 * 서버의 SupportedRegion과 순서·슬러그가 같아야 한다.
 *
 * 제주가 둘로 갈린 이유: 공사 API가 시군구 하나를 받는다. 제주도는 시군구가 둘이라
 * 한 지역으로 묶으려면 서버가 매번 두 번씩 불러 합쳐야 한다.
 * ⚠️ 대신 한라산(제주시)과 성산일출봉(서귀포시)을 한 코스에 담을 수 없다.
 */
export const REGIONS: RegionOption[] = [
  { slug: 'gyeongju', name: '경주' },
  { slug: 'jeju', name: '제주시' },
  { slug: 'seogwipo', name: '서귀포시' },
]

export const DEFAULT_REGION = REGIONS[0].slug

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
  return REGIONS.find((option) => option.slug === slug)?.name ?? ''
}

/**
 * 지금 지역 다음에 올 지역. 마지막이면 처음으로 돌아온다.
 *
 * 홈 화면이 일정 시간마다 지역을 넘기게 될 자리다. <b>지역이 하나뿐이면 자기 자신을
 * 돌려주므로</b>, 호출하는 쪽은 개수를 세지 않아도 된다 — 지역을 늘리는 순간
 * 화면 코드를 고치지 않고도 돌기 시작한다.
 */
export function nextRegion(slug: string): string {
  const index = REGIONS.findIndex((option) => option.slug === slug)
  if (index < 0) {
    return DEFAULT_REGION
  }
  return REGIONS[(index + 1) % REGIONS.length].slug
}

/** 넘길 지역이 둘 이상인지. 하나뿐일 때 타이머를 걸거나 화살표를 그리지 않기 위해 쓴다 */
export function hasMultipleRegions(): boolean {
  return REGIONS.length > 1
}
