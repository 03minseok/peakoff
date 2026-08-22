package com.peakoff.external.kto;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

import com.peakoff.place.domain.Region;

/**
 * 지역 단위로 받아온 공사 자료를 잠시 들고 있는다.
 *
 * <h3>왜 캐시하는가</h3>
 * 공사 자료는 하루 한 번 갱신된다. 진단 한 번에 필요한 조회가 (장소 수 × 날짜 수)인데
 * 그때마다 부르면 호출이 수십 번으로 불어나고, 그만큼 <b>사용자가 기다린다.</b>
 *
 * <h3>캐시는 호출을 대체하는 장치가 아니다</h3>
 * TTL이 지나면 다시 부른다. 자료를 DB에 적재해 사실상 호출하지 않는 구조는 공모전
 * 규칙 위반이다. 6시간은 갱신 주기(하루)보다 짧게 잡은 값이다.
 *
 * <h3>왜 스프링 캐시를 쓰지 않는가</h3>
 * TTL을 주려면 캐시 구현체(Caffeine 등)를 의존성으로 더해야 한다. 여기서 필요한 것은
 * "지역 하나에 값 하나, 6시간"이 전부라, 직접 두는 편이 의존성도 설정도 적다.
 *
 * @param <T> 캐시할 자료 (예: 집중률 예측, 관광지 목록)
 */
public class RegionCache<T> {

	/** 공사 자료의 갱신 주기가 하루이므로 그보다 짧게 잡는다. */
	public static final Duration DEFAULT_TTL = Duration.ofHours(6);

	private final Clock clock;
	private final Duration ttl;
	private final Map<String, Entry<T>> entries = new ConcurrentHashMap<>();

	private record Entry<T>(T value, Instant fetchedAt) {
	}

	public RegionCache(Clock clock) {
		this(clock, DEFAULT_TTL);
	}

	public RegionCache(Clock clock, Duration ttl) {
		this.clock = clock;
		this.ttl = ttl;
	}

	/**
	 * 캐시가 살아 있으면 그 값을, 아니면 {@code loader}로 새로 받아 담는다.
	 *
	 * <p>동시에 여러 요청이 들어오면 같은 지역을 두 번 부를 수 있다. 잠그지 않은 이유는
	 * 첫 호출이 느릴 때 뒤따르는 요청이 모두 멈추기 때문이다 — 최악이 <b>중복 호출 한 번</b>이라
	 * 그대로 둔다.
	 */
	public T get(Region region, Function<Region, T> loader) {
		String key = region.legalDongCode();
		Entry<T> cached = entries.get(key);
		if (cached != null && !isExpired(cached)) {
			return cached.value();
		}
		T fresh = loader.apply(region);
		entries.put(key, new Entry<>(fresh, clock.instant()));
		return fresh;
	}

	private boolean isExpired(Entry<T> entry) {
		return Duration.between(entry.fetchedAt(), clock.instant()).compareTo(ttl) >= 0;
	}
}
