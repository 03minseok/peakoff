package com.peakoff.course.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.global.support.Texts;
import com.peakoff.place.domain.Region;
import com.peakoff.recommendation.domain.ScoreFactor;

/**
 * 설문으로 만들어 낸 코스 초안. <b>코스에 "왜 이 장소인가"가 붙어 있다.</b>
 *
 * <p>진단 결과와 타입을 나눈 이유가 있다. 진단 화면 타임라인에는 추천도가 나오지 않는다 —
 * 추천도는 원래 장소가 있어야 성립하는 관계값이라 "내가 짠 코스"에는 붙을 자리가 없다.
 * 반대로 초안은 <b>시스템이 고른 코스</b>라, 왜 골랐는지 보여주지 않으면 근거 없는 추천이 된다.
 * 같은 타입에 담으면 진단 화면에 추천도가 새어 나간다.
 *
 * <p>{@link Course}를 안에 들고 있는 이유: 총점(슬롯 한적도의 평균)과 일차 범위 검증을
 * 진단과 똑같은 규칙으로 통과해야 한다. {@link #of}가 슬롯 목록에서 코스를 만들어 내므로
 * 두 목록이 어긋날 수 없다.
 *
 * @param course 총점까지 매겨진 코스
 * @param slots  코스의 각 슬롯과 그 슬롯이 뽑힌 근거. {@code course.slots()}와 순서가 같다
 */
public record CourseDraft(Course course, List<DraftedSlot> slots) {

	/**
	 * 초안에 담긴 슬롯 하나와 그 근거.
	 *
	 * @param slot           일차·순서·장소·한적도
	 * @param recommendation 이 자리에 이곳을 얼마나 미는가 (0~100)
	 * @param factors        추천도가 어떻게 나왔는지 항목별 내역.
	 *                       그 날의 첫 장소는 비교 대상이 없어 한적도 하나만 담긴다
	 * @param reason         근거 문구 (예: "역사·유적 선호 · 예상 혼잡 낮음")
	 */
	public record DraftedSlot(
			CourseSlot slot,
			int recommendation,
			List<ScoreFactor> factors,
			String reason) {

		public DraftedSlot {
			Objects.requireNonNull(slot, "슬롯은 필수입니다.");
			Scores.validate(recommendation, "추천도");
			Objects.requireNonNull(factors, "추천도 구성 항목은 필수입니다.");
			if (factors.isEmpty()) {
				throw new IllegalArgumentException("이 장소를 왜 골랐는지 설명할 항목이 하나 이상 있어야 합니다.");
			}
			factors = List.copyOf(factors);
			reason = Texts.requireNotBlank(reason, "추천 근거");
		}
	}

	public CourseDraft {
		Objects.requireNonNull(course, "코스는 필수입니다.");
		Objects.requireNonNull(slots, "슬롯 목록은 필수입니다.");
		slots = List.copyOf(slots);
	}

	public static CourseDraft of(Region region, LocalDate startDate, int nights, List<DraftedSlot> slots) {
		Course course = Course.of(
				region, startDate, nights, slots.stream().map(DraftedSlot::slot).toList());
		return new CourseDraft(course, slots);
	}
}
