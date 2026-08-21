package com.peakoff;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.peakoff.support.IntegrationTest;
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.mock.MockCongestionProvider;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.place.mock.MockPlaceProvider;
import com.peakoff.recommendation.domain.RecommendationProvider;
import com.peakoff.recommendation.mock.MockRecommendationProvider;

@IntegrationTest
class PeakoffApplicationTests {

	@Autowired
	private PlaceProvider placeProvider;

	@Autowired
	private CongestionProvider congestionProvider;

	@Autowired
	private RecommendationProvider recommendationProvider;

	@Test
	void contextLoads() {
	}

	@Test
	@DisplayName("mock 프로파일에서는 목업 구현이 주입된다 — 실제 API 구현이 생기면 프로파일만 바꾼다")
	void injectsMockImplementations() {
		assertThat(placeProvider).isInstanceOf(MockPlaceProvider.class);
		assertThat(congestionProvider).isInstanceOf(MockCongestionProvider.class);
		assertThat(recommendationProvider).isInstanceOf(MockRecommendationProvider.class);
	}

	@Test
	@DisplayName("검색어 없이 물으면 대표 관광지가 나온다 — 검색 전 빈 화면에 세울 목록")
	void servesRepresentativePlaces() {
		assertThat(placeProvider.representatives(GyeongjuMockCatalog.GYEONGJU, 20))
				.hasSizeGreaterThanOrEqualTo(10);
	}

	@Test
	@DisplayName("이름으로 검색하면 그 지역 안에서 찾는다")
	void searchesByName() {
		assertThat(placeProvider.search(GyeongjuMockCatalog.GYEONGJU, "불국", 10))
				.isNotEmpty()
				.allSatisfy(place -> assertThat(place.name()).contains("불국"));
	}
}
