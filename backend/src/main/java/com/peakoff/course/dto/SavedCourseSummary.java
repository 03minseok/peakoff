package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 마이페이지 목록에 세우는 코스 한 줄.
 *
 * <p>장소 목록을 담지 않는다. 카드에 필요한 것은 몇 곳인지뿐이고,
 * 코스 10개의 장소를 전부 실어 보내면 목록 응답이 쓸데없이 커진다.
 *
 * <p><b>등급을 서버가 매겨 함께 내려보낸다.</b> 화면에서 {@code quietness >= 70}으로
 * 판정하면 임계값이 서버와 화면 두 곳에 생겨, 분석 결과로 기준이 바뀔 때 한쪽만 고쳐진다.
 *
 * @param placeCount          담긴 장소 수
 * @param diagnosedCount      그 총점을 매긴 칸 수. <b>옛 코스는 {@code null}</b>
 * @param forecastTargetCount 예측 대상 관광지 수. 총점의 분모. <b>옛 코스는 {@code null}</b>
 * @param scoredAt            점수를 매긴 시각. 저장 시점의 판단이라는 것을 화면에서 밝힐 수 있다
 * @param isPublic            홈의 "요즘 저장된 여행"에 나가는가.
 *                            <b>화면에 표시하려고 넣은 값이 아니라 되돌려주기 위한 값이다</b> —
 *                            "수정하기"로 들어가 다시 저장할 때 저장 시트의 토글을 지금 값으로
 *                            채워야 한다. 없으면 기본값(켜짐)으로 돌아가,
 *                            <b>비공개로 둔 코스가 고치는 것만으로 공개된다</b>
 */
public record SavedCourseSummary(
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
		int placeCount,
		Integer diagnosedCount,
		Integer forecastTargetCount,
		Instant scoredAt,
		Instant createdAt,
		boolean isPublic) {

	public static SavedCourseSummary from(SavedCourse course) {
		/*
		 * 총점이 없으면 등급도 없다. 없는 점수에 등급을 붙이면 "붐빔"이 되어,
		 * 아직 재보지도 않은 코스를 최악이라고 말하게 된다.
		 */
		Integer total = course.totalQuietness();
		CongestionLevel level = total == null ? null : CongestionLevel.fromQuietness(total);
		return new SavedCourseSummary(
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
				course.places().size(),
				course.diagnosedCount(),
				course.forecastTargetCount(),
				course.scoredAt(),
				course.createdAt(),
				course.isPublic());
	}
}
