package com.peakoff.chat.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * 챗봇이 보는 기간. <b>길이를 코드에 박지 않는다.</b>
 *
 * <h2>왜 7일에서 창 전체로 넓혔나 (2026-09-07)</h2>
 * 처음에는 "이번 주" 7일이었다. 그런데 사용자가 챗봇에 묻는 것은 <b>다음 주말</b>이거나
 * <b>추석 연휴</b>이지 오늘부터 이레가 아니다. 공사가 한 달치를 주는데 그중 이레만 보고
 * 답하면, 나머지 스무 날 남짓을 <b>가진 채로 안 쓰는</b> 것이다.
 *
 * <p>넓혀도 카드가 서로 구분되는지 먼저 쟀다(2026-09-05 스냅샷, 11개 지역):
 *
 * <pre>
 *                   7일 창        전체 창(30일)
 *   통영             64.7%    →     51.6%
 *   경주             48.2%    →     37.0%
 *   제주시           21.6%    →     16.6%
 *   폭               43.1          34.9      ← 좁아지되 살아 있다
 * </pre>
 *
 * 순위도 거의 그대로였다(태안·충주만 자리를 바꿨다). 값이 일제히 10%p쯤 내려가는 것은
 * <b>붐비는 날이 더 섞이기 때문</b>이고, 카드가 모수를 함께 적으므로 거짓이 되지 않는다.
 *
 * <h2>⚠️ 열한 곳이 <b>같은 창</b>을 본다</h2>
 * {@code CongestionProvider.lastForecastDate()}는 지역들 중 <b>가장 이른</b> 마지막 날을 준다.
 * 지역마다 제 창을 쓰면 창이 긴 지역에 붐비는 날이 더 섞여 <b>덜 한적한 것처럼</b> 보인다 —
 * 자료 사정이 순위를 바꾸는 것이라, 견주는 화면에서는 그것이 곧 거짓말이다.
 *
 * <h2>길이는 관측값이지 약속이 아니다</h2>
 * 실측에서 24일(2026-08-21)이었다가 30일(2026-08-30)이 됐다. 그래서 여기서도
 * 상수로 두지 않고 <b>실제 응답에서 읽은 마지막 날</b>로 만든다. 창이 늘면
 * 보는 기간도 · 화면 문구도 · 아래 {@link #covers} 판정도 함께 따라 움직인다.
 *
 * @param from 첫날(포함). 오늘이다
 * @param days 며칠을 보는가. 언제나 1 이상이다
 */
public record ForecastWindow(LocalDate from, int days) {

	/**
	 * 마지막 날을 모를 때 쓸 길이.
	 *
	 * <p>목업 구간이거나 공사가 흔들려 창을 못 읽은 때다. <b>넓게 잡지 않는다</b> —
	 * 모르는 채로 한 달을 보겠다고 하면 없는 날짜를 세는 셈이고, 그 며칠이
	 * 관측에 안 잡히므로 조용히 좁은 창이 된다. 차라리 이레만 본다고 말하는 편이 정직하다.
	 */
	private static final int FALLBACK_DAYS = 7;

	public ForecastWindow {
		if (days < 1) {
			days = 1;
		}
	}

	/**
	 * @param today    오늘
	 * @param lastDate 예측이 닿는 마지막 날. <b>비어 있을 수 있다</b>
	 */
	public static ForecastWindow of(LocalDate today, Optional<LocalDate> lastDate) {
		return lastDate
				.filter(last -> !last.isBefore(today))
				.map(last -> new ForecastWindow(today, (int) ChronoUnit.DAYS.between(today, last) + 1))
				.orElseGet(() -> new ForecastWindow(today, FALLBACK_DAYS));
	}

	/**
	 * 화면이 "어느 기간을 본 값인지" 말할 때 쓰는 말.
	 *
	 * <h3>⚠️ "요즘"이라고 하지 않는다</h3>
	 * 사용자가 부르는 말은 "요즘"이지만 화면이 그렇게 적으면 <b>시점을 주장하는 말</b>이 된다.
	 * 공사 자료는 예측이고, 우리가 실제로 아는 것은 <b>며칠까지인지</b>다. 그 며칠을 그대로
	 * 적으면 근거가 화면에 남고, 창이 늘거나 줄면 문구도 함께 움직인다.
	 *
	 * <p>{@code RegionCards}가 LLM 문장에서 "요즘"·"지금"을 막는 것과 <b>같은 규칙</b>이다.
	 * 서버만 쓰고 LLM은 못 쓰는 말을 두면, 같은 카드 안에서 두 문장이 서로 어긋난다.
	 */
	public String label() {
		return "앞으로 %d일".formatted(days);
	}

	/** 예측이 닿는 마지막 날(포함). */
	public LocalDate lastDate() {
		return from.plusDays(days - 1L);
	}

	/**
	 * 그날이 창 안인가.
	 *
	 * <p>{@link #covers(Integer)}가 어림수를 받는 자리라면 이쪽은 <b>서버가 계산해 낸
	 * 날짜</b>를 받는 자리다. 기간을 읽어낸 질문은 이쪽으로 판정한다 — 모델의 어림수보다
	 * 우리 달력이 정확하다.
	 */
	public boolean covers(LocalDate date) {
		return date != null && !date.isAfter(lastDate());
	}

	/**
	 * 그만큼 뒤를 이 창이 덮는가.
	 *
	 * <p>⚠️ <b>이 판정이 서버에 있는 것이 핵심이다.</b> LLM에게 "예측할 수 있느냐"를 묻지
	 * 않는다 — 그것은 모델이 알 수 없는 <b>우리 자료 사정</b>이고, 창이 24일에서 30일로
	 * 늘면 답도 따라 바뀌어야 한다. 모델이 하는 일은 "두 달 뒤 ≈ 60"까지다.
	 *
	 * <p>⚠️ 이름을 {@link #covers(LocalDate)}와 <b>가른다.</b> 한 이름으로 두면
	 * {@code covers(null)}이 어느 쪽인지 모호해지고, 무엇보다 <b>다른 일</b>이다 —
	 * 이쪽은 모델의 어림수를 받고 저쪽은 우리가 계산한 날짜를 받는다.
	 *
	 * @param daysAhead 질문이 가리키는 시점까지 대략 며칠 뒤인가. 모르면 {@code null}
	 * @return 모르면 <b>참</b>이다. 시점이 안 드러난 질문("어디가 한산해요?")을
	 *         창 밖이라고 물리치면, 가장 잘 답할 수 있는 질문을 거절하게 된다
	 */
	public boolean coversHorizon(Integer daysAhead) {
		return daysAhead == null || daysAhead < days;
	}
}
