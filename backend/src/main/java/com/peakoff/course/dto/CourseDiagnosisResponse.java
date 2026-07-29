package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.Course;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.place.dto.PlaceResponse;

/**
 * 진단 결과.
 *
 * <p>슬롯마다 한적도와 등급이 붙고, 코스 전체 총점이 함께 나간다.
 * 총점은 나중에 "원안 vs 개선안" 비교의 기준값이 된다.
 *
 * @param visitDate 그 슬롯을 실제로 방문하는 날짜. 2일차면 시작일 다음 날이다.
 *                  같은 장소라도 날짜가 다르면 한적도가 다르므로 화면에 근거로 보여줄 수 있어야 한다.
 */
public record CourseDiagnosisResponse(
		String region,
		String regionName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		int totalQuietness,
		CongestionLevel totalLevel,
		String totalLevelLabel,
		List<DiagnosedSlot> slots) {

	public record DiagnosedSlot(
			int day,
			int order,
			LocalDate visitDate,
			PlaceResponse place,
			int quietness,
			CongestionLevel level,
			String levelLabel) {

		static DiagnosedSlot from(CourseSlot slot, LocalDate visitDate) {
			CongestionLevel level = CongestionLevel.fromQuietness(slot.quietness());
			return new DiagnosedSlot(
					slot.day(),
					slot.order(),
					visitDate,
					PlaceResponse.from(slot.place()),
					slot.quietness(),
					level,
					level.label());
		}
	}

	public static CourseDiagnosisResponse from(Course course, String regionSlug) {
		CongestionLevel totalLevel = CongestionLevel.fromQuietness(course.totalQuietness());
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
				course.totalQuietness(),
				totalLevel,
				totalLevel.label(),
				slots);
	}
}
