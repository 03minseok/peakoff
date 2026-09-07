package com.peakoff.chat.domain;

import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 창의 불변식.
 *
 * <p>여기서 잠그는 것은 <b>경계가 서버에 있다</b>는 사실이다. "예측할 수 있느냐"를
 * LLM에게 묻지 않고 창과 견주므로, 공사가 창을 늘리면 답도 따라 바뀌어야 한다.
 */
class ForecastWindowTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 9, 7);

	@Test
	@DisplayName("마지막 날까지 세어 창 길이를 낸다 — 오늘과 그날을 모두 포함한다")
	void countsBothEnds() {
		ForecastWindow window = ForecastWindow.of(TODAY, Optional.of(LocalDate.of(2026, 10, 6)));

		assertThat(window.days()).isEqualTo(30);
		assertThat(window.label()).isEqualTo("앞으로 30일");
	}

	@Test
	@DisplayName("마지막 날을 모르면 이레만 본다 — 모르는 채로 넓게 잡으면 없는 날짜를 세게 된다")
	void fallsBackToAWeek() {
		assertThat(ForecastWindow.of(TODAY, Optional.empty()).days()).isEqualTo(7);
	}

	/**
	 * 공사가 창을 늘렸다 줄였다 한 전례가 있다(24일 → 30일). 길이를 상수로 두지 않는 이유이고,
	 * 그래서 <b>같은 질문이 창에 따라 다르게 판정되는 것</b>이 정상이다.
	 */
	@Test
	@DisplayName("창이 늘면 같은 시점이 답할 수 있는 질문이 된다")
	void widerWindowCoversMore() {
		ForecastWindow narrow = ForecastWindow.of(TODAY, Optional.of(TODAY.plusDays(23)));
		ForecastWindow wide = ForecastWindow.of(TODAY, Optional.of(TODAY.plusDays(29)));

		assertThat(narrow.covers(27)).isFalse();
		assertThat(wide.covers(27)).isTrue();
	}

	@Test
	@DisplayName("시점이 안 드러난 질문은 창 밖이 아니다 — 가장 잘 답할 수 있는 질문이다")
	void unknownHorizonIsAlwaysCovered() {
		assertThat(ForecastWindow.of(TODAY, Optional.of(TODAY.plusDays(29))).covers(null)).isTrue();
	}

	@Test
	@DisplayName("마지막 날이 지났으면 창을 믿지 않는다 — 길이가 0이나 음수가 될 자리다")
	void staleLastDateFallsBack() {
		ForecastWindow window = ForecastWindow.of(TODAY, Optional.of(TODAY.minusDays(3)));

		assertThat(window.days()).isEqualTo(7);
	}
}
