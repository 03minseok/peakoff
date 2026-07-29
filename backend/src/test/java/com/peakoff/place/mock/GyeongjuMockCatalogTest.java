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

	@Test
	@DisplayName("네 가지 분류가 모두 들어 있다")
	void coversAllCategories() {
		List<String> categoryNames = GyeongjuMockCatalog.places().stream()
				.map(place -> place.category().name())
				.distinct()
				.toList();

		assertThat(categoryNames).containsExactlyInAnyOrder("관광지", "음식점", "카페", "숙박");
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
