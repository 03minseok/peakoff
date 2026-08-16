package com.peakoff.place.mock;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategory;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 경주 목업 데이터. <b>공공데이터 API 연동 전까지만 쓰는 임시 데이터다.</b>
 *
 * <p>주의할 점 세 가지:
 * <ul>
 *   <li>분류 코드가 {@code MOCK-*}이다. 실제 신분류 코드를 모르는 상태에서 그럴듯한 코드를 지어내면
 *       나중에 진짜 코드와 섞여도 눈치채지 못한다. 일부러 티나게 뒀다.</li>
 *   <li>좌표는 실제 위치 근사값이다. 지도에 찍었을 때 맞는 동네에 들어가는 수준이며 정밀하지 않다.</li>
 *   <li>한적도는 "유명한 곳일수록 붐빈다"는 상식으로 임의로 매긴 값이다.
 *       실제 집중률 예측 데이터로 반드시 대체해야 한다.</li>
 * </ul>
 */
public final class GyeongjuMockCatalog {

	/** 지원 지역 정의는 {@link SupportedRegion} 한 곳에만 둔다. 코드를 두 번 적으면 언젠가 어긋난다. */
	public static final Region GYEONGJU = SupportedRegion.GYEONGJU.toRegion();

	/*
	 * 관광지를 셋으로 나눠 뒀다(역사·자연·체험). 설문의 "여행 스타일" 문항이 분류 코드로
	 * 후보를 거르는데, 관광지가 한 덩어리면 어떤 스타일을 골라도 같은 후보가 나온다.
	 *
	 * 실제 신분류 코드가 붙으면 어차피 갈리는 축이라 미리 갈라 뒀다. 스타일과 코드의
	 * 짝은 TravelStyle 한 곳에만 적혀 있으므로, 코드가 바뀌면 그 파일만 고치면 된다.
	 */
	static final PlaceCategory HISTORY = new PlaceCategory("MOCK-HISTORY", "역사·유적");
	static final PlaceCategory NATURE = new PlaceCategory("MOCK-NATURE", "자연·풍경");
	static final PlaceCategory ACTIVITY = new PlaceCategory("MOCK-ACTIVITY", "체험·액티비티");
	static final PlaceCategory RESTAURANT = new PlaceCategory("MOCK-RESTAURANT", "음식점");
	static final PlaceCategory CAFE = new PlaceCategory("MOCK-CAFE", "카페");
	static final PlaceCategory STAY = new PlaceCategory("MOCK-STAY", "숙박");

	/**
	 * 장소 하나와 그 장소의 기준 한적도.
	 *
	 * <p>한적도를 {@link Place}에 넣지 않고 여기서 짝지은 이유: 장소는 변하지 않는 사실이고
	 * 한적도는 날짜에 따라 달라지는 예측값이라, 같은 객체에 두면 "언제 기준 한적도인지" 모호해진다.
	 */
	public record Entry(Place place, int baseQuietness) {
	}

	// 한적도: 0~100, 클수록 한적. 아래 값은 실측이 아니라 임시 추정치다.
	private static final List<Entry> ENTRIES = List.of(
			// --- 역사·유적: 경주 대표 명소일수록 낮게 ---
			entry("mock-bulguksa", "불국사", 35.7900, 129.3320, HISTORY, 15),
			entry("mock-daereungwon", "대릉원", 35.8384, 129.2126, HISTORY, 18),
			entry("mock-cheomseongdae", "첨성대", 35.8348, 129.2190, HISTORY, 20),
			entry("mock-donggung", "동궁과 월지", 35.8349, 129.2265, HISTORY, 22),
			entry("mock-seokguram", "석굴암", 35.7951, 129.3490, HISTORY, 25),
			entry("mock-gyochon", "교촌마을", 35.8301, 129.2135, HISTORY, 35),
			entry("mock-museum", "국립경주박물관", 35.8288, 129.2275, HISTORY, 40),

			// --- 역사·유적: 덜 알려졌거나 외곽이라 한적한 곳 ---
			entry("mock-munmudaewang", "문무대왕릉", 35.7223, 129.4779, HISTORY, 62),
			entry("mock-samneung", "경주 남산 삼릉", 35.7896, 129.2247, HISTORY, 66),
			entry("mock-yangdong", "양동마을", 35.9987, 129.2537, HISTORY, 68),
			entry("mock-bunhwangsa", "분황사", 35.8392, 129.2337, HISTORY, 70),
			entry("mock-oreung", "오릉", 35.8281, 129.2103, HISTORY, 72),
			entry("mock-muyeol", "무열왕릉", 35.8424, 129.1932, HISTORY, 74),
			entry("mock-kimyusin", "김유신묘", 35.8478, 129.1941, HISTORY, 78),

			// --- 자연·풍경 ---
			entry("mock-bomunlake", "보문호", 35.8479, 129.2790, NATURE, 45),
			entry("mock-jusangjeolli", "양남 주상절리", 35.6479, 129.4667, NATURE, 58),
			entry("mock-gampo", "감포항", 35.8079, 129.5058, NATURE, 64),
			entry("mock-deokdong", "덕동호", 35.8300, 129.3200, NATURE, 71),
			entry("mock-tohamsan", "토함산 자연휴양림", 35.7727, 129.3363, NATURE, 76),

			// --- 체험·액티비티 ---
			entry("mock-hwangnidan", "황리단길", 35.8360, 129.2100, ACTIVITY, 12),
			entry("mock-gyeongjuworld", "경주월드", 35.8323, 129.2846, ACTIVITY, 30),
			entry("mock-luge", "경주 루지", 35.8395, 129.2836, ACTIVITY, 44),
			entry("mock-donggungwon", "동궁원", 35.8556, 129.2648, ACTIVITY, 52),

			// --- 음식점 ---
			entry("mock-hwangnambbang", "황남빵 본점", 35.8371, 129.2118, RESTAURANT, 16),
			entry("mock-gyorigimbap", "교리김밥 본점", 35.8294, 129.2124, RESTAURANT, 20),
			entry("mock-dosol", "도솔마을 쌈밥", 35.8305, 129.2112, RESTAURANT, 42),
			entry("mock-hamyangjip", "함양집 해장국", 35.8419, 129.2171, RESTAURANT, 55),

			// --- 카페 ---
			entry("mock-cafe-hwangnidan", "황리단길 한옥카페", 35.8355, 129.2094, CAFE, 18),
			entry("mock-cafe-bomun", "보문호 전망카페", 35.8462, 129.2831, CAFE, 48),
			entry("mock-cafe-samneung", "삼릉 솔숲카페", 35.7902, 129.2261, CAFE, 69),

			// --- 숙박 ---
			entry("mock-stay-bomun", "보문단지 호텔", 35.8451, 129.2848, STAY, 50),
			entry("mock-stay-bulguksa", "불국사 인근 호텔", 35.7932, 129.3228, STAY, 60),
			entry("mock-stay-hanok", "교촌 한옥스테이", 35.8298, 129.2141, STAY, 65));

	private static final Map<String, Entry> BY_ID =
			ENTRIES.stream().collect(Collectors.toUnmodifiableMap(e -> e.place().id(), Function.identity()));

	private GyeongjuMockCatalog() {
	}

	private static Entry entry(String id, String name, double latitude, double longitude,
			PlaceCategory category, int baseQuietness) {
		// 이미지 URL은 null. 실제 API 연동 시 채워진다.
		// 존재하지 않는 URL을 넣어두면 화면에 깨진 이미지가 뜨므로 비워 두는 편이 낫다.
		return new Entry(new Place(id, name, latitude, longitude, category, null), baseQuietness);
	}

	public static List<Entry> entries() {
		return ENTRIES;
	}

	public static List<Place> places() {
		return ENTRIES.stream().map(Entry::place).toList();
	}

	public static Entry findById(String placeId) {
		return BY_ID.get(placeId);
	}
}
