package com.peakoff.chat.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/**
 * 질문이 가리키는 며칠. <b>서버가 만든 날짜</b>이지 모델이 준 날짜가 아니다.
 *
 * <p>{@link AskedPeriod}가 오늘을 기준으로 계산해 낸 결과이고, 여기서부터는
 * 예측을 세는 창으로 그대로 쓰인다.
 *
 * @param from 첫날(포함)
 * @param to   마지막 날(포함)
 */
public record DateRange(LocalDate from, LocalDate to) {

	public DateRange {
		Objects.requireNonNull(from, "첫날은 필수입니다.");
		Objects.requireNonNull(to, "마지막 날은 필수입니다.");
		if (to.isBefore(from)) {
			to = from;
		}
	}

	public int days() {
		return (int) ChronoUnit.DAYS.between(from, to) + 1;
	}

	/**
	 * 예측이 닿는 데까지만 자른다.
	 *
	 * <p>"이번 달 말"처럼 <b>시작은 창 안이고 끝이 창 밖</b>인 기간이 있다. 그대로 세면
	 * 뒤쪽 며칠은 자료가 없어 관측에 안 잡히는데, 그러면 <b>조용히 좁은 창</b>이 되어
	 * 화면에 적힌 기간과 실제로 센 기간이 어긋난다. 잘라서 <b>적은 대로만 센다</b>.
	 */
	public DateRange clampTo(LocalDate lastForecastDate) {
		return lastForecastDate == null || !to.isAfter(lastForecastDate)
				? this
				: new DateRange(from, lastForecastDate);
	}

	/**
	 * 화면에 적을 기간.
	 *
	 * <p>연도를 적지 않는다 — 예측이 닿는 곳은 길어야 한 달 뒤라 올해가 아닐 일이 없고,
	 * 말풍선 한 줄에 들어가야 한다.
	 */
	public String label() {
		if (from.equals(to)) {
			return "%d월 %d일".formatted(from.getMonthValue(), from.getDayOfMonth());
		}
		if (from.getMonthValue() == to.getMonthValue()) {
			// 달을 넘는 쪽("9월 28일~10월 4일")과 같은 결로 둔다. "9월 19~20일"은 한 글자를
			// 아끼는 대신 두 형태가 화면에 섞인다.
			return "%d월 %d일~%d일".formatted(
					from.getMonthValue(), from.getDayOfMonth(), to.getDayOfMonth());
		}
		return "%d월 %d일~%d월 %d일".formatted(
				from.getMonthValue(), from.getDayOfMonth(),
				to.getMonthValue(), to.getDayOfMonth());
	}
}
