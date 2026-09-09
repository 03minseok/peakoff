package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.dto.PublicCourseSummary.PublicPlace;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 공유 링크({@code /s/{token}})로 여는 코스 한 장. 로그인 없이 나간다.
 *
 * <h2>{@link PublicCourseSummary}와 무엇이 다른가</h2>
 * 모양은 같고 둘이 다르다:
 * <ul>
 *   <li><b>코스 이름이 실린다.</b> 홈 목록에서 이름을 뺀 이유는 목록의 문제였다 — 사용자마다
 *       문법이 달라("엄마 생신 여행" · "경주 2일") 카드 다섯이 한 목록으로 읽히지 않았고,
 *       공개에 동의한 적도 없었다. 링크 한 장에는 둘 다 없다: 견줄 이웃이 없고, 링크를 만든 것이
 *       동의다. 오히려 이름이 있어야 받은 사람이 무엇을 받았는지 안다</li>
 *   <li><b>총점이 비어 있을 수 있다.</b> 홈 목록은 진단 안 된 코스를 걸러 내지만, 링크는 주인이
 *       고른 코스라 거를 수 없다 — "미리 짜 두고 나중에 진단"한 코스를 공유하려는데 막으면 안 된다.
 *       그래서 {@code totalQuietness}·{@code level}·{@code levelLabel}이 함께 {@code null}이 되고,
 *       화면은 마이페이지 카드처럼 {@code —} · "아직 진단 전"으로 그린다. <b>0으로 채우지 않는다</b>
 *       (CLAUDE.md — 0은 "매우 붐빔"으로 읽힌다)</li>
 * </ul>
 * 코스 id는 여전히 나가지 않는다 — 받은 사람이 이 코스에 할 수 있는 일은 보기와 베끼기뿐이다.
 */
public record SharedCourseView(
		String name,
		String nickname,
		String region,
		String regionName,
		String regionShortName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		Integer totalQuietness,
		CongestionLevel level,
		String levelLabel,
		List<PublicPlace> places,
		Instant createdAt) {

	public static SharedCourseView from(
			SavedCourse course, java.util.function.Function<String, Place> livePlaceOf) {
		Integer quietness = course.totalQuietness();
		CongestionLevel level = quietness == null ? null : CongestionLevel.fromQuietness(quietness);
		SupportedRegion region = SupportedRegion.fromSlug(course.region());
		return new SharedCourseView(
				course.name(),
				course.authorNickname(),
				course.region(),
				region.displayName(),
				region.shortName(),
				course.startDate(),
				course.endDate(),
				course.nights(),
				course.days(),
				quietness,
				level,
				level == null ? null : level.label(),
				PublicCourseSummary.placesOf(course, livePlaceOf),
				course.createdAt());
	}
}
