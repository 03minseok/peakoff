package com.peakoff.place.domain;

import java.util.Arrays;
import java.util.List;

/**
 * 서비스가 지원하는 지역.
 *
 * <p>URL에는 {@code ?region=gyeongju}처럼 읽기 쉬운 값을 쓰고, 내부에서는 법정동 코드로
 * 바꿔 쓴다. 법정동 코드를 URL에 그대로 노출하면 프론트가 코드 체계에 묶여,
 * 나중에 코드가 바뀔 때 양쪽을 다 고쳐야 한다.
 *
 * <h3>왜 "제주"가 아니라 제주시·서귀포시인가</h3>
 * 공사 API가 <b>시군구 하나를 받는다</b>({@code signguCd}). 제주도는 시군구가 둘이라
 * 한 지역으로 묶으려면 클라이언트 넷이 전부 여러 번 호출해 합쳐야 한다.
 * 지금은 시군구를 그대로 지역으로 둔다 — 공사가 자료를 나눠 주는 단위와 같아야
 * 이름 매칭·캐시·집중률 조회가 전부 한 덩어리로 맞아떨어진다.
 *
 * <p>⚠️ 대신 <b>한라산(제주시)과 성산일출봉(서귀포시)을 한 코스에 담을 수 없다.</b>
 * 제주를 하나로 합칠지는 {@code docs/OPEN_DECISIONS.md}에 남겨 두었다.
 *
 * <h3>실측 자료량 (2026-08-24)</h3>
 * <pre>
 * 경주시     집중률  69곳   관광정보  621곳   연관 기준  52곳
 * 제주시     집중률 244곳   관광정보 1271곳   연관 기준 162곳
 * 서귀포시   집중률 204곳   관광정보  876곳   연관 기준 135곳
 * </pre>
 *
 * <p>지역을 늘릴 때 여기에 한 줄 추가하면 된다. <b>화면의 {@code constants/regions.ts}도
 * 함께 고쳐야 한다</b> — 한쪽만 고치면 화면에는 보이는데 서버가 거절한다.
 */
public enum SupportedRegion {

	GYEONGJU("gyeongju", "4713000000", "경상북도 경주시"),
	JEJU("jeju", "5011000000", "제주특별자치도 제주시"),
	SEOGWIPO("seogwipo", "5013000000", "제주특별자치도 서귀포시");

	private final String slug;
	private final String legalDongCode;
	private final String displayName;

	SupportedRegion(String slug, String legalDongCode, String displayName) {
		this.slug = slug;
		this.legalDongCode = legalDongCode;
		this.displayName = displayName;
	}

	public static SupportedRegion fromSlug(String slug) {
		return Arrays.stream(values())
				.filter(region -> region.slug.equalsIgnoreCase(slug))
				.findFirst()
				.orElseThrow(() -> new IllegalArgumentException(
						"지원하지 않는 지역입니다: %s (지원 지역: %s)".formatted(slug, supportedSlugs())));
	}

	private static String supportedSlugs() {
		return Arrays.stream(values()).map(region -> region.slug).reduce((a, b) -> a + ", " + b).orElse("");
	}

	public String slug() {
		return slug;
	}

	public String displayName() {
		return displayName;
	}

	public Region toRegion() {
		return new Region(legalDongCode, displayName);
	}

	/**
	 * 모든 지원 지역을 {@link Region}으로.
	 *
	 * <p>장소 ID만으로는 어느 지역인지 알 수 없어서, 공급자들이 <b>지역을 하나씩 훑어</b>
	 * 그 장소가 든 지역을 찾는다. 지역 목록을 각자 만들면 새 지역을 넣을 때
	 * 한 군데가 빠진다.
	 */
	public static List<Region> allRegions() {
		return Arrays.stream(values()).map(SupportedRegion::toRegion).toList();
	}
}
