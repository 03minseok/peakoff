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
 * <h3>어떤 기준으로 골랐나 (2026-09-03에 첫째 조건을 바꿨다)</h3>
 * 조건 셋을 모두 통과한 곳만 넣는다.
 * <ul>
 *   <li><b>진단이 할 일이 있게</b> — 무작위 6칸 코스에서 <b>붐빔이 한 칸 이상</b> 나올 확률
 *       35% 이상. 고칠 자리가 없으면 진단·교체가 그 지역에서 아무 일도 하지 않는다</li>
 *   <li><b>후보 풀이 넉넉하게</b> — 집중률 예측이 있는 관광지 40곳 이상.
 *       대안 추천이 {@code MIN_QUIETNESS_GAIN}·{@code MAX_DISTANCE_KM}를 통과한 후보만
 *       쓰므로, 원본이 얇으면 목록이 자주 빈다</li>
 *   <li><b>자치구로 쪼개지지 않은 단일 시군구</b> — 공사가 자치구 있는 시를 구 단위로만
 *       답해서(수원 장안구 {@code 41111}), 시를 통째로 담으려면 제주처럼 여러 번 불러
 *       합쳐야 한다. "부산 여행"이 아니라 "해운대구 여행"이 되는 것도 코스 단위로 어색하다</li>
 * </ul>
 *
 * <h3>⚠️ 첫째 조건이 예전에는 "가장 적은 배지 20% 이상"이었다</h3>
 * 그 자로는 충북·경남이 통째로 떨어졌다. 한적 배지가 절반을 넘어서인데,
 * <b>그 지역이 실제로 한산해서이지 자료가 나빠서가 아니다</b> — 그리고 한산한 곳으로
 * 사람을 보내는 것이 이 서비스가 하려는 일이라, 그 이유로 빼는 것은 앞뒤가 맞지 않는다.
 *
 * <p>재보니 자가 틀렸다. 배지 비율은 <b>(장소 × 날짜) 관측 전체</b>의 분포인데
 * 사용자가 보는 것은 <b>6칸짜리 코스 하나</b>다. 붐빔이 10.5%뿐인 하동도 6칸이면 32%가 된다.
 * 지역마다 무작위 코스 2,000개를 뽑아 보니 떨어졌던 곳들이 통과한 곳과 구분되지 않았다:
 *
 * <pre>
 *                    붐빔 1칸↑   고칠자리 1칸↑   두 배지↑
 * 경주 (지원중)        47.4%       95.9%        91.4%
 * 양평 (옛 조건 통과)   37.0%       83.4%        80.5%
 * 충주 (옛 조건 탈락)   52.5%       90.8%        89.8%   ← 경주와 같은 자리
 * 통영 (옛 조건 탈락)   40.8%       81.1%        79.7%
 * 하동 (옛 조건 탈락)   32.1%       78.8%        78.5%   ← 새 조건에서도 탈락
 * </pre>
 *
 * 그래서 대리 지표(배지 비율)를 버리고 <b>지키려던 것을 직접 재는 자</b>로 바꿨다.
 * 근거는 {@code analysis/region-candidates/RESULTS.md}에 있다.
 *
 * <h3>지역이 열하나가 되어도 혼잡 경계는 그대로다 (65/35)</h3>
 * 경계는 2026-08-31에 <b>전국 64개 시군구</b>로 잡았다. 그때 서비스 지역은 셋뿐이라
 * 전국을 대신 봐야 했고, 그 셋에는 22.8 / 45.8 / 31.3으로 치우쳐 있었다.
 *
 * <p>넷을 더해 <b>서비스 지역 전체(관광지 1,091곳 · 관측 32,730건)</b>로 다시 재보니
 * 같은 경계가 <b>35.9 / 37.3 / 26.8</b>로 선다 — 세 배지가 모두 살아 있고 45%를 넘지 않는다.
 * 격자로 훑어 가장 나은 값(64/37)을 찾아도 가장 불리한 지역이 17.3% → 18.6%로 1.3%p 나아질 뿐이라,
 * 화면·{@code CrowdSensitivity}·문서가 함께 걸린 값을 옮길 이유가 없다.
 * <b>경계를 맞춘 것은 값을 고쳐서가 아니라 지역을 늘려서다.</b>
 *
 * <p>⚠️ 분위수로 다시 잡는 방법(1·3분위 = 71/33)은 <b>쓰지 않았다.</b> 전체로는 25/50/25로
 * 깔끔해 보이지만 <b>보통이 50%</b>라 그 배지가 기본값이 되고, 제주시의 한적이 9.6%로 죽는다.
 *
 * <pre>
 *                집중률   한적/보통/붐빔(65:35)   붐빔 1칸↑
 * 경주시            69     40.0 / 32.9 / 27.1      47.4%
 * 제주시           244     17.3 / 47.9 / 34.8      88.7%
 * 서귀포시         204     21.1 / 47.7 / 31.3      88.2%
 * 여수시            97     45.0 / 31.7 / 23.3      62.4%
 * 속초시            50     36.7 / 38.4 / 24.9      42.9%
 * 태안군            97     47.6 / 29.7 / 22.7      44.6%
 * 춘천시            60     44.4 / 32.9 / 22.7      56.5%
 * 가평군            68     51.7 / 30.7 / 17.6      38.1%   ← 2026-09-03 추가
 * 충주시            50     49.0 / 31.1 / 19.9      52.5%   ←
 * 통영시            94     55.6 / 24.4 / 19.9      40.8%   ←
 * 남원시            58     54.8 / 21.6 / 23.6      43.6%   ←
 * </pre>
 *
 * <p>시도마다 하나씩이다 — 강원(속초·춘천)과 제주(제주시·서귀포)만 둘이고,
 * 광주·전남은 공사 분류에서 {@code 12} 전남광주통합특별시로 합쳐져 있어 여수가 그 자리를 겸한다.
 * <b>부산·대구·인천·대전·울산·세종은 아직 없다</b> — 자치구로만 쪼개졌거나(대전),
 * 예측 대상이 모자라거나(부산 기장군 39곳), 카탈로그가 비어 있다(세종 0건).
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
	CHUNCHEON("chuncheon", "5111000000", "강원특별자치도 춘천시", "춘천"),
	GAPYEONG("gapyeong", "4182000000", "경기도 가평군", "가평"),
	CHUNGJU("chungju", "4313000000", "충청북도 충주시", "충주"),
	TONGYEONG("tongyeong", "4822000000", "경상남도 통영시", "통영"),
	NAMWON("namwon", "5219000000", "전북특별자치도 남원시", "남원");

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
