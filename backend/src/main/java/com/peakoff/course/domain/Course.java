package com.peakoff.course.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.OptionalDouble;

import com.peakoff.congestion.domain.DiagnosisGap;
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
 * @param totalQuietness 코스 전체의 예상 한적 지수 (0~100, 클수록 한적).
 *                       <b>진단된 칸이 하나도 없으면 {@code null}이다</b> —
 *                       음식점만 담은 코스가 그렇다
 */
public record Course(
		Region region,
		LocalDate startDate,
		int nights,
		List<CourseSlot> slots,
		Integer totalQuietness) {

	public Course {
		Objects.requireNonNull(region, "지역은 필수입니다.");
		Objects.requireNonNull(startDate, "시작일은 필수입니다.");
		if (nights < 0) {
			throw new IllegalArgumentException("박 수는 0 이상이어야 합니다. 입력값: " + nights);
		}
		Objects.requireNonNull(slots, "슬롯 목록은 필수입니다.");
		// 방어적 복사. 밖에서 넘긴 리스트를 나중에 고쳐도 코스는 흔들리지 않는다.
		slots = List.copyOf(slots);
		// 총점은 없을 수 있다. 있을 때만 범위를 본다.
		if (totalQuietness != null) {
			Scores.validate(totalQuietness, "코스 총점");
		}
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
	 * 총점은 <b>진단된 칸만</b>의 평균이다. 하나도 없으면 {@code null}이다.
	 *
	 * <p>음식점처럼 예측 자료가 없는 칸은 분모에서도 빠진다. 0점으로 채워 넣으면 밥집을
	 * 넣을수록 코스가 붐비는 것으로 계산돼, 원안 대비 개선폭이라는 비교의 기준이 무너진다.
	 *
	 * <h3>없으면 왜 거절하지 않고 {@code null}인가</h3>
	 * 예전에는 진단된 칸이 하나도 없으면 예외를 던졌고, 그것이 400이 되어
	 * <b>진단 화면 자체가 뜨지 않았다.</b> 밥집 셋으로 코스를 짠 사용자는 아무 화면도 보지 못했다.
	 *
	 * <p>총점이 없는 것과 코스가 없는 것은 다르다. 장소도 순서도 지도도 그대로 있고
	 * 점수 한 칸만 비었을 뿐인데, 그것 때문에 화면 전체를 막을 이유가 없다.
	 * 날짜 대안이 같은 상황을 이미 이렇게 다룬다 — 창은 그리되 점수 자리를 비운다
	 * ({@code TimeOffStatus.INSUFFICIENT_DATA}).
	 *
	 * <p>0을 만들어 내지 않는 것은 그대로다. 0은 화면에서 <b>"매우 붐빔"</b>으로 읽혀,
	 * 밥집만 담았다는 이유로 최악의 코스라고 말하게 된다.
	 */
	private static Integer averageQuietness(List<CourseSlot> slots) {
		OptionalDouble average = slots.stream()
				.filter(CourseSlot::isDiagnosed)
				.mapToInt(CourseSlot::quietness)
				.average();
		return average.isPresent() ? (int) Math.round(average.getAsDouble()) : null;
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

	/** 실제로 한적도가 매겨진 칸 수. 총점의 분자다. */
	public int diagnosedCount() {
		return (int) slots.stream().filter(CourseSlot::isDiagnosed).count();
	}

	/**
	 * 공사가 <b>예측하기로 되어 있는 분류</b>의 칸 수. 총점의 분모다.
	 *
	 * <p>진단된 칸과, 관광지인데 자료가 없어 못 매긴 칸을 함께 센다. 빠지는 것은
	 * <b>애초에 예측 대상이 아닌 분류</b>뿐이다({@code CATEGORY_NOT_FORECASTED}) —
	 * 음식점·숙박·쇼핑을 분모에 넣으면 밥집을 담을수록 진단율이 떨어져,
	 * 코스를 성실히 짤수록 총점이 사라지는 이상한 일이 생긴다.
	 *
	 * @see CourseScoreStandard#isTotalPresentable(int, int)
	 */
	public int forecastTargetCount() {
		return (int) slots.stream()
				.filter(slot -> slot.isDiagnosed() || slot.gap() != DiagnosisGap.CATEGORY_NOT_FORECASTED)
				.count();
	}

	/**
	 * 총점을 <b>숫자로 보여줘도 되는가.</b> 저장 여부와는 상관이 없다.
	 *
	 * <p>총점 자체는 {@link #totalQuietness()}에 그대로 있다 — 조건을 못 채워도 저장은 되고,
	 * 그때는 모수를 함께 남긴다. 자세한 이유는 {@link CourseScoreStandard}에 적어 두었다.
	 */
	public boolean isTotalPresentable() {
		return totalQuietness != null
				&& CourseScoreStandard.isTotalPresentable(diagnosedCount(), forecastTargetCount());
	}

	/** 특정 일차의 슬롯만 순서대로 뽑는다. 일자별로 끊어 그리는 화면에서 쓴다. */
	public List<CourseSlot> slotsOfDay(int day) {
		return slots.stream()
				.filter(slot -> slot.day() == day)
				.sorted((a, b) -> Integer.compare(a.order(), b.order()))
				.toList();
	}
}
