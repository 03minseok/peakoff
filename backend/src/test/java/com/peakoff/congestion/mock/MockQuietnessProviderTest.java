package com.peakoff.congestion.mock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.global.support.Scores;
import com.peakoff.place.mock.GyeongjuMockCatalog;

class MockQuietnessProviderTest {

	private final MockQuietnessProvider provider = new MockQuietnessProvider();

	private static final LocalDate SATURDAY = LocalDate.of(2026, 9, 12);
	private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 16);

	@Test
	@DisplayName("같은 장소라도 주말이 평일보다 덜 한적하다 — 날짜 대안 기능의 근거가 된다")
	void weekendIsLessQuietThanWeekday() {
		int weekend = provider.quietnessOf("mock-bulguksa", SATURDAY);
		int weekday = provider.quietnessOf("mock-bulguksa", WEDNESDAY);

		assertThat(weekend).isLessThan(weekday);
	}

	@Test
	@DisplayName("요일 보정을 해도 0~100을 벗어나지 않는다")
	void staysWithinScoreRange() {
		assertThat(GyeongjuMockCatalog.places()).allSatisfy(place -> {
			assertThat(provider.quietnessOf(place.id(), SATURDAY)).isBetween(Scores.MIN, Scores.MAX);
			assertThat(provider.quietnessOf(place.id(), WEDNESDAY)).isBetween(Scores.MIN, Scores.MAX);
		});
	}

	@Test
	@DisplayName("데이터가 없는 장소는 0점으로 뭉개지 않고 예외로 알린다")
	void failsLoudlyForUnknownPlace() {
		assertThat(provider.hasData("존재하지-않음")).isFalse();

		assertThatThrownBy(() -> provider.quietnessOf("존재하지-않음", WEDNESDAY))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("예측 데이터가 없는");
	}

	@Test
	@DisplayName("목업에 있는 장소는 모두 예측 데이터를 갖고 있다")
	void hasDataForEveryCatalogPlace() {
		assertThat(GyeongjuMockCatalog.places())
				.allSatisfy(place -> assertThat(provider.hasData(place.id())).isTrue());
	}
}
