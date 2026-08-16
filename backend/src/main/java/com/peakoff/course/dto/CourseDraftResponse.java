package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.Course;
import com.peakoff.course.domain.CourseDraft;
import com.peakoff.course.domain.CourseDraft.DraftedSlot;
import com.peakoff.place.dto.PlaceResponse;
import com.peakoff.recommendation.domain.ScoreFactor;

/**
 * 설문으로 만든 코스 초안.
 *
 * <p>바깥 필드와 슬롯의 앞부분은 {@link CourseDiagnosisResponse}와 모양이 같다.
 * 프론트가 진단 화면의 타임라인 컴포넌트를 그대로 재사용할 수 있게 맞춘 것이다.
 * 다른 것은 슬롯 뒤에 붙는 셋뿐이다 — {@code recommendation}, {@code factors}, {@code reason}.
 *
 * <p><b>화면 주의:</b> 이 응답에는 점수가 들어 있지만, 초안이 <b>편집 화면에 얹히는 순간</b>
 * 한적도 배지와 마커 색은 감춰야 한다. 편집 중에 점수를 보여주면 "직접 짠 코스"가 아니라
 * 시스템이 유도한 코스가 되어 진단의 의미가 사라진다.
 * 근거는 <b>설문 결과 미리보기</b>에서 보여주고, 편집으로 넘어갈 때 떼어 낸다.
 */
public record CourseDraftResponse(
		String region,
		String regionName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		int totalQuietness,
		CongestionLevel totalLevel,
		String totalLevelLabel,
		List<DraftSlot> slots) {

	/**
	 * @param recommendation 이 자리에 이곳을 얼마나 미는가 (0~100)
	 * @param factors        추천도가 어떻게 나왔는지 항목별 내역.
	 *                       <b>개수가 고정이 아니다</b> — 그 날 첫 장소는 비교 대상이 없어
	 *                       한적도 하나만 담기고, 연관 관광지 데이터가 붙으면 항목이 하나 는다.
	 *                       화면은 배열을 그대로 반복해 그려야 한다
	 */
	public record DraftSlot(
			int day,
			int order,
			LocalDate visitDate,
			PlaceResponse place,
			int quietness,
			CongestionLevel level,
			String levelLabel,
			int recommendation,
			List<ScoreFactor> factors,
			String reason) {

		static DraftSlot from(DraftedSlot drafted, LocalDate visitDate) {
			CongestionLevel level = CongestionLevel.fromQuietness(drafted.slot().quietness());
			return new DraftSlot(
					drafted.slot().day(),
					drafted.slot().order(),
					visitDate,
					PlaceResponse.from(drafted.slot().place()),
					drafted.slot().quietness(),
					level,
					level.label(),
					drafted.recommendation(),
					drafted.factors(),
					drafted.reason());
		}
	}

	public static CourseDraftResponse from(CourseDraft draft, String regionSlug) {
		Course course = draft.course();
		CongestionLevel totalLevel = CongestionLevel.fromQuietness(course.totalQuietness());

		List<DraftSlot> slots = draft.slots().stream()
				.map(drafted -> DraftSlot.from(
						drafted, course.startDate().plusDays(drafted.slot().day() - 1L)))
				.toList();

		return new CourseDraftResponse(
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
