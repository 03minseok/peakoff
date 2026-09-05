package com.peakoff.chat.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.PlaceCategories;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 관심사가 무엇을 여는 문인지 잠근다.
 *
 * <p>특히 <b>바다</b>가 중요하다. 대분류만 보면 산·숲이 함께 열려,
 * "사람 적은 바다 여행지"를 물었는데 내륙이 올라온다.
 */
class InterestTest {

	@Test
	@DisplayName("바다는 중분류까지 본다 — 해변은 열리고 산은 안 열린다")
	void waterLooksAtSubCode() {
		assertThat(Interest.WATER.matches(PlaceCategories.of("NA", "NA02"))).isTrue();   // 나아해변
		assertThat(Interest.WATER.matches(PlaceCategories.of("NA", "NA01"))).isFalse();  // 경주 남산
		assertThat(Interest.WATER.matches(PlaceCategories.of("NA", "NA04"))).isFalse();  // 국립공원
	}

	@Test
	@DisplayName("자연은 넓은 문이다 — 해변도 산도 함께 열린다")
	void natureIsTheWideDoor() {
		assertThat(Interest.NATURE.matches(PlaceCategories.of("NA", "NA02"))).isTrue();
		assertThat(Interest.NATURE.matches(PlaceCategories.of("NA", "NA01"))).isTrue();
		assertThat(Interest.NATURE.matches(PlaceCategories.of("HS", "HS01"))).isFalse();
	}

	@Test
	@DisplayName("중분류를 모르는 장소도 넓은 문은 통과한다 — 옛 데이터에 중분류가 없다")
	void wideDoorIgnoresMissingSubCode() {
		assertThat(Interest.FOOD.matches(PlaceCategories.of("FD"))).isTrue();
		assertThat(Interest.WATER.matches(PlaceCategories.of("NA"))).isFalse();
	}

	@Test
	@DisplayName("관심사 없음은 아무것도 거르지 않는다")
	void noneFiltersNothing() {
		assertThat(Interest.NONE.filtersRegions()).isFalse();
		assertThat(Interest.NONE.matches(PlaceCategories.of("FD"))).isFalse();
		assertThat(Interest.FOOD.filtersRegions()).isTrue();
	}

	/**
	 * LLM은 목록에 없는 값을 지어낼 수 있다. 그때 오류를 던지면 화면이 죽는다 —
	 * 관심사를 못 읽어도 "이번 주 한적한 곳"은 여전히 답할 수 있다.
	 */
	@Test
	@DisplayName("모르는 이름은 관심사 없음으로 흘린다 — 예외가 아니다")
	void unknownFallsBackToNone() {
		assertThat(Interest.of("감성카페투어")).isEqualTo(Interest.NONE);
		assertThat(Interest.of(null)).isEqualTo(Interest.NONE);
		assertThat(Interest.of("  ")).isEqualTo(Interest.NONE);
		assertThat(Interest.of("food")).isEqualTo(Interest.FOOD);
	}

	@Test
	@DisplayName("프롬프트 목록은 enum에서 만든다 — 코드와 프롬프트가 갈라지지 않게")
	void promptOptionsComeFromTheEnum() {
		String options = Interest.promptOptions();

		assertThat(options).contains("FOOD(음식)").contains("WATER(바다)");
		assertThat(options).doesNotContain("NONE");
	}
}
