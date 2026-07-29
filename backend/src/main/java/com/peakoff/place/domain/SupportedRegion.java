package com.peakoff.place.domain;

import java.util.Arrays;

/**
 * 서비스가 지원하는 지역.
 *
 * <p>v1은 경주 한 곳이다. URL에는 {@code ?region=gyeongju}처럼 읽기 쉬운 값을 쓰고,
 * 내부에서는 법정동 코드로 바꿔 쓴다. 법정동 코드를 URL에 그대로 노출하면
 * 프론트가 코드 체계에 묶여, 나중에 코드가 바뀔 때 양쪽을 다 고쳐야 한다.
 *
 * <p>지역을 늘릴 때 여기에 한 줄 추가하면 된다.
 */
public enum SupportedRegion {

	GYEONGJU("gyeongju", "4713000000", "경상북도 경주시");

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
}
