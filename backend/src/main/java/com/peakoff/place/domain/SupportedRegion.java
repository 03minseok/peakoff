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
 * <h3>어떤 기준으로 골랐나 (2026-08-31)</h3>
 * 전국 64개 시군구 · 관측 87,150건을 재서 <b>혼잡 3단계가 고르게 갈리는 곳</b>만 넣었다
 * ({@code analysis/national/RESULTS.md}). 한쪽으로 쏠린 지역은 배지가 신호 노릇을 못 한다 —
 * 실제로 강릉은 한적이 60.4%, 통영 58.0%, 남해 61.9%라 "어디나 한적하다"가 되고,
 * 반대로 부산 해운대구는 가장 적은 배지가 6.7%라 셋 중 하나가 죽는다.
 *
 * <p>조건 셋을 모두 통과한 곳만 넣는다.
 * <ul>
 *   <li><b>세 배지가 고르게</b> — 가장 적은 배지가 20% 이상</li>
 *   <li><b>후보 풀이 넉넉하게</b> — 집중률 예측이 있는 관광지 40곳 이상.
 *       대안 추천이 {@code MIN_QUIETNESS_GAIN}·{@code MAX_DISTANCE_KM}를 통과한 후보만
 *       쓰므로, 원본이 얇으면 목록이 자주 빈다</li>
 *   <li><b>자치구로 쪼개지지 않은 단일 시군구</b> — 공사가 자치구 있는 시를 구 단위로만
 *       답해서(수원 장안구 {@code 41111}), 시를 통째로 담으려면 제주처럼 여러 번 불러
 *       합쳐야 한다. "부산 여행"이 아니라 "해운대구 여행"이 되는 것도 코스 단위로 어색하다</li>
 * </ul>
 *
 * <pre>
 *                집중률   한적/보통/붐빔(65:35)   최소 배지
 * 경주시            69     42.1 / 33.4 / 24.5      24.5%
 * 제주시           244     18.2 / 47.9 / 33.9      18.2%
 * 서귀포시         204     21.9 / 47.6 / 30.5      21.9%
 * 여수시            97     46.9 / 30.8 / 22.3      22.3%   ← 2026-08-31 추가
 * 속초시            50     38.1 / 38.6 / 23.3      23.3%   ←
 * 태안군            97     50.0 / 28.5 / 21.5      21.5%   ←
 * 춘천시            60     45.9 / 32.1 / 22.0      22.0%   ←
 * </pre>
 *
 * <p>⚠️ <b>제주시가 조건(20%)에 못 미치는데 남아 있다.</b> 파일럿부터 있던 지역이고
 * 자료가 가장 많아 빼지 않았다 — 조건은 <b>새로 넣을 곳을 거르는 자</b>이지
 * 이미 있는 곳을 쫓아내는 자가 아니다.
 *
 * <p>지역을 늘릴 때 여기에 한 줄 추가하면 된다. <b>화면은 {@code GET /api/regions}로
 * 이 목록을 받아 가므로 프론트를 함께 고칠 필요가 없다</b> — 예전에는
 * {@code constants/regions.ts}가 이 enum을 복사하고 있어서 한쪽만 고치면
 * 화면에는 보이는데 서버가 거절하는 상태가 됐다.
 */
public enum SupportedRegion {

	GYEONGJU("gyeongju", "4713000000", "경상북도 경주시", "경주"),
	JEJU("jeju", "5011000000", "제주특별자치도 제주시", "제주시"),
	SEOGWIPO("seogwipo", "5013000000", "제주특별자치도 서귀포시", "서귀포시"),
	/*
	 * ⚠️ 여수만 코드가 둘이다. 광주·전남이 전남광주통합특별시로 합쳐지며 46 → 12가 됐는데
	 * 국문 관광정보만 옮겨갔다. 하나로 두면 절반이 빈다 — 그것도 오류가 아니라
	 * totalCount=0이라 "여수에 관광지가 없다"로 조용히 읽힌다. Region 주석 참고.
	 */
	YEOSU("yeosu", "4613000000", "1213000000", "전라남도 여수시", "여수"),
	SOKCHO("sokcho", "5121000000", "강원특별자치도 속초시", "속초"),
	TAEAN("taean", "4482500000", "충청남도 태안군", "태안"),
	CHUNCHEON("chuncheon", "5111000000", "강원특별자치도 춘천시", "춘천");

	private final String slug;
	private final String legalDongCode;
	private final String tourLegalDongCode;
	private final String displayName;
	private final String shortName;

	/** 두 API가 같은 코드를 쓰는 지역. 대부분이 이쪽이다. */
	SupportedRegion(String slug, String legalDongCode, String displayName, String shortName) {
		this(slug, legalDongCode, legalDongCode, displayName, shortName);
	}

	SupportedRegion(String slug, String legalDongCode, String tourLegalDongCode,
			String displayName, String shortName) {
		this.slug = slug;
		this.legalDongCode = legalDongCode;
		this.tourLegalDongCode = tourLegalDongCode;
		this.displayName = displayName;
		this.shortName = shortName;
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

	/**
	 * 화면이 쓰는 짧은 이름. "전라남도 여수시"가 아니라 "여수"다.
	 *
	 * <p>제주만 "제주시"·"서귀포시"로 <b>시를 붙여 둔다.</b> 둘 다 제주도라서
	 * "제주"와 "서귀포"로 적으면 앞엣것이 섬 전체처럼 읽히고, 실제로는 시군구 하나라
	 * 한라산과 성산일출봉을 한 코스에 못 담는다는 사실이 이름에서 사라진다.
	 *
	 * <p>⚠️ 이 이름을 화면에 박아두지 않는다. 예전에는 {@code constants/regions.ts}가
	 * 같은 문자열을 들고 있어서, 표기를 바꾸면 서버와 화면이 갈렸다.
	 */
	public String shortName() {
		return shortName;
	}

	/**
	 * 시도 이름. "전라남도 여수시" → "전라남도".
	 *
	 * <p>검색을 위해 내려보낸다 — 사용자가 "강원"이라 치면 속초와 춘천이 나와야 하는데,
	 * 짧은 이름("속초")에는 그 글자가 없다. 화면에서는 보조 설명으로도 쓴다.
	 */
	public String provinceName() {
		int space = displayName.indexOf(' ');
		return space < 0 ? displayName : displayName.substring(0, space);
	}

	public Region toRegion() {
		return new Region(legalDongCode, tourLegalDongCode, displayName);
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
