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

	/**
	 * 슬롯들로 코스를 만든다. <b>총점은 여기서 계산한다.</b>
	 *
	 * <p>총점 = 슬롯 한적도의 평균. <b>추천도가 섞이지 않는다.</b>
	 * 원안과 개선안을 맞대는 값이라(발표 하이라이트), 순수 한적도로 두어야 개선폭이 그대로 읽힌다.
	 *
	 * <p>생성자 대신 이 정적 팩터리를 두는 이유: 총점을 매기는 곳이 둘이 됐다(진단·설문 생성).
	 * 각자 평균을 내면 나중에 "체류 시간이 긴 장소에 가중치" 같은 보정이 들어올 때
	 * 한쪽만 고쳐져 같은 코스가 화면마다 다른 총점을 갖는다.
	 *
	 * <p><b>평균은 임시 규칙이다.</b> 보정 방식은 분석 검증 후 정한다.
	 * 지금은 "원안 대비 개선폭"을 비교할 기준만 있으면 된다.
	 */
	public static Course of(Region region, LocalDate startDate, int nights, List<CourseSlot> slots) {
		Objects.requireNonNull(slots, "슬롯 목록은 필수입니다.");
		if (slots.isEmpty()) {
			throw new IllegalArgumentException("코스에 장소가 하나 이상 있어야 총점을 낼 수 있습니다.");
		}
		return new Course(region, startDate, nights, slots, averageQuietness(slots));
	}

	/**
	 * 총점은 <b>진단된 칸만</b>의 평균이다.
	 *
	 * <p>음식점처럼 예측 자료가 없는 칸은 분모에서도 빠진다. 0점으로 채워 넣으면 밥집을
	 * 넣을수록 코스가 붐비는 것으로 계산돼, 원안 대비 개선폭이라는 비교의 기준이 무너진다.
	 *
	 * <p>진단된 칸이 하나도 없으면 총점이라는 값 자체가 성립하지 않는다. 그때는 0을 만들어
	 * 내지 않고 거절한다 — 계산하지 않은 것을 근거로 말하지 않는다는 규칙이 여기에도 걸린다.
	 */
	private static int averageQuietness(List<CourseSlot> slots) {
		return (int) Math.round(slots.stream()
				.filter(CourseSlot::isDiagnosed)
				.mapToInt(CourseSlot::quietness)
				.average()
				.orElseThrow(() -> new IllegalArgumentException(
						"예상 혼잡을 계산할 수 있는 장소가 코스에 하나도 없습니다.")));
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
