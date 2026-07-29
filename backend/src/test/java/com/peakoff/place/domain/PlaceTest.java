package com.peakoff.place.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class PlaceTest {

	private static final PlaceCategory CATEGORY = new PlaceCategory("AC01", "자연관광지");

	@Test
	@DisplayName("외부 데이터의 앞뒤 공백은 도메인에 들어올 때 정리된다")
	void trimsWhitespaceFromExternalData() {
		Place place = new Place("126508", "  협재해수욕장  ", 33.3948, 126.2396, CATEGORY, null);

		assertThat(place.name()).isEqualTo("협재해수욕장");
	}

	@Test
	@DisplayName("이미지가 없는 관광지는 정상이며, 공백 문자열도 없는 것으로 통일된다")
	void treatsBlankImageUrlAsAbsent() {
		Place withBlank = new Place("1", "이름", 33.0, 126.0, CATEGORY, "   ");
		Place withNull = new Place("1", "이름", 33.0, 126.0, CATEGORY, null);

		assertThat(withBlank.imageUrl()).isNull();
		assertThat(withBlank.hasImage()).isFalse();
		assertThat(withNull.hasImage()).isFalse();
	}

	@Nested
	@DisplayName("생성 자체를 막는 경우")
	class Rejects {

		@Test
		@DisplayName("좌표가 범위를 벗어나면 지도에 엉뚱하게 찍히므로 생성 시점에 막는다")
		void outOfRangeCoordinate() {
			assertThatThrownBy(() -> new Place("1", "이름", 999.0, 126.0, CATEGORY, null))
					.isInstanceOf(IllegalArgumentException.class)
					.hasMessageContaining("위도");
		}

		@Test
		@DisplayName("관광지명이 비어 있으면 화면에 그릴 수 없다")
		void blankName() {
			assertThatThrownBy(() -> new Place("1", "   ", 33.0, 126.0, CATEGORY, null))
					.isInstanceOf(IllegalArgumentException.class);
		}

		@Test
		@DisplayName("법정동 코드는 비어 있을 수 없다")
		void blankLegalDongCode() {
			assertThatThrownBy(() -> new Region("  ", "제주시"))
					.isInstanceOf(IllegalArgumentException.class)
					.hasMessageContaining("법정동 코드");
		}
	}
}
