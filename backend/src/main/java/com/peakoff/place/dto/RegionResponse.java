package com.peakoff.place.dto;

import com.peakoff.place.domain.SupportedRegion;

/**
 * 서비스가 지원하는 지역 하나.
 *
 * <p><b>왜 화면에 상수로 두지 않고 서버가 내려보내는가.</b> 예전에는
 * {@code constants/regions.ts}가 {@link SupportedRegion}을 그대로 복사하고 있었다.
 * 지역이 셋일 때는 견딜 만했지만, 한쪽만 고치면 <b>화면에는 보이는데 서버가 거절하는</b>
 * 상태가 되고 그건 화면에서 원인이 안 보인다. 임계값을 서버에 두는 것과 같은 이유다.
 *
 * <p>법정동 코드는 <b>내보내지 않는다.</b> 화면이 코드 체계에 묶이면 공사가 코드를
 * 개편할 때 양쪽을 다 고쳐야 한다 — 실제로 광주·전남이 통합되면서 코드가 바뀌었고,
 * 집중률 API는 아직 옛 코드를 쓰고 있다. 화면에는 {@code slug}면 충분하다.
 *
 * @param slug         URL과 요청에 쓰는 값. {@code ?region=yeosu}
 * @param name         화면에 쓰는 짧은 이름. "여수"
 * @param province     시도 이름. "전라남도"
 * @param searchText   검색용으로 미리 이어 둔 문자열.
 *                     <b>화면이 이어 붙이지 않게 하려고 서버가 만든다</b> — 무엇으로 검색되는지가
 *                     서버가 정한 규칙이어야, 나중에 별칭("제주도")을 붙일 때 화면을 안 건드린다
 */
public record RegionResponse(String slug, String name, String province, String searchText) {

	public static RegionResponse from(SupportedRegion region) {
		return new RegionResponse(
				region.slug(),
				region.shortName(),
				region.provinceName(),
				searchTextOf(region));
	}

	/**
	 * 무엇을 치면 이 지역이 나오는가.
	 *
	 * <p>짧은 이름("속초")과 시도("강원특별자치도")와 정식 이름("강원특별자치도 속초시")을
	 * 모두 담는다. 사용자가 "강원"이라 쳤을 때 속초·춘천이 나와야 하는데
	 * 짧은 이름에는 그 글자가 없다.
	 *
	 * <p>슬러그도 넣는다 — 영문 자판으로 "yeosu"를 친 사람이 빈 목록을 보지 않게.
	 */
	private static String searchTextOf(SupportedRegion region) {
		return String.join(" ",
				region.shortName(),
				region.displayName(),
				region.provinceName(),
				region.slug());
	}
}
