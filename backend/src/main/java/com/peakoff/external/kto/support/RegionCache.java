package com.peakoff.external.kto.support;

import java.time.Clock;
import java.time.Duration;
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
 * <h3>알맹이는 {@link TtlCache}에 있다</h3>
 * 실패를 60초 기억하는 규칙까지 포함해서다. 장소 상세 캐시(콘텐츠 ID 단위)와 규칙을
 * 나눠 가지면 한쪽만 고쳐지므로, 여기는 지역을 열쇠 문자열로 바꿔 넘기는 껍데기만 남겼다.
 *
 * @param <T> 캐시할 자료 (예: 집중률 예측, 관광지 목록)
 */
public class RegionCache<T> {

	/** 공사 자료의 갱신 주기가 하루이므로 그보다 짧게 잡는다. */
	public static final Duration DEFAULT_TTL = Duration.ofHours(6);

	/** 지역은 셋뿐이라 상한이 무의미하지만, TtlCache가 요구하므로 넉넉히 준다. */
	private static final int MAX_REGIONS = 100;

	private final TtlCache<T> cache;

	public RegionCache(Clock clock) {
		this(clock, DEFAULT_TTL);
	}

	public RegionCache(Clock clock, Duration ttl) {
		this.cache = new TtlCache<>(clock, ttl, MAX_REGIONS);
	}

	/**
	 * 캐시가 살아 있으면 그 값을, 아니면 {@code loader}로 새로 받아 담는다.
	 *
	 * <p>호출이 실패하면 60초간 그 지역을 다시 부르지 않는다 — 수명 지난 옛 값이 있으면
	 * 그것을 돌려주고, 없으면 즉시 실패한다. 이유는 {@link TtlCache}에 적어 두었다.
	 */
	public T get(Region region, Function<Region, T> loader) {
		return cache.get(region.legalDongCode(), key -> loader.apply(region));
	}
}
