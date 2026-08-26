package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.DiagnosisGap;
import com.peakoff.course.domain.Course;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.place.dto.PlaceResponse;

/**
 * 진단 결과.
 *
 * <p>슬롯마다 한적도와 등급이 붙고, 코스 전체 총점이 함께 나간다.
 * 총점은 나중에 "원안 vs 개선안" 비교의 기준값이 된다.
 *
 * <p><b>모든 칸에 점수가 붙지는 않는다.</b> 공사 집중률은 관광지만 예측해서 음식점·카페·숙박은
 * 자료가 없고, 여행일이 예측 범위 밖이면 관광지도 값이 없다. 그런 칸은 점수 대신 사유가 나간다.
 *
 * @param totalQuietness      진단된 칸만의 평균. 자료 없는 칸은 분모에서도 빠진다.
 *                            <b>진단된 칸이 하나도 없으면 {@code null}</b>이다 — 음식점만 담은
 *                            코스가 그렇다. 그때는 {@code totalLevel}·{@code totalLevelLabel}도 함께 비어
 *                            화면이 점수 자리만 비우고 코스는 그대로 그린다
 * @param totalPresentable    <b>총점을 숫자로 보여줘도 되는가.</b> 관광지 셋 중 하나만 진단된 코스에서
 *                            그 하나를 "코스 총점"이라 부르면 설명할 수 없다.
 *                            ⚠️ 이 값이 {@code false}여도 {@code totalQuietness}에는 값이 들어 있다 —
 *                            <b>저장에 쓰라고 남긴 것</b>이지 화면에 띄우라는 뜻이 아니다.
 *                            거짓이면 화면은 숫자 대신 {@code levelCounts} 요약을 보여준다
 * @param diagnosedCount      실제로 점수가 매겨진 칸 수. 총점의 분자
 * @param forecastTargetCount 공사가 예측하기로 되어 있는 분류의 칸 수. 총점의 분모.
 *                            음식점·숙박·쇼핑은 빠진다. 화면이 "관광지 3곳 중 2곳 기준"이라
 *                            말하려면 이 값이 필요하다 — 예전에는 분자만 있어 말할 수 없었다
 * @param levelCounts         등급별 칸 수. <b>총점을 못 보여줄 때 대신 펴는 요약</b>이다.
 *                            숫자 하나가 없다고 빈 화면을 주면 사용자는 진단이 실패한 줄 안다
 */
public record CourseDiagnosisResponse(
		String region,
		String regionName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		Integer totalQuietness,
		CongestionLevel totalLevel,
		String totalLevelLabel,
		boolean totalPresentable,
		int diagnosedCount,
		int forecastTargetCount,
		LevelCounts levelCounts,
		List<DiagnosedSlot> slots) {

	/**
	 * 등급별로 칸이 몇이었는지.
	 *
	 * <p>총점을 숫자로 못 말할 때 <b>대신 할 수 있는 말</b>이다. "한적 2곳 · 보통 1곳 ·
	 * 예상 혼잡 정보 없음 2곳"은 평균이 아니라 사실의 나열이라, 근거가 얇아도 정직하다.
	 *
	 * @param quiet             한적
	 * @param moderate          보통
	 * @param crowded           붐빔
	 * @param notForecasted     관광지인데 예측 자료가 없다. 날짜를 바꿔도 없다
	 * @param outOfForecastDate 관광지인데 그 날짜가 예측 범위 밖이다. <b>기다리면 생긴다</b>
	 * @param notTargeted       애초에 예측 대상 분류가 아니다 (음식점·숙박·쇼핑).
	 *                          총점의 분모에서도 빠지므로 따로 센다
	 */
	public record LevelCounts(
			int quiet,
			int moderate,
			int crowded,
			int notForecasted,
			int outOfForecastDate,
			int notTargeted) {

		static LevelCounts of(Course course) {
			int quiet = 0, moderate = 0, crowded = 0;
			int notForecasted = 0, outOfDate = 0, notTargeted = 0;

			for (CourseSlot slot : course.slots()) {
				if (slot.isDiagnosed()) {
					switch (CongestionLevel.fromQuietness(slot.quietness())) {
						case QUIET -> quiet++;
						case MODERATE -> moderate++;
						case CROWDED -> crowded++;
					}
					continue;
				}
				switch (slot.gap()) {
					case PLACE_NOT_FORECASTED -> notForecasted++;
					case DATE_OUT_OF_FORECAST -> outOfDate++;
					case CATEGORY_NOT_FORECASTED -> notTargeted++;
				}
			}
			return new LevelCounts(quiet, moderate, crowded, notForecasted, outOfDate, notTargeted);
		}
	}

	/**
	 * @param visitDate  그 슬롯을 실제로 방문하는 날짜. 2일차면 시작일 다음 날이다.
	 *                   같은 장소라도 날짜가 다르면 한적도가 다르므로 화면에 근거로 보여줄 수 있어야 한다.
	 * @param quietness  한적도. <b>진단하지 못한 칸은 {@code null}</b>이다.
	 *                   0으로 채우면 화면에서 "매우 붐빔"으로 읽혀, 없다는 사실이 거짓말이 된다
	 * @param gap        진단하지 못한 이유. 진단됐으면 {@code null}
	 * @param gapMessage 그 이유를 사람이 읽는 문장. 화면이 그대로 띄운다
	 */
	public record DiagnosedSlot(
			int day,
			int order,
			LocalDate visitDate,
			PlaceResponse place,
			Integer quietness,
			CongestionLevel level,
			String levelLabel,
			DiagnosisGap gap,
			String gapMessage) {

		static DiagnosedSlot from(CourseSlot slot, LocalDate visitDate) {
			PlaceResponse place = PlaceResponse.from(slot.place());

			if (!slot.isDiagnosed()) {
				return new DiagnosedSlot(slot.day(), slot.order(), visitDate, place,
						null, null, null, slot.gap(), slot.gap().message());
			}

			CongestionLevel level = CongestionLevel.fromQuietness(slot.quietness());
			return new DiagnosedSlot(slot.day(), slot.order(), visitDate, place,
					slot.quietness(), level, level.label(), null, null);
		}
	}

	public static CourseDiagnosisResponse from(Course course, String regionSlug) {
		/*
		 * 총점이 없으면 등급도 없다. 없는 점수에 등급을 붙이면 "붐빔"이 되어,
		 * 밥집만 담았다는 이유로 최악의 코스라고 말하게 된다.
		 */
		Integer total = course.totalQuietness();
		CongestionLevel totalLevel = total == null ? null : CongestionLevel.fromQuietness(total);
		List<DiagnosedSlot> slots = course.slots().stream()
				.map(slot -> DiagnosedSlot.from(slot, course.startDate().plusDays(slot.day() - 1L)))
				.toList();

		return new CourseDiagnosisResponse(
				regionSlug,
				course.region().name(),
				course.startDate(),
				course.endDate(),
				course.nights(),
				course.days(),
				total,
				totalLevel,
				totalLevel == null ? null : totalLevel.label(),
				course.isTotalPresentable(),
				course.diagnosedCount(),
				course.forecastTargetCount(),
				LevelCounts.of(course),
				slots);
	}
}
