package com.peakoff.chat.domain;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 날짜를 만드는 규칙.
 *
 * <p>여기서 잠그는 것은 <b>모델이 아니라 서버가 달력을 본다</b>는 사실이다. 모델은
 * "3주 뒤 주말"에서 3과 WEEKEND를 꺼낼 뿐이고, 그것이 며칠인지는 전부 이 계산이 정한다.
 */
class AskedPeriodTest {

	/** 2026-09-08은 화요일이다. 그 주 토·일은 9/12·9/13. */
	private static final LocalDate TUESDAY = LocalDate.of(2026, 9, 8);

	private static Optional<DateRange> resolve(
			AskedPeriod.Anchor anchor, int offset, AskedPeriod.Part part) {
		return new AskedPeriod(anchor, offset, part, null, null).resolve(TUESDAY);
	}

	@Test
	@DisplayName("이번 주말은 그 주 토·일이다")
	void thisWeekend() {
		DateRange range = resolve(AskedPeriod.Anchor.WEEK, 0, AskedPeriod.Part.WEEKEND).orElseThrow();

		assertThat(range.from()).isEqualTo(LocalDate.of(2026, 9, 12));
		assertThat(range.to()).isEqualTo(LocalDate.of(2026, 9, 13));
		assertThat(range.days()).isEqualTo(2);
		assertThat(range.label()).isEqualTo("9월 12일~13일");
	}

	/**
	 * 문구 몇 개를 통째로 열거했다면 목록에 없어서 답하지 못했을 질문이다.
	 * 조각으로 받는 이유가 여기 있다.
	 */
	@Test
	@DisplayName("3주 뒤 주말도 셀 수 있다 — 조각이라 조합이 열린다")
	void weekendThreeWeeksOut() {
		DateRange range = resolve(AskedPeriod.Anchor.WEEK, 3, AskedPeriod.Part.WEEKEND).orElseThrow();

		assertThat(range.from()).isEqualTo(LocalDate.of(2026, 10, 3));
		assertThat(range.to()).isEqualTo(LocalDate.of(2026, 10, 4));
	}

	@Test
	@DisplayName("주는 월요일에 시작한다 — 다음 주 주말이 이번 주 토·일이 되면 안 된다")
	void weekStartsOnMonday() {
		DateRange next = resolve(AskedPeriod.Anchor.WEEK, 1, AskedPeriod.Part.WHOLE).orElseThrow();

		assertThat(next.from()).isEqualTo(LocalDate.of(2026, 9, 14));
		assertThat(next.to()).isEqualTo(LocalDate.of(2026, 9, 20));
	}

	/**
	 * 실측에서 <b>"10월 중순"이 9월 11~20일</b>로 나왔다. 모델은 오늘이 몇 월인지 모르니
	 * "10월"을 "몇 달 뒤"로 바꿀 수 없다 — 그래서 이름으로 말한 달은 그대로 받는다.
	 */
	@Test
	@DisplayName("달을 이름으로 말하면 그 달이다 — 몇 달 뒤인지 모델이 세지 않는다")
	void namedMonthIsNotCounted() {
		AskedPeriod october = new AskedPeriod(
				AskedPeriod.Anchor.MONTH, 0, AskedPeriod.Part.MID, 10, null);

		assertThat(october.resolve(TUESDAY).orElseThrow().label()).isEqualTo("10월 11일~20일");
	}

	@Test
	@DisplayName("이름으로 말한 달이 지났으면 내년이다 — 창 밖이라는 말은 창이 한다")
	void namedMonthRollsOver() {
		AskedPeriod march = new AskedPeriod(
				AskedPeriod.Anchor.MONTH, 0, AskedPeriod.Part.WHOLE, 3, null);

		assertThat(march.resolve(TUESDAY).orElseThrow().from())
				.isEqualTo(LocalDate.of(2027, 3, 1));
	}

	@Test
	@DisplayName("달은 초·중·말을 열흘씩 나눈다")
	void monthThirds() {
		assertThat(resolve(AskedPeriod.Anchor.MONTH, 0, AskedPeriod.Part.LATE).orElseThrow().label())
				.isEqualTo("9월 21일~30일");
		assertThat(resolve(AskedPeriod.Anchor.MONTH, 1, AskedPeriod.Part.MID).orElseThrow().label())
				.isEqualTo("10월 11일~20일");
	}

	@Test
	@DisplayName("이미 시작된 기간은 오늘부터 센다 — 지난 날짜에는 예측이 없다")
	void clampsToToday() {
		DateRange thisMonth = resolve(AskedPeriod.Anchor.MONTH, 0, AskedPeriod.Part.WHOLE).orElseThrow();

		assertThat(thisMonth.from()).isEqualTo(TUESDAY);
	}

	@Test
	@DisplayName("이미 지난 기간은 읽지 않은 것으로 둔다 — 엉뚱한 창을 잡느니 전체로 답한다")
	void pastPeriodIsDropped() {
		AskedPeriod lastWeek = new AskedPeriod(
				AskedPeriod.Anchor.DATE, 0, AskedPeriod.Part.WHOLE, null, MonthDay.of(9, 1));

		// 9월 1일은 지났으므로 내년 9월 1일이 된다 — 창 밖이지만 "지난 기간"은 아니다.
		assertThat(lastWeek.resolve(TUESDAY)).isPresent();
		assertThat(lastWeek.resolve(TUESDAY).orElseThrow().from().getYear()).isEqualTo(2027);
	}

	@Test
	@DisplayName("기간을 못 읽었으면 빈 값이다 — 그때는 예측 전체로 답한다")
	void noneResolvesToNothing() {
		assertThat(AskedPeriod.NONE.resolve(TUESDAY)).isEmpty();
	}

	@Test
	@DisplayName("날짜를 집었다면서 날짜가 없으면 읽지 못한 것으로 다룬다")
	void dateWithoutDateIsNone() {
		AskedPeriod broken = new AskedPeriod(
				AskedPeriod.Anchor.DATE, 0, AskedPeriod.Part.WHOLE, null, null);

		assertThat(broken.anchor()).isEqualTo(AskedPeriod.Anchor.NONE);
		assertThat(broken.resolve(TUESDAY)).isEmpty();
	}

	@Test
	@DisplayName("창 밖으로 넘치는 끝은 잘라 센다 — 적은 기간과 센 기간이 어긋나면 안 된다")
	void clampsToForecastEnd() {
		DateRange month = resolve(AskedPeriod.Anchor.MONTH, 1, AskedPeriod.Part.WHOLE).orElseThrow();

		DateRange counted = month.clampTo(LocalDate.of(2026, 10, 7));

		assertThat(counted.to()).isEqualTo(LocalDate.of(2026, 10, 7));
		assertThat(counted.label()).isEqualTo("10월 1일~7일");
	}
}
