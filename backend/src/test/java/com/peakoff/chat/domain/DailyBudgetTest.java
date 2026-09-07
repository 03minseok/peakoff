package com.peakoff.chat.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 하루 전체 상한. <b>닿으면 조용히 꺼지고, 자정에 되돌아온다.</b>
 */
class DailyBudgetTest {

	/** 서울 시계. 날짜가 언제 바뀌는지가 이 클래스의 핵심이라 시간대를 고정해 둔다. */
	private static final class TestClock extends Clock {
		private Instant now = Instant.parse("2026-09-05T05:00:00Z");    // 서울 14:00

		void advance(Duration duration) {
			now = now.plus(duration);
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneId.of("Asia/Seoul");
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}
	}

	private final TestClock clock = new TestClock();
	private final DailyBudget budget = new DailyBudget(clock, 3);

	@Test
	@DisplayName("상한까지 쓰면 더 내주지 않는다")
	void stopsAtLimit() {
		for (int i = 0; i < 3; i++) {
			assertThat(budget.tryConsume()).isTrue();
		}
		assertThat(budget.tryConsume()).isFalse();
		assertThat(budget.remaining()).isZero();
	}

	@Test
	@DisplayName("자정이 지나면 되돌아온다 — 날짜는 서울 기준이다")
	void resetsAtLocalMidnight() {
		for (int i = 0; i < 3; i++) {
			budget.tryConsume();
		}
		assertThat(budget.tryConsume()).isFalse();

		/*
		 * 서울 14:00 → 다음 날 00:30. UTC 시계였다면 아직 같은 날(15:30 UTC)이라
		 * 저녁 내내 막혀 있었을 것이다.
		 */
		clock.advance(Duration.ofHours(10).plusMinutes(30));
		assertThat(budget.tryConsume()).isTrue();
		assertThat(budget.remaining()).isEqualTo(2);
	}

	@Test
	@DisplayName("들여다보는 것만으로는 줄지 않는다 — 화면이 상태를 물어도 자리를 뺏지 않는다")
	void peekDoesNotConsume() {
		assertThat(budget.hasRoom()).isTrue();
		assertThat(budget.hasRoom()).isTrue();
		assertThat(budget.remaining()).isEqualTo(3);
	}

	@Test
	@DisplayName("상한이 0이면 처음부터 꺼져 있다 — 설정으로 끌 수 있어야 한다")
	void zeroLimitIsAlwaysOff() {
		DailyBudget off = new DailyBudget(clock, 0);

		assertThat(off.hasRoom()).isFalse();
		assertThat(off.tryConsume()).isFalse();
	}

	@Test
	@DisplayName("동시에 물어도 합해서 상한을 넘지 않는다")
	void staysWithinLimitUnderConcurrency() throws InterruptedException {
		DailyBudget shared = new DailyBudget(clock, 50);
		java.util.concurrent.atomic.AtomicInteger granted = new java.util.concurrent.atomic.AtomicInteger();

		Thread[] threads = new Thread[8];
		for (int i = 0; i < threads.length; i++) {
			threads[i] = new Thread(() -> {
				for (int call = 0; call < 100; call++) {
					if (shared.tryConsume()) {
						granted.incrementAndGet();
					}
				}
			});
			threads[i].start();
		}
		for (Thread thread : threads) {
			thread.join();
		}

		// 800번을 두드렸지만 나간 자리는 정확히 50이다. 넘으면 크레딧이 그만큼 더 나간다.
		assertThat(granted.get()).isEqualTo(50);
	}
}
