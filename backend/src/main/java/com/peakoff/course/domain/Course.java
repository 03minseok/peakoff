package com.peakoff.course.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Region;

/**
 * 완성된 여행 코스 하나.
 *
 * <p>불변 객체다. 슬롯을 바꾼 코스는 기존 객체를 고치는 대신 새 코스를 만든다.
 * 화면 흐름상 "인기순 코스"와 "회피 코스"를 나란히 놓고 비교해야 하므로,
 * 원본이 중간에 변형되지 않는 편이 안전하다.
 *
 * @param region         여행 지역 (법정동 코드 기반)
 * @param startDate      여행 시작일
 * @param nights         박 수. 당일치기는 0
 * @param slots          일자·순서대로 채워진 슬롯 목록
 * @param totalQuietness 코스 전체의 예상 한적 지수 (0~100, 클수록 한적)
 */
public record Course(
		Region region,
		LocalDate startDate,
		int nights,
		List<CourseSlot> slots,
		int totalQuietness) {

	public Course {
		Objects.requireNonNull(region, "지역은 필수입니다.");
		Objects.requireNonNull(startDate, "시작일은 필수입니다.");
		if (nights < 0) {
			throw new IllegalArgumentException("박 수는 0 이상이어야 합니다. 입력값: " + nights);
		}
		Objects.requireNonNull(slots, "슬롯 목록은 필수입니다.");
		// 방어적 복사. 밖에서 넘긴 리스트를 나중에 고쳐도 코스는 흔들리지 않는다.
		slots = List.copyOf(slots);
		Scores.validate(totalQuietness, "코스 총점");
		validateSlotsWithinPeriod(slots, nights + 1);
	}

	/** 여행 기간을 벗어난 일차의 슬롯이 섞이면 화면이 조용히 깨지므로 생성 시점에 막는다. */
	private static void validateSlotsWithinPeriod(List<CourseSlot> slots, int totalDays) {
		for (CourseSlot slot : slots) {
			if (slot.day() > totalDays) {
				throw new IllegalArgumentException(
						"%d박 %d일 일정에 %d일차 슬롯이 있습니다.".formatted(totalDays - 1, totalDays, slot.day()));
			}
		}
	}

	/** 2박 3일이면 3. */
	public int days() {
		return nights + 1;
	}

	public LocalDate endDate() {
		return startDate.plusDays(nights);
	}

	/** 특정 일차의 슬롯만 순서대로 뽑는다. 일자별로 끊어 그리는 화면에서 쓴다. */
	public List<CourseSlot> slotsOfDay(int day) {
		return slots.stream()
				.filter(slot -> slot.day() == day)
				.sorted((a, b) -> Integer.compare(a.order(), b.order()))
				.toList();
	}
}
