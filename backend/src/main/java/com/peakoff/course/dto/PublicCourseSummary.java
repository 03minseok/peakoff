package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.domain.SavedCoursePlace;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 남이 저장한 코스를 <b>익명으로</b> 요약한 것. 홈의 "다른 사람들의 여행"에 쓴다.
 *
 * <h2>무엇을 빼는가</h2>
 * <b>코스 id·이름·저장한 사람</b>이 없다.
 *
 * <p>id가 없는 것은 열어 볼 길을 아예 두지 않기 위해서다. 있으면 언젠가 "눌러서 자세히"가
 * 붙고, 그때 남의 코스가 통째로 열린다. 목록에 담지 않으면 그 유혹이 생기지 않는다.
 *
 * <p>이름을 빼는 것은 <b>사용자가 자기만 볼 줄 알고 지은 것</b>이기 때문이다.
 * "엄마 생신 여행" 같은 이름을 공개에 동의한 적이 없다.
 *
 * <h2>무엇을 남기는가</h2>
 * 지역·기간·총점·장소 수, 그리고 <b>장소 이름 몇 개</b>. 장소는 공공 관광지라
 * 개인을 가리키지 않고, 이것이 없으면 "다른 사람의 여행"이라는 느낌이 남지 않는다 —
 * 숫자만 늘어놓은 표는 남의 여행으로 읽히지 않는다.
 *
 * @param places 앞쪽 몇 곳의 이름. 코스 전체가 아니라 맛보기다
 */
public record PublicCourseSummary(
		String region,
		String regionName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		int totalQuietness,
		CongestionLevel level,
		String levelLabel,
		int placeCount,
		List<String> places,
		Instant createdAt) {

	/** 맛보기로 보여줄 장소 수. 카드 한 줄에 들어가는 만큼만. */
	private static final int PREVIEW_PLACES = 3;

	public static PublicCourseSummary from(SavedCourse course) {
		CongestionLevel level = CongestionLevel.fromQuietness(course.totalQuietness());

		// 담은 순서대로 앞에서 몇 개. 무작위로 고르면 같은 코스가 볼 때마다 달라 보인다.
		List<String> preview = course.places().stream()
				.sorted(Comparator.comparingInt(SavedCoursePlace::day)
						.thenComparingInt(SavedCoursePlace::visitOrder))
				.map(SavedCoursePlace::placeName)
				.limit(PREVIEW_PLACES)
				.toList();

		return new PublicCourseSummary(
				course.region(),
				SupportedRegion.fromSlug(course.region()).displayName(),
				course.startDate(),
				course.endDate(),
				course.nights(),
				course.days(),
				course.totalQuietness(),
				level,
				level.label(),
				course.places().size(),
				preview,
				course.createdAt());
	}
}
