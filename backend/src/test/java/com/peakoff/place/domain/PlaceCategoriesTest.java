package com.peakoff.place.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 분류 호환 규칙을 잠근다.
 *
 * <p>이 규칙이 느슨해지면 <b>역사 유적 자리에 워터파크</b>가, 조여지면 <b>유적 자리에 박물관</b>이
 * 사라진다. 둘 다 화면만 봐서는 "추천이 좀 이상하네" 정도로 보이고 원인을 찾기 어렵다.
 *
 * <p>아래 분류 코드와 예시는 3개 지역 2,768곳 실측에서 왔다(2026-08-25).
 */
class PlaceCategoriesTest {

	/** 국립경주박물관·김영갑갤러리 */
	private static final PlaceCategory MUSEUM = PlaceCategories.of("VE", "VE07");
	/** 양남 주상절리 전망대·거린사슴전망대 */
	private static final PlaceCategory VIEWPOINT = PlaceCategories.of("VE", "VE01");
	/** 사라봉공원·노리매공원 */
	private static final PlaceCategory PARK = PlaceCategories.of("VE", "VE03");
	/** 강동 워터파크·메이즈랜드 */
	private static final PlaceCategory THEME_PARK = PlaceCategories.of("VE", "VE02");
	/** 마우나오션 리조트·보문관광단지 */
	private static final PlaceCategory RESORT = PlaceCategories.of("VE", "VE05");
	/** 경주중앙도서관 */
	private static final PlaceCategory LIBRARY = PlaceCategories.of("VE", "VE09");

	private static final PlaceCategory HISTORY = PlaceCategories.of("HS", "HS01");
	private static final PlaceCategory NATURE = PlaceCategories.of("NA", "NA01");
	private static final PlaceCategory FOOD = PlaceCategories.of("FD", "FD01");
	private static final PlaceCategory STAY = PlaceCategories.of("AC", "AC01");

	@Nested
	@DisplayName("대분류가 달라도 성격이 맞으면 대신할 수 있다")
	class Widened {

		@Test
		void 역사_유적과_박물관은_서로_대신한다() {
			assertThat(PlaceCategories.compatible(HISTORY, MUSEUM)).isTrue();
			assertThat(PlaceCategories.compatible(MUSEUM, HISTORY)).isTrue();
		}

		@Test
		void 자연_풍경과_전망대_공원은_서로_대신한다() {
			assertThat(PlaceCategories.compatible(NATURE, VIEWPOINT)).isTrue();
			assertThat(PlaceCategories.compatible(VIEWPOINT, NATURE)).isTrue();
			assertThat(PlaceCategories.compatible(NATURE, PARK)).isTrue();
			assertThat(PlaceCategories.compatible(PARK, NATURE)).isTrue();
		}

		/**
		 * 한쪽만 열어 두면 같은 두 장소가 어느 쪽을 누르느냐에 따라 다른 답을 준다.
		 * 사용자는 그 차이를 설명받을 길이 없다.
		 */
		@Test
		void 열어_준_길은_반드시_양방향이다() {
			assertThat(PlaceCategories.compatible(HISTORY, MUSEUM))
					.isEqualTo(PlaceCategories.compatible(MUSEUM, HISTORY));
			assertThat(PlaceCategories.compatible(NATURE, VIEWPOINT))
					.isEqualTo(PlaceCategories.compatible(VIEWPOINT, NATURE));
			assertThat(PlaceCategories.compatible(HISTORY, THEME_PARK))
					.isEqualTo(PlaceCategories.compatible(THEME_PARK, HISTORY));
		}
	}

	@Nested
	@DisplayName("성격이 다르면 같은 대분류라도 막는다")
	class Narrowed {

		/** 리조트가 관광지 자리를 대신하면, 불국사를 바꾸려는 사람에게 보문관광단지가 나온다. */
		@Test
		void 리조트는_어느_자리도_대신하지_못한다() {
			assertThat(PlaceCategories.compatible(MUSEUM, RESORT)).isFalse();
			assertThat(PlaceCategories.compatible(HISTORY, RESORT)).isFalse();
			assertThat(PlaceCategories.compatible(THEME_PARK, RESORT)).isFalse();
		}

		@Test
		void 도서관도_관광_대상이_아니다() {
			assertThat(PlaceCategories.compatible(MUSEUM, LIBRARY)).isFalse();
		}

		/** 워터파크가 유적을 대신하면 여행의 성격이 통째로 달라진다. */
		@Test
		void 테마파크는_역사나_자연을_대신하지_못한다() {
			assertThat(PlaceCategories.compatible(HISTORY, THEME_PARK)).isFalse();
			assertThat(PlaceCategories.compatible(NATURE, THEME_PARK)).isFalse();
		}

		@Test
		void 박물관은_자연을_대신하지_못한다() {
			assertThat(PlaceCategories.compatible(NATURE, MUSEUM)).isFalse();
			assertThat(PlaceCategories.compatible(MUSEUM, NATURE)).isFalse();
		}

		@Test
		void 음식점_자리에_숙박을_넣지_않는다() {
			assertThat(PlaceCategories.compatible(FOOD, STAY)).isFalse();
			assertThat(PlaceCategories.compatible(FOOD, FOOD)).isTrue();
		}
	}

	@Nested
	@DisplayName("VE 안에서는 관광 대상끼리 통한다")
	class WithinCulture {

		@Test
		void 박물관과_테마파크는_서로_대신할_수_있다() {
			assertThat(PlaceCategories.compatible(MUSEUM, THEME_PARK)).isTrue();
			assertThat(PlaceCategories.compatible(THEME_PARK, MUSEUM)).isTrue();
		}
	}

	@Nested
	@DisplayName("중분류를 모를 때")
	class WithoutSubCode {

		/**
		 * 목업 카탈로그에는 중분류가 없다. 모르는 것을 "아니다"로 단정하면
		 * 후보가 통째로 사라진다.
		 */
		@Test
		void 대분류만으로_판단한다() {
			PlaceCategory unknown = PlaceCategories.of("VE");
			PlaceCategory otherUnknown = PlaceCategories.of("VE");

			assertThat(PlaceCategories.compatible(unknown, otherUnknown)).isTrue();
			assertThat(PlaceCategories.compatible(unknown, HISTORY)).isFalse();
		}

		@Test
		void 빈_중분류는_없는_것과_같다() {
			assertThat(PlaceCategories.of("VE", "").subCode()).isNull();
			assertThat(PlaceCategories.of("VE", "  ").subCode()).isNull();
		}
	}

	@Test
	@DisplayName("분류를 모르는 장소는 어느 쪽도 될 수 없다")
	void nullIsNeverCompatible() {
		assertThat(PlaceCategories.compatible(null, MUSEUM)).isFalse();
		assertThat(PlaceCategories.compatible(MUSEUM, null)).isFalse();
	}
}
