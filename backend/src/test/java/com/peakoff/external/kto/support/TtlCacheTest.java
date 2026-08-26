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
