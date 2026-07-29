package com.peakoff;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.peakoff.congestion.domain.QuietnessProvider;
import com.peakoff.congestion.mock.MockQuietnessProvider;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.mock.MockPlaceProvider;

@SpringBootTest
class PeakoffApplicationTests {

	@Autowired
	private PlaceProvider placeProvider;

	@Autowired
	private QuietnessProvider quietnessProvider;

	@Test
	void contextLoads() {
	}

	@Test
	@DisplayName("mock 프로파일에서는 목업 구현이 주입된다 — 실제 API 구현이 생기면 프로파일만 바꾼다")
	void injectsMockImplementations() {
		assertThat(placeProvider).isInstanceOf(MockPlaceProvider.class);
		assertThat(quietnessProvider).isInstanceOf(MockQuietnessProvider.class);
	}

	@Test
	@DisplayName("경주 지역을 물으면 목업 관광지가 나온다")
	void servesGyeongjuPlaces() {
		assertThat(placeProvider.findByRegion(com.peakoff.place.mock.GyeongjuMockCatalog.GYEONGJU))
				.hasSizeGreaterThanOrEqualTo(20);
	}
}
