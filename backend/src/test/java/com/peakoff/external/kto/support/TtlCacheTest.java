package com.peakoff.external.kto.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 실패 백오프를 잠근다.
 *
 * <p>이 규칙이 사라지면 무슨 일이 나는지는 이미 겪었다(2026-08-26) — 공사 일일 한도에
 * 걸린 뒤에도 요청마다 호출이 그대로 나가, 실패 호출 1,912번이 다음 날 치 한도까지 태웠다.
 * 실패하는 호출도 한도를 소모한다.
 */
class TtlCacheTest {

	/** 시간을 손으로 감는 시계. 백오프·TTL은 흐른 시간이 조건이라 진짜 시계로는 못 잰다. */
	private static final class TestClock extends Clock {
		private Instant now = Instant.parse("2026-08-26T00:00:00Z");

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
	private final TtlCache<String> cache = new TtlCache<>(clock, Duration.ofHours(6), 100);
	private final AtomicInteger calls = new AtomicInteger();

	private String failingLoader(String key) {
		calls.incrementAndGet();
		throw new KtoApiException("한도 초과");
	}

	@Test
	@DisplayName("실패하면 백오프 동안 다시 부르지 않는다 — 실패 호출도 한도를 소모한다")
	void doesNotRetryWithinBackoff() {
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(KtoApiException.class);
		assertThat(calls.get()).isEqualTo(1);

		// 30초 뒤 다시 물어도 loader는 조용하다. 즉시 실패만 돌려준다.
		clock.advance(Duration.ofSeconds(30));
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(KtoApiException.class);
		assertThat(calls.get()).isEqualTo(1);
	}

	@Test
	@DisplayName("백오프가 지나면 다시 시도한다 — 회복은 자동이어야 한다")
	void retriesAfterBackoff() {
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(KtoApiException.class);

		clock.advance(TtlCache.FAILURE_BACKOFF);
		assertThat(cache.get("gyeongju", key -> "회복된 값")).isEqualTo("회복된 값");
	}

	/**
	 * 공사 자료는 하루 한 번 갱신된다. 6시간 지난 값이라도 빈 화면·500보다 낫다 —
	 * 심사 데모 중 공사가 흔들려도 화면은 서 있어야 한다.
	 */
	@Test
	@DisplayName("갱신에 실패하면 백오프 동안 수명 지난 옛 값을 돌려준다")
	void servesStaleDuringBackoff() {
		assertThat(cache.get("gyeongju", key -> "어제 값")).isEqualTo("어제 값");

		// TTL이 지나 갱신을 시도하는데 공사가 죽어 있다.
		clock.advance(Duration.ofHours(7));
		assertThat(cache.get("gyeongju", this::failingLoader)).isEqualTo("어제 값");
		assertThat(calls.get()).isEqualTo(1);

		// 백오프 안의 다음 요청은 호출 없이 옛 값을 받는다.
		clock.advance(Duration.ofSeconds(10));
		assertThat(cache.get("gyeongju", this::failingLoader)).isEqualTo("어제 값");
		assertThat(calls.get()).isEqualTo(1);
	}

	/**
	 * 메꾸기는 <b>잠깐 끊길 때</b>를 위한 것이다. 오래 쓰면 두 가지가 조용히 망가진다 —
	 * 예측 창이 짧아지는데 화면은 아무 말도 안 하고, "물어보는 서비스"인지 "받아 둔 것을
	 * 보여주는 서비스"인지 경계가 흐려진다(TtlCache.MAX_STALE 주석).
	 */
	@Test
	@DisplayName("너무 오래된 값으로는 메꾸지 않는다 — 사흘이 한도다")
	void refusesTooStaleValues() {
		assertThat(cache.get("gyeongju", key -> "사흘 전 값")).isEqualTo("사흘 전 값");

		// 이틀째: 아직 메꾼다.
		clock.advance(Duration.ofDays(2));
		assertThat(cache.get("gyeongju", this::failingLoader)).isEqualTo("사흘 전 값");

		// 사흘째: 옛 값을 버리고 정직하게 실패한다.
		clock.advance(Duration.ofDays(1));
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(RuntimeException.class);
	}

	/**
	 * 공사가 <b>200에 항목 0건</b>을 주는 일이 있다(2026-09-08 여수). 오류가 아니라 정상
	 * 응답이라 그대로 담으면 멀쩡하던 옛 값을 우리 손으로 지우게 된다.
	 *
	 * <p>⚠️ 그렇다고 예외를 던지지는 않는다 — 한 번 그렇게 해 봤더니 지역 하나가 비었다는
	 * 이유로 챗봇 전체가 오류가 됐다. 옛 값이 없으면 빈 값을 그대로 돌려준다.
	 */
	@Test
	@DisplayName("빈 응답은 멀쩡한 옛 값을 밀어내지 못한다")
	void uselessValueDoesNotEvictGoodOne() {
		TtlCache<String> cache = new TtlCache<>(clock, Duration.ofHours(6), 10, value -> !value.isEmpty());

		assertThat(cache.get("yeosu", key -> "97곳")).isEqualTo("97곳");

		// 수명이 지나 다시 부르는데 공사가 빈 응답을 준다.
		clock.advance(Duration.ofHours(7));
		assertThat(cache.get("yeosu", key -> "")).isEqualTo("97곳");

		// 공사가 돌아오면 자동으로 새 값으로 갈아끼워진다.
		clock.advance(Duration.ofMinutes(2));
		assertThat(cache.get("yeosu", key -> "99곳")).isEqualTo("99곳");
	}

	@Test
	@DisplayName("지킬 옛 값이 없으면 빈 응답이라도 그대로 돌려준다 — 그 지역만 조용히 빠진다")
	void uselessValuePassesThroughWithoutHistory() {
		TtlCache<String> cache = new TtlCache<>(clock, Duration.ofHours(6), 10, value -> !value.isEmpty());

		assertThat(cache.get("yeosu", key -> "")).isEmpty();
	}

	@Test
	@DisplayName("성공하면 실패의 기억이 지워진다")
	void successClearsFailure() {
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(KtoApiException.class);

		clock.advance(TtlCache.FAILURE_BACKOFF);
		assertThat(cache.get("gyeongju", key -> "성공")).isEqualTo("성공");

		// 기억이 남아 있었다면 여기서 백오프가 다시 걸렸을 것이다.
		clock.advance(Duration.ofHours(7));
		assertThat(cache.get("gyeongju", key -> "다음 값")).isEqualTo("다음 값");
	}

	@Test
	@DisplayName("실패는 열쇠별이다 — 한 지역이 죽어도 다른 지역은 그대로 돈다")
	void backoffIsPerKey() {
		assertThatThrownBy(() -> cache.get("gyeongju", this::failingLoader))
				.isInstanceOf(KtoApiException.class);

		assertThat(cache.get("jeju", key -> "제주 값")).isEqualTo("제주 값");
	}

	@Test
	@DisplayName("상한을 넘으면 통째로 비운다 — 없는 ID가 캐시를 채우지 못한다")
	void evictsWhenFull() {
		TtlCache<String> small = new TtlCache<>(clock, Duration.ofHours(6), 3);
		for (int i = 0; i < 3; i++) {
			small.get("id-" + i, key -> "값");
		}

		AtomicInteger reloaded = new AtomicInteger();
		small.get("id-3", key -> "새 값");                       // 여기서 비워지고 담긴다
		small.get("id-0", key -> { reloaded.incrementAndGet(); return "다시"; });

		assertThat(reloaded.get()).isEqualTo(1);                 // id-0은 비워졌으므로 다시 부른다
		assertThat(small.get("id-3", key -> "안 불림")).isEqualTo("새 값");
	}
}
