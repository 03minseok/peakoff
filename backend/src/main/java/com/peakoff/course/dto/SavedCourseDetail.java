package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.place.domain.SupportedRegion;

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
		Integer totalQuietness,
		CongestionLevel level,
		String levelLabel,
		Integer diagnosedCount,
		Integer forecastTargetCount,
		Instant scoredAt,
		Instant createdAt,
		List<SavedPlace> places) {

	/**
	 * 저장된 장소 한 줄.
	 *
	 * @param placeName 저장 시점의 이름. <b>화면에 보이는 것은 이 값이다.</b>
	 *                  매번 장소 API에 다시 묻지 않으므로, 바깥에서 그 id의 내용이 바뀌어도
	 *                  저장된 코스는 흔들리지 않는다
	 * @param placeId   식별자. 표시에는 쓰지 않는다 — "이어서 보기"로 코스를 흐름에 올려
	 *                  다시 진단할 때 필요하다
	 */
	public record SavedPlace(int day, int order, String placeId, String placeName) {
	}

	/** 저장된 내용만으로 만든다. 장소 쪽에 묻지 않는다. */
	public static SavedCourseDetail from(SavedCourse course) {
		/*
		 * 총점이 없으면 등급도 없다. 없는 점수에 등급을 붙이면 "붐빔"이 되어,
		 * 아직 재보지도 않은 코스를 최악이라고 말하게 된다.
		 */
		Integer total = course.totalQuietness();
		CongestionLevel level = total == null ? null : CongestionLevel.fromQuietness(total);

		List<SavedPlace> places = course.places().stream()
				.map(place -> new SavedPlace(
						place.day(),
						place.visitOrder(),
						place.placeId(),
						place.placeName()))
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
				total,
				level,
				level == null ? null : level.label(),
				course.diagnosedCount(),
				course.forecastTargetCount(),
				course.scoredAt(),
				course.createdAt(),
				places);
	}
}
