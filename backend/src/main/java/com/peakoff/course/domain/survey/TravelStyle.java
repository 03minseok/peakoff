package com.peakoff.course.domain.survey;

import java.util.Arrays;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;

import com.peakoff.place.domain.PlaceCategory;

/**
 * 설문 1번 — 여행 스타일 (복수 선택).
 *
 * <p><b>스타일과 분류 코드의 짝이 이 파일 한 곳에만 있다.</b> 실제 신분류 코드가 붙으면
 * 아래 코드 문자열만 갈아끼우면 되고, 후보를 거르는 로직은 손대지 않는다.
 *
 * <p>프론트는 {@code HISTORY} 같은 이름만 보내고 어떤 분류 코드에 매핑되는지 모른다.
 * 분류 체계가 바뀔 때 화면을 고치지 않기 위해서다.
 *
 * <p><b>숙박(MOCK-STAY)은 어떤 스타일에도 붙지 않는다.</b> 코스 슬롯은 "그 날 어디를 가는가"이지
 * "어디서 자는가"가 아니다. 매핑에서 빠지면 자연히 슬롯 후보에서 제외된다.
 */
public enum TravelStyle {

	HISTORY("역사·유적", Set.of("MOCK-HISTORY")),
	NATURE("자연·풍경", Set.of("MOCK-NATURE")),
	/** 맛집과 카페를 한 답으로 묶었다. 설문에서 둘을 갈라 물으면 문항이 길어진다. */
	FOOD("맛집·카페", Set.of("MOCK-RESTAURANT", "MOCK-CAFE")),
	ACTIVITY("체험·액티비티", Set.of("MOCK-ACTIVITY"));

	private final String label;
	private final Set<String> categoryCodes;

	TravelStyle(String label, Set<String> categoryCodes) {
		this.label = label;
		this.categoryCodes = categoryCodes;
	}

	public boolean matches(PlaceCategory category) {
		return categoryCodes.contains(category.code());
	}

	/** 고른 스타일 중 하나라도 이 분류를 포함하는지. 후보를 거르는 데 쓴다. */
	public static boolean anyMatches(Collection<TravelStyle> styles, PlaceCategory category) {
		return styles.stream().anyMatch(style -> style.matches(category));
	}

	/**
	 * 이 분류가 어느 스타일에 속하는지. <b>추천 근거 문구를 만드는 데 쓴다.</b>
	 *
	 * <p>"역사·유적 선호"라고 말하려면 그 장소가 실제로 역사·유적이어서 뽑혔다는 것을
	 * 확인해야 한다. 사용자가 고른 스타일을 그대로 갖다 붙이면, 맛집 때문에 뽑힌 곳에
	 * "역사·유적 선호"라고 적히는 일이 생긴다.
	 */
	public static Optional<TravelStyle> of(PlaceCategory category) {
		return Arrays.stream(values())
				.filter(style -> style.matches(category))
				.findFirst();
	}

	/** 화면과 근거 문구에 쓰는 이름 (예: "역사·유적") */
	public String label() {
		return label;
	}
}
