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

export const REGIONS: RegionOption[] = [{ slug: 'gyeongju', name: '경주' }]

export const DEFAULT_REGION = REGIONS[0].slug
