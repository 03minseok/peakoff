package com.peakoff.congestion.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;

/**
 * 기준 날짜 앞뒤 창의 날짜별 한적도.
 *
 * <p>선택한 날짜의 점수를 함께 내려보내는 이유: "이 날짜가 더 낫다"를 주장하려면
 * 비교 대상이 화면에 같이 있어야 한다. {@code improvement}가 그 차이다.
 *
 * @param options         창 안의 모든 날짜(기준일 제외). <b>더 붐비는 날도 들어 있다.</b>
 *                        되돌아갈 날짜와 비교 대상이 함께 있어야 화면이 표로 성립한다
 * @param alreadyQuietest 창 안에 더 나은 날이 하나도 없을 때 true.
 *                        <b>목록이 비었다는 뜻이 아니다</b> — 목록은 늘 채워져 있고,
 *                        그중 개선되는 날이 없다는 뜻이다
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
			int quietness, //한적도?
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
		/*
		 * 예전에는 options.isEmpty()가 곧 "더 나은 날이 없다"였다. 서버가 개선되는 날만
		 * 걸러 보냈기 때문이다. 이제는 창 안의 모든 날을 보내므로 목록이 비는 일이 없어,
		 * 그대로 두면 이 값이 영원히 false가 된다. 뜻을 지키려면 직접 세어야 한다.
		 */
		boolean alreadyQuietest = options.stream().noneMatch(option -> option.improvement() > 0);
		return new DateAlternativeResponse(
				selectedDate, selectedQuietness, level, level.label(), alreadyQuietest, options);
	}
}
