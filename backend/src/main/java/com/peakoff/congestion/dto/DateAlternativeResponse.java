package com.peakoff.congestion.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;

/**
 * 더 한적한 날짜 제안.
 *
 * <p>선택한 날짜의 점수를 함께 내려보내는 이유: "이 날짜가 더 낫다"를 주장하려면
 * 비교 대상이 화면에 같이 있어야 한다. {@code improvement}가 그 차이다.
 *
 * @param alreadyQuietest 선택한 날짜보다 나은 날이 없을 때 true. 이때 {@code options}는 비어 있다
 */
public record DateAlternativeResponse(
		LocalDate selectedDate,
		int selectedQuietness,
		CongestionLevel selectedLevel,
		String selectedLevelLabel,
		boolean alreadyQuietest,
		List<DateOption> options) {

	/**
	 * @param improvement 선택 날짜 대비 한적도 증가폭. 클수록 덜 붐빈다
	 */
	public record DateOption(
			LocalDate date,
			int quietness,
			CongestionLevel level,
			String levelLabel,
			int improvement) {

		public static DateOption of(LocalDate date, int quietness, int selectedQuietness) {
			CongestionLevel level = CongestionLevel.fromQuietness(quietness);
			return new DateOption(date, quietness, level, level.label(), quietness - selectedQuietness);
		}
	}

	public static DateAlternativeResponse of(LocalDate selectedDate, int selectedQuietness,
			List<DateOption> options) {
		CongestionLevel level = CongestionLevel.fromQuietness(selectedQuietness);
		return new DateAlternativeResponse(
				selectedDate, selectedQuietness, level, level.label(), options.isEmpty(), options);
	}
}
