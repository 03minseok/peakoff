package com.peakoff.course.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategory;
import com.peakoff.place.domain.Region;

class CourseTest {

	private static final Region REGION = new Region("5013025300", "제주시 애월읍");
	private static final Place PLACE =
			new Place("126508", "협재해수욕장", 33.3948, 126.2396, new PlaceCategory("AC01", "자연관광지"), null);
	private static final LocalDate START = LocalDate.of(2026, 9, 12);

	@Test
	@DisplayName("1박이면 2일, 종료일은 시작일 다음 날")
	void derivesPeriod() {
		Course course = new Course(REGION, START, 1, List.of(new CourseSlot(1, 1, PLACE, 80)), 80);

		assertThat(course.days()).isEqualTo(2);
		assertThat(course.endDate()).isEqualTo(LocalDate.of(2026, 9, 13));
	}

	@Test
	@DisplayName("당일치기는 0박 1일로 표현한다")
	void allowsDayTrip() {
		Course course = new Course(REGION, START, 0, List.of(new CourseSlot(1, 1, PLACE, 80)), 80);

		assertThat(course.days()).isEqualTo(1);
		assertThat(course.endDate()).isEqualTo(START);
	}

	@Test
	@DisplayName("일차별 슬롯은 순서대로 정렬되어 나온다")
	void sortsSlotsOfDayByOrder() {
		Course course = new Course(REGION, START, 1,
				List.of(new CourseSlot(1, 2, PLACE, 70), new CourseSlot(1, 1, PLACE, 80),
						new CourseSlot(2, 1, PLACE, 60)),
				70);

		assertThat(course.slotsOfDay(1)).extracting(CourseSlot::order).containsExactly(1, 2);
		assertThat(course.slotsOfDay(2)).hasSize(1);
	}

	@Test
	@DisplayName("생성에 넘긴 리스트를 밖에서 고쳐도 코스는 흔들리지 않는다")
	void copiesSlotsDefensively() {
		List<CourseSlot> mutable = new ArrayList<>(List.of(new CourseSlot(1, 1, PLACE, 80)));
		Course course = new Course(REGION, START, 0, mutable, 80);

		mutable.clear();

		assertThat(course.slots()).hasSize(1);
	}

	@Test
	@DisplayName("여행 기간을 벗어난 일차의 슬롯은 생성 시점에 막는다")
	void rejectsSlotOutsidePeriod() {
		List<CourseSlot> slots = List.of(new CourseSlot(5, 1, PLACE, 80));

		assertThatThrownBy(() -> new Course(REGION, START, 1, slots, 80))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("5일차");
	}

	@Test
	@DisplayName("한적도·추천도는 0~100을 벗어날 수 없다")
	void rejectsScoreOutOfRange() {
		assertThatThrownBy(() -> new CourseSlot(1, 1, PLACE, 101))
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

	@Test
	@DisplayName("슬롯 교체는 일차·순서를 유지한 새 슬롯을 만든다")
	void replacesPlaceKeepingPosition() {
		CourseSlot original = new CourseSlot(2, 3, PLACE, 40);
		Place quieter = new Place("999", "금능해수욕장", 33.39, 126.24, new PlaceCategory("AC01", "자연관광지"), null);

		CourseSlot replaced = original.replaceWith(quieter, 88);

		assertThat(replaced.day()).isEqualTo(2);
		assertThat(replaced.order()).isEqualTo(3);
		assertThat(replaced.place().name()).isEqualTo("금능해수욕장");
		assertThat(replaced.quietness()).isEqualTo(88);
	}
}
