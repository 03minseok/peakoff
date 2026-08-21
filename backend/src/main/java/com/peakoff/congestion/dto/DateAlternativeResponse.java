package com.peakoff.congestion.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.DiagnosisGap;
import com.peakoff.congestion.domain.TimeOffStatus;

/**
 * 기준 시작일 앞뒤 창의 날짜별 코스 한적도.
 *
 * <p>선택한 날짜의 점수를 함께 내려보내는 이유: "이 날짜가 더 낫다"를 주장하려면
 * 비교 대상이 화면에 같이 있어야 한다. {@code improvement}가 그 차이다.
 *
 * <p><b>모든 날에 점수가 붙지는 않는다.</b> 공사 예측은 조회 시점부터 3~4주치뿐이라
 * 창의 일부가 범위 밖으로 나갈 수 있다. 그런 날은 점수 대신 사유가 나간다.
 *
 * @param status          날짜를 옮기라고 권할지에 대한 판단. 화면의 문구와 강조가 여기서 갈린다
 * @param statusMessage   그 판단을 사람이 읽는 문장
 * @param selectedDate    사용자가 고른 시작일
 * @param selectedQuietness 그 시작일의 코스 한적도. 계산할 수 없으면 {@code null}
 * @param bestDate        가장 나은 후보. 없으면 {@code null}. 지난 날짜는 후보에서 빠진다
 * @param bestImprovement 그 후보의 개선폭. {@code bestDate}가 없으면 {@code null}
 * @param minImprovement  옮기라고 권하는 최소 개선폭. <b>서버가 내려보낸다</b> —
 *                        화면에 숫자를 적어두면 분석 결과로 기준이 바뀔 때 한쪽만 고쳐진다
 * @param options         창 안의 모든 날짜(기준일 제외). <b>더 붐비는 날도 들어 있다.</b>
 *                        되돌아갈 날짜와 비교 대상이 함께 있어야 화면이 표로 성립한다
 */
public record DateAlternativeResponse(
		TimeOffStatus status,
		String statusMessage,
		LocalDate selectedDate,
		Integer selectedQuietness,
		CongestionLevel selectedLevel,
		String selectedLevelLabel,
		LocalDate bestDate,
		Integer bestImprovement,
		int minImprovement,
		List<DateOption> options) {

	/**
	 * @param quietness   그 날 시작했을 때의 코스 한적도. 자료가 없으면 {@code null}
	 * @param improvement 선택 날짜 대비 한적도 증가폭. 클수록 덜 붐빈다. 자료가 없으면 {@code null}
	 * @param selectable  실제로 고를 수 있는 날인지. 지난 날짜와 자료 없는 날은 {@code false}.
	 *                    <b>목록에서 빼지 않고 남긴다</b> — 되돌아갈 자리가 늘 보여야 하고,
	 *                    "왜 이 날은 못 고르나"에 답할 수 있어야 한다
	 * @param gap         점수가 없는 이유. 있으면 {@code null}
	 */
	public record DateOption(
			LocalDate date,
			Integer quietness,
			CongestionLevel level,
			String levelLabel,
			Integer improvement,
			boolean selectable,
			DiagnosisGap gap,
			String gapMessage) {

		public static DateOption of(LocalDate date, int quietness, Integer selectedQuietness, boolean past) {
			CongestionLevel level = CongestionLevel.fromQuietness(quietness);
			Integer improvement = selectedQuietness == null ? null : quietness - selectedQuietness;
			return new DateOption(date, quietness, level, level.label(), improvement, !past, null, null);
		}

		/** 예측이 닿지 않는 날. 점수 자리를 비우고 사유만 담는다. */
		public static DateOption unavailable(LocalDate date, DiagnosisGap gap) {
			return new DateOption(date, null, null, null, null, false, gap, gap.message());
		}
	}

	public static DateAlternativeResponse of(
			TimeOffStatus status,
			LocalDate selectedDate,
			Integer selectedQuietness,
			LocalDate bestDate,
			Integer bestImprovement,
			int minImprovement,
			List<DateOption> options) {

		CongestionLevel level =
				selectedQuietness == null ? null : CongestionLevel.fromQuietness(selectedQuietness);

		return new DateAlternativeResponse(
				status,
				status.message(),
				selectedDate,
				selectedQuietness,
				level,
				level == null ? null : level.label(),
				bestDate,
				bestImprovement,
				minImprovement,
				options);
	}
}
