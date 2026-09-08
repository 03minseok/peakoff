package com.peakoff.chat.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;

/**
 * 질문이 가리키는 기간을 <b>조각으로</b> 받아 둔 것. 날짜로 바꾸는 일은 여기서 한다.
 *
 * <h2>왜 조각인가 — 모델에게 날짜 산수를 시키지 않는다</h2>
 * 처음에는 모델에게 "며칠 뒤냐"를 숫자 하나로 물었다. 실측에서 <b>"10월 중순"을 45일</b>로
 * 읽었는데(실제 38일), 당연한 결과다 — <b>오늘이 며칠인지 알려준 적이 없다.</b>
 * 답할 수 없는 것을 물어본 셈이다.
 *
 * <p>그 숫자는 창 안/밖을 가르는 <b>문</b>으로만 쓰였으므로 어림수여도 판정이 틀리지 않았다.
 * 그런데 창을 <b>그 기간으로 옮기면</b> 틀린 날짜로 계산하게 된다.
 *
 * <p>그래서 모델은 <b>읽기만</b> 한다. "3주 뒤 주말"에서 3과 WEEKEND를 꺼내는 것은
 * 산수가 아니라 파싱이다. 오늘이 며칠인지 · 그 주 토요일이 몇 일인지 · 10월이 며칠까지인지는
 * 전부 이 클래스가 계산한다. {@link Interest}를 enum으로 닫아 둔 것과 같은 규칙이다 —
 * <b>LLM이 할 수 있는 일은 고르기까지다.</b>
 *
 * <h2>조각이라서 조합이 열린다</h2>
 * <pre>
 *   이번 주말      WEEK  0 WEEKEND
 *   3주 뒤 주말    WEEK  3 WEEKEND
 *   다음 주        WEEK  1 WHOLE
 *   이번 달 말     MONTH 0 LATE
 *   10월 중순      MONTH   MID  (month=10)
 *   9월 12일에     DATE         (date=09-12)
 * </pre>
 * 문구 몇 개를 통째로 열거하는 방식이었다면 "3주 뒤 주말"이 목록에 없어 답하지 못한다.
 *
 * <h2>⚠️ 못 읽는 것은 못 읽는다고 둔다</h2>
 * "단풍철"·"추석 연휴" 같은 이름은 서버 달력에 없어 <b>모델 지식</b>에 기대야 하는데,
 * 그것은 우리가 검증할 방법이 없다. 그런 질문은 {@code NONE}으로 흘려보내
 * 지금까지처럼 예측 전체 기간으로 답한다 — <b>모르는 채로 좁히는 것보다 넓게 답하는 편</b>이
 * 낫다.
 *
 * <h2>⚠️ 상대로 말한 것과 이름으로 말한 것을 <b>다른 칸</b>으로 받는다</h2>
 * 처음에는 달도 {@code offset}으로만 받았다. 실측에서 <b>"10월 중순"이 9월 11~20일</b>이
 * 됐다 — 모델은 오늘이 몇 월인지 모르니 "10월"을 "몇 달 뒤"로 바꿀 수 없다.
 * 바꾸게 하면 그것이 곧 <b>우리가 피하려던 산수</b>다.
 *
 * <p>그래서 이름으로 말한 달은 {@code month}에 <b>그대로</b> 받는다. 모델은 "10월"에서
 * 10을 읽을 뿐이고, 그게 올해인지 내년인지는 서버가 정한다 — {@code date}의 연도를
 * 서버가 정하는 것과 같다.
 *
 * @param anchor 무엇을 기준으로 세는가
 * @param offset 몇 개 뒤인가. 이번=0, 다음=1, 3주 뒤=3. {@code month}가 있으면 안 쓴다
 * @param part   그 안의 어느 부분인가
 * @param month  달을 <b>이름으로</b> 말했을 때 그 달(1~12). 상대로 말했으면 {@code null}
 * @param date   {@code DATE}일 때 그 날짜(월·일). 연도는 서버가 정한다
 */
public record AskedPeriod(Anchor anchor, int offset, Part part, Integer month, MonthDay date) {

	/** 무엇을 기준으로 세는가. */
	public enum Anchor {
		WEEK,
		MONTH,
		/** 날짜를 콕 집어 말했다. 산수가 없으므로 모델이 읽은 값을 그대로 쓴다 */
		DATE,
		/** 기간이 안 드러났거나 우리가 못 읽는 말이다 */
		NONE
	}

	/** 그 주·달의 어느 부분인가. */
	public enum Part {
		WEEKEND,
		EARLY,
		MID,
		LATE,
		WHOLE
	}

	/**
	 * 몇 개 뒤까지 읽을 것인가.
	 *
	 * <p>예측이 길어야 한 달이라 그보다 먼 것은 어차피 창 밖이다. 다만 <b>여기서 자르지
	 * 않는다</b> — 창 밖이라는 판정은 {@link ForecastWindow}가 하고, 여기서 미리 막으면
	 * "두 달 뒤"가 기간 없는 질문이 되어 <b>지금 기간의 답을 받는다.</b>
	 * 터무니없는 값만 걸러 달력 계산이 이상한 해로 넘어가지 않게 한다.
	 */
	private static final int MAX_OFFSET = 120;

	/** 기간이 안 드러난 질문. */
	public static final AskedPeriod NONE =
			new AskedPeriod(Anchor.NONE, 0, Part.WHOLE, null, null);

	public AskedPeriod {
		if (anchor == null) {
			anchor = Anchor.NONE;
		}
		if (part == null) {
			part = Part.WHOLE;
		}
		if (offset < 0 || offset > MAX_OFFSET) {
			offset = 0;
		}
		if (month != null && (month < 1 || month > 12)) {
			month = null;
		}
		if (anchor == Anchor.DATE && date == null) {
			// 날짜를 집었다면서 날짜가 없다. 읽지 못한 것으로 다룬다.
			anchor = Anchor.NONE;
		}
	}

	/**
	 * 오늘을 기준으로 실제 날짜를 만든다.
	 *
	 * @return 질문이 기간을 가리키지 않았거나 <b>이미 지난 기간</b>이면 빈 값.
	 *         지난 기간을 창으로 삼으면 자료가 없어 답이 통째로 비는데, 그것은
	 *         "예측이 없다"가 아니라 <b>우리가 엉뚱한 창을 잡은 것</b>이다
	 */
	public Optional<DateRange> resolve(LocalDate today) {
		DateRange range = switch (anchor) {
			case WEEK -> weekRange(today);
			case MONTH -> monthRange(today);
			case DATE -> dateRange(today);
			case NONE -> null;
		};
		if (range == null || range.to().isBefore(today)) {
			return Optional.empty();
		}
		// 오늘 이전은 잘라낸다. "이번 주말"을 토요일에 물으면 토·일 중 토요일부터다.
		return Optional.of(new DateRange(
				range.from().isBefore(today) ? today : range.from(), range.to()));
	}

	/**
	 * 주 단위.
	 *
	 * <p>주의 시작은 <b>월요일</b>이다. "다음 주 주말"이 이번 주 토·일이 되지 않으려면
	 * 한국에서 쓰는 주와 같아야 한다.
	 */
	private DateRange weekRange(LocalDate today) {
		LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
				.plusWeeks(offset);
		return part == Part.WEEKEND
				? new DateRange(monday.plusDays(5), monday.plusDays(6))
				: new DateRange(monday, monday.plusDays(6));
	}

	/**
	 * 달 단위. 초·중·말을 <b>10일씩</b> 나눈다.
	 *
	 * <p>말일이 30일이든 31일이든 "말"은 21일부터다 — 며칠로 나누든 자의적인데,
	 * 열흘씩이 사람이 쓰는 말("초순·중순·하순")과 가장 가깝다.
	 */
	private DateRange monthRange(LocalDate today) {
		LocalDate first = month != null ? namedMonth(today) : today.withDayOfMonth(1).plusMonths(offset);
		int last = first.lengthOfMonth();
		return switch (part) {
			case EARLY -> new DateRange(first, first.withDayOfMonth(Math.min(10, last)));
			case MID -> new DateRange(first.withDayOfMonth(Math.min(11, last)),
					first.withDayOfMonth(Math.min(20, last)));
			case LATE -> new DateRange(first.withDayOfMonth(Math.min(21, last)),
					first.withDayOfMonth(last));
			// 달을 통째로 물었거나(WHOLE), 달에는 뜻이 없는 부분(WEEKEND)이 왔다.
			default -> new DateRange(first, first.withDayOfMonth(last));
		};
	}

	/**
	 * 이름으로 말한 달의 1일.
	 *
	 * <p>연도는 서버가 정한다 — 그 달이 이미 지났으면 내년이다. 예측이 한 달치뿐이라
	 * 내년은 결국 창 밖이지만, <b>여기서 미리 자르지 않는다.</b> 창 밖이라는 말은
	 * {@link ForecastWindow}가 해야 화면이 "아직 예측이 없다"고 정확히 답한다.
	 */
	private LocalDate namedMonth(LocalDate today) {
		LocalDate thisYear = today.withMonth(month).withDayOfMonth(1);
		return thisYear.plusMonths(1).isAfter(today.withDayOfMonth(1))
				? thisYear
				: thisYear.plusYears(1);
	}

	/**
	 * 날짜 하나.
	 *
	 * <p>연도는 <b>서버가 정한다.</b> 사람은 "9월 12일"이라고만 말하고, 그 날짜가 이미
	 * 지났으면 내년을 뜻한다 — 다만 그때는 창 밖이라 결국 "아직"이라는 답이 나간다.
	 */
	private DateRange dateRange(LocalDate today) {
		LocalDate thisYear = date.atYear(today.getYear());
		LocalDate resolved = thisYear.isBefore(today) ? date.atYear(today.getYear() + 1) : thisYear;
		return new DateRange(resolved, resolved);
	}
}
