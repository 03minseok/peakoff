package com.peakoff.place.mock;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Place;

class GyeongjuMockCatalogTest {

	@Test
	@DisplayName("장소 ID는 중복되지 않는다 — 중복되면 교체 대상을 특정할 수 없다")
	void hasUniqueIds() {
		List<String> ids = GyeongjuMockCatalog.places().stream().map(Place::id).toList();

		assertThat(ids).doesNotHaveDuplicates();
	}

	@Test
	@DisplayName("기준 한적도는 모두 0~100 안에 있다")
	void baseQuietnessWithinRange() {
		assertThat(GyeongjuMockCatalog.entries())
				.allSatisfy(entry -> assertThat(entry.baseQuietness())
						.isBetween(Scores.MIN, Scores.MAX));
	}

	@Test
	@DisplayName("좌표는 모두 경주 일대 안에 있다 — 오타로 엉뚱한 곳에 찍히는 것을 막는다")
	void coordinatesWithinGyeongju() {
		assertThat(GyeongjuMockCatalog.places()).allSatisfy(place -> {
			assertThat(place.latitude()).as(place.name() + " 위도").isBetween(35.5, 36.2);
			assertThat(place.longitude()).as(place.name() + " 경도").isBetween(129.0, 129.6);
		});
	}

	/**
	 * 설문의 "여행 스타일" 문항이 분류 코드로 후보를 거른다. 스타일 하나에 해당하는 분류가
	 * 비어 있으면 그 답을 고른 사용자에게 코스를 만들어 줄 수 없다.
	 */
	@Test
	@DisplayName("여섯 가지 분류가 모두 들어 있다 — 스타일마다 고를 후보가 있어야 한다")
	void coversAllCategories() {
		List<String> categoryNames = GyeongjuMockCatalog.places().stream()
				.map(place -> place.category().name())
				.distinct()
				.toList();

		assertThat(categoryNames).containsExactlyInAnyOrder(
				"역사·유적", "자연·풍경", "체험·액티비티", "음식점", "카페", "숙박");
	}

	@Test
	@DisplayName("스타일마다 코스를 채울 만큼의 후보가 있다")
	void everyStyleHasEnoughCandidates() {
		GyeongjuMockCatalog.places().stream()
				.collect(java.util.stream.Collectors.groupingBy(place -> place.category().name()))
				.forEach((categoryName, places) -> assertThat(places)
						.as(categoryName + " 후보 수")
						// 하루 최대 5슬롯을 한 분류로만 채우는 경우는 없지만,
						// 후보가 서너 곳뿐이면 가중 무작위 추출이 사실상 고정 결과를 낸다.
						.hasSizeGreaterThanOrEqualTo(3));
	}

	@Test
	@DisplayName("유명한 곳은 한적도가 낮고, 외곽은 높다 — 목업이 의도한 대비가 살아 있는지 확인")
	void famousPlacesAreLessQuietThanRemoteOnes() {
		int bulguksa = GyeongjuMockCatalog.findById("mock-bulguksa").baseQuietness();
		int hwangnidan = GyeongjuMockCatalog.findById("mock-hwangnidan").baseQuietness();
		int kimyusin = GyeongjuMockCatalog.findById("mock-kimyusin").baseQuietness();
		int yangdong = GyeongjuMockCatalog.findById("mock-yangdong").baseQuietness();

		assertThat(hwangnidan).isLessThan(kimyusin);
		assertThat(bulguksa).isLessThan(yangdong);
	}

	@Test
	@DisplayName("없는 ID를 물으면 null을 돌려준다")
	void returnsNullForUnknownId() {
		assertThat(GyeongjuMockCatalog.findById("존재하지-않음")).isNull();
	}
}
