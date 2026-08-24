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
 * @param totalQuietness 진단된 칸만의 평균. 자료 없는 칸은 분모에서도 빠진다.
 *                       <b>진단된 칸이 하나도 없으면 {@code null}</b>이다 — 음식점만 담은
 *                       코스가 그렇다. 그때는 {@code totalLevel}·{@code totalLevelLabel}도 함께 비어
 *                       화면이 점수 자리만 비우고 코스는 그대로 그린다
 * @param diagnosedCount 실제로 점수가 매겨진 칸 수. 화면이 "3곳 중 2곳 기준"이라 말할 수 있게 한다
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
		int diagnosedCount,
		List<DiagnosedSlot> slots) {

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

		int diagnosedCount = (int) course.slots().stream().filter(CourseSlot::isDiagnosed).count();

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
				diagnosedCount,
				slots);
	}
}
