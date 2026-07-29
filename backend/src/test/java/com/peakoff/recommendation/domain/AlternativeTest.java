package com.peakoff.recommendation.domain;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategory;

class AlternativeTest {

	private static final Place PLACE =
			new Place("mock-1", "오릉", 35.8281, 129.2103, new PlaceCategory("MOCK-TOURIST", "관광지"), null);

	@Test
	@DisplayName("한적도·추천도는 0~100을 벗어날 수 없다")
	void rejectsScoreOutOfRange() {
		assertThatThrownBy(() -> new Alternative(PLACE, 101, 50, "근거"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("한적도");

		assertThatThrownBy(() -> new Alternative(PLACE, 50, -1, "근거"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("추천도");
	}

	@Test
	@DisplayName("근거 없는 대안지는 아예 만들 수 없다 — 추천에는 항상 이유가 붙는다")
	void rejectsAlternativeWithoutReason() {
		assertThatThrownBy(() -> new Alternative(PLACE, 50, 50, "   "))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("추천 근거");
	}
}
