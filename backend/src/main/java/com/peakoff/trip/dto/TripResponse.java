package com.peakoff.trip.dto;

import java.time.Instant;
import java.util.List;

import com.peakoff.course.dto.SavedCourseSummary;
import com.peakoff.trip.domain.Trip;
import com.peakoff.trip.domain.TripCourse;

/**
 * 여행 하나.
 *
 * <p>⚠️ <b>여행 총점이 없다.</b> 코스 총점의 평균은 마이페이지에서 걷어낸
 * "평균 한적 지수"와 같은 물건이다 — 지역도 날짜도 다른 값의 평균은 아무 말도 아니다.
 * 날짜 범위·지역 나열도 화면이 코스 목록에서 직접 계산한다. 서버가 요약 문자열을 만들면
 * 표기를 바꿀 때마다 서버를 고쳐야 한다.
 *
 * @param courses 담은 순서 그대로. 코스의 점수·등급은 각자 자기 것을 갖고 온다
 */
public record TripResponse(
		Long id,
		String name,
		Instant createdAt,
		List<SavedCourseSummary> courses) {

	public static TripResponse from(Trip trip) {
		return new TripResponse(
				trip.id(),
				trip.name(),
				trip.createdAt(),
				trip.courses().stream()
						.map(TripCourse::course)
						.map(SavedCourseSummary::from)
						.toList());
	}
}
