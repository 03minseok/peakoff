package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.place.domain.Place;
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
	 * @param place     <b>지금의 장소</b> — 사진·분류·좌표. 남의 코스가 이미 같은 것을 싣고
	 *                  있고({@code PublicCourseSummary.PublicPlace}), 두 화면이 같은 코스를
	 *                  다르게 그리지 않으려면 여기도 있어야 한다. 상세 창이 이 값으로 사진과
	 *                  분류를 세우고, 좌표로 코스 동선을 그린다.
	 *                  <p>⚠️ <b>null일 수 있다.</b> 공사 카탈로그에서 사라졌거나 호출이
	 *                  실패한 경우다. 그래서 위 {@code placeName}(저장 시점 스냅샷)을
	 *                  그대로 남겨 둔다 — 사진은 못 줘도 이름은 보여야 한다.
	 *                  <p>⚠️ 도메인 {@code Place}가 아니라 {@link PlaceResponse}다.
	 *                  도메인을 그대로 내보내면 분류가 중첩으로 나가 화면이 못 읽는다.
	 */
	public record SavedPlace(
			int day, int order, String placeId, String placeName, PlaceResponse place) {
	}

	/**
	 * @param livePlaceOf 장소 id를 <b>지금의 장소</b>로 바꿔 주는 것. 못 찾으면 null을 준다.
	 *                    부르는 쪽(서비스)이 지역을 알고 있으므로 조회는 그쪽이 맡는다 —
	 *                    이 DTO가 {@code PlaceProvider}를 알면 표현 계층이 공사 연동에 묶인다.
	 *                    남의 코스({@code PublicCourseSummary.from})와 <b>같은 계약</b>이다.
	 */
	public static SavedCourseDetail from(
			SavedCourse course, java.util.function.Function<String, Place> livePlaceOf) {
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
						place.placeName(),
						toResponse(livePlaceOf.apply(place.placeId()))))
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

	/** 못 찾은 장소는 null로 남긴다. 이름 스냅샷이 그 자리를 지킨다. */
	private static PlaceResponse toResponse(Place place) {
		return place == null ? null : PlaceResponse.from(place);
	}
}
