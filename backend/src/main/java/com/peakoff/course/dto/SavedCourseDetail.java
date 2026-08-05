package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.PlaceResponse;

/**
 * 저장된 코스 하나의 전체 내용. 목록 항목에 장소들이 붙은 모양이다.
 *
 * <p>{@link SavedCourseSummary}와 같은 필드를 다시 적었다. 감싸서 중첩하면
 * {@code detail.course.name}처럼 한 겹 더 들어가는데, 이 저장소의 다른 응답
 * ({@code CourseDiagnosisResponse})이 전부 평평한 모양이라 그쪽에 맞췄다.
 * 필드를 더할 때 두 곳을 함께 고쳐야 한다.
 */
public record SavedCourseDetail(
		Long id,
		String name,
		String region,
		String regionName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		int totalQuietness,
		CongestionLevel level,
		String levelLabel,
		Instant scoredAt,
		Instant createdAt,
		List<SavedPlace> places) {

	/**
	 * 저장된 장소 한 줄.
	 *
	 * @param place 장소 정보. <b>null일 수 있다</b> — 저장 이후 그 장소가 목록에서 사라진 경우다.
	 *              그때 전체 조회를 실패시키면 코스 하나가 통째로 안 열리므로,
	 *              자리는 남기고 화면이 "정보를 찾을 수 없는 장소"로 그리게 한다
	 */
	public record SavedPlace(int day, int order, String placeId, PlaceResponse place) {
	}

	/**
	 * @param placesById 장소 정보를 미리 찾아둔 표. 서비스가 한 번에 조회해 넘긴다 —
	 *                   여기서 장소마다 조회하면 장소 수만큼 질의가 나간다
	 */
	public static SavedCourseDetail of(SavedCourse course, Map<String, PlaceResponse> placesById) {
		CongestionLevel level = CongestionLevel.fromQuietness(course.totalQuietness());

		List<SavedPlace> places = course.places().stream()
				.map(place -> new SavedPlace(
						place.day(),
						place.visitOrder(),
						place.placeId(),
						placesById.get(place.placeId())))
				.toList();

		return new SavedCourseDetail(
				course.id(),
				course.name(),
				course.region(),
				SupportedRegion.fromSlug(course.region()).displayName(),
				course.startDate(),
				course.endDate(),
				course.nights(),
				course.days(),
				course.totalQuietness(),
				level,
				level.label(),
				course.scoredAt(),
				course.createdAt(),
				places);
	}
}
