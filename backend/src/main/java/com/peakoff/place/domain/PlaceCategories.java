package com.peakoff.place.domain;

import java.util.Map;

/**
 * 공사 <b>신분류 코드</b>의 대분류를 화면에 쓸 이름으로 옮긴다.
 *
 * <p>구 서비스 분류코드({@code cat1/cat2/cat3})는 26년 폐기 예정이라 쓰지 않는다.
 * 실제로 최근 등록분은 구 코드 자리가 비어 있고 신분류만 채워져 온다.
 *
 * <h3>이름을 우리가 정하는 이유</h3>
 * 응답에는 코드({@code HS})만 오고 한글 이름이 딸려오지 않는다. 화면에 코드를 그대로
 * 띄울 수는 없으니 어딘가에서 이름을 붙여야 하는데, 그 자리를 한 곳으로 모은다.
 *
 * <p>⚠️ <b>아래 이름은 실제 데이터를 보고 붙인 것이지 공사가 정한 명칭이 아니다.</b>
 * 경주 621건의 분포를 보고 지었다. 공식 명칭이 확인되면 여기만 고치면 된다.
 *
 * @see #labelOf(String)
 */
public final class PlaceCategories {

	/**
	 * 대분류 코드 → 화면 이름. 경주 실측 분포(2026-08-22)를 괄호에 적어 둔다.
	 *
	 * <p>{@code VE}가 가장 애매하다 — 워터파크·리조트·금리단길·동궁원이 한데 묶여 있어
	 * 하나의 성격으로 부르기 어렵다. 그래서 설문 스타일 매핑에서는 빼 두었다
	 * ({@code TravelStyle} 참고). 잘못 넣으면 "역사를 좋아한다"고 답한 사람에게
	 * 워터파크가 나온다.
	 */
	private static final Map<String, String> LABELS = Map.ofEntries(
			Map.entry("HS", "역사·유적"),     // 109건 — 왕릉·사지·유적
			Map.entry("NA", "자연·풍경"),     // 41건 — 항구·숲·정원
			Map.entry("VE", "문화·명소"),     // 75건 — 성격이 섞여 있다
			Map.entry("LS", "레저·스포츠"),   // 11건 — 루지·사격장·골프
			Map.entry("EX", "체험"),          // 13건 — 체험관·공방
			Map.entry("SH", "쇼핑"),          // 31건 — 시장·상점
			Map.entry("FD", "음식점"),        // 211건 — 가장 많다
			Map.entry("AC", "숙박"),          // 121건
			Map.entry("EV", "축제·행사"),     // 8건 — 기간이 정해져 있다
			Map.entry("C01", "여행코스"));    // 1건

	/** 코드를 못 알아볼 때 쓰는 이름. 빈 이름으로 두면 화면 곳곳이 빈자리가 된다. */
	private static final String UNKNOWN = "기타";

	private PlaceCategories() {
	}

	/**
	 * 분류를 만든다. 코드가 비어 있으면 {@code null}을 돌려준다 —
	 * 분류를 모르는 장소는 후보에서 걸러야지, "기타"라는 분류를 가진 것처럼 다루면
	 * 스타일 필터가 조용히 통과시킨다.
	 */
	public static PlaceCategory of(String largeCode) {
		if (largeCode == null || largeCode.isBlank()) {
			return null;
		}
		return new PlaceCategory(largeCode, labelOf(largeCode));
	}

	public static String labelOf(String largeCode) {
		return LABELS.getOrDefault(largeCode, UNKNOWN);
	}
}
