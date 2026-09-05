package com.peakoff.chat.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 연타를 막되 정상 사용자는 통과시킨다.
 *
 * <p>여기서 잠그는 것은 <b>크레딧</b>이다. 챗봇 한 번이 유료 호출이라, 이 규칙이 새면
 * 심사 기간 중에 버튼 연타만으로 서비스가 멈출 수 있다.
 */
class CallLimiterTest {

	/** 시간을 손으로 감는 시계. 미끄러지는 창은 흐른 시간이 조건이라 진짜 시계로는 못 잰다. */
	private static final class TestClock extends Clock {
		private Instant now = Instant.parse("2026-09-05T09:00:00Z");

		void advance(Duration duration) {
			now = now.plus(duration);
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneId.of("UTC");
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}
	}

	private final TestClock clock = new TestClock();
	private final CallLimiter limiter = new CallLimiter(clock, 3, Duration.ofMinutes(5));

	@Test
	@DisplayName("상한까지는 통과하고 그 다음이 막힌다")
	void allowsUpToLimit() {
		for (int i = 0; i < 3; i++) {
			assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isTrue();
		}
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isFalse();
	}

	@Test
	@DisplayName("창이 미끄러진다 — 가장 오래된 것이 빠지면 그만큼만 열린다")
	void windowSlides() {
		limiter.tryAcquire("ip:1.1.1.1");                       // 0분
		clock.advance(Duration.ofMinutes(2));
		limiter.tryAcquire("ip:1.1.1.1");                       // 2분
		limiter.tryAcquire("ip:1.1.1.1");                       // 2분
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isFalse();

		/*
		 * 5분 1초 지점 — 첫 번째 것만 창을 벗어난다. 고정 구간이었다면 여기서 셋이 한꺼번에
		 * 열려 "5분에 3회"가 잠깐 6회가 됐을 것이다.
		 */
		clock.advance(Duration.ofMinutes(3).plusSeconds(1));
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isTrue();
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isFalse();
	}

	@Test
	@DisplayName("막힌 호출은 세지 않는다 — 자동 재시도가 있어도 제때 풀린다")
	void deniedCallsDoNotExtendTheBlock() {
		for (int i = 0; i < 3; i++) {
			limiter.tryAcquire("ip:1.1.1.1");
		}
		// 화면이 실패를 되풀이해 두드리는 상황. 이것까지 세면 창이 계속 새로 채워진다.
		for (int i = 0; i < 20; i++) {
			clock.advance(Duration.ofSeconds(10));
			assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isFalse();
		}

		// 첫 통과로부터 5분이 지난 시점. 두드린 것과 무관하게 자리가 난다.
		clock.advance(Duration.ofMinutes(5));
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isTrue();
	}

	@Test
	@DisplayName("막히면 몇 초 뒤에 되는지 함께 알려준다")
	void tellsWhenToRetry() {
		for (int i = 0; i < 3; i++) {
			limiter.tryAcquire("ip:1.1.1.1");
		}
		clock.advance(Duration.ofMinutes(1));

		CallLimiter.Verdict verdict = limiter.tryAcquire("ip:1.1.1.1");
		assertThat(verdict.allowed()).isFalse();
		assertThat(verdict.retryAfterSeconds()).isEqualTo(240);      // 5분 − 1분
	}

	@Test
	@DisplayName("남은 시간이 1초 미만이어도 0초라 하지 않는다 — 화면이 곧장 다시 부른다")
	void neverTellsZeroSeconds() {
		for (int i = 0; i < 3; i++) {
			limiter.tryAcquire("ip:1.1.1.1");
		}
		clock.advance(Duration.ofMinutes(5).minusMillis(200));

		assertThat(limiter.tryAcquire("ip:1.1.1.1").retryAfterSeconds()).isEqualTo(1);
	}

	@Test
	@DisplayName("열쇠마다 따로 센다 — 한 사람이 남의 자리를 쓰지 못한다")
	void countsPerKey() {
		for (int i = 0; i < 3; i++) {
			limiter.tryAcquire("ip:1.1.1.1");
		}
		assertThat(limiter.tryAcquire("ip:1.1.1.1").allowed()).isFalse();

		assertThat(limiter.tryAcquire("ip:2.2.2.2").allowed()).isTrue();
		assertThat(limiter.tryAcquire("member:7").allowed()).isTrue();
	}

	@Test
	@DisplayName("열쇠가 넘치면 죽은 것부터 버린다 — 주소를 바꿔 두드려도 남의 제한이 안 풀린다")
	void evictsDeadKeysFirst() {
		CallLimiter small = new CallLimiter(clock, 1, Duration.ofMinutes(5));

		// 주소를 바꿔 가며 두드려 열쇠를 상한 가까이 채운다.
		for (int i = 0; i < CallLimiter.MAX_KEYS - 1; i++) {
			small.tryAcquire("ip:flood-" + i);
		}

		// 6분 뒤 — 위의 것들은 전부 창을 벗어나 "죽은" 열쇠가 됐다. 피해자는 지금 한도를 쓴다.
		clock.advance(Duration.ofMinutes(6));
		assertThat(small.tryAcquire("ip:victim").allowed()).isTrue();

		// 여기서 열쇠 수가 상한에 닿아 청소가 돈다. 죽은 것만 버려야 한다.
		small.tryAcquire("ip:trigger");

		/*
		 * 통째로 비우는 구현이었다면 피해자의 기록도 함께 사라져 이 호출이 통과한다 —
		 * 즉 <b>남의 주소를 잔뜩 만드는 것만으로 남의 제한을 풀어줄</b> 수 있다.
		 */
		assertThat(small.tryAcquire("ip:victim").allowed()).isFalse();
	}
}
