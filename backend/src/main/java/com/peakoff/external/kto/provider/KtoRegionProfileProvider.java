package com.peakoff.external.kto.provider;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.RegionProfile;
import com.peakoff.chat.domain.RegionProfileProvider;
import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.Quietness;
import com.peakoff.external.kto.client.KtoCongestionClient;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.client.RegionCatalog;
import com.peakoff.external.kto.client.RegionForecast;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 챗봇이 지역을 견주는 데 쓰는 요약을 공사 자료에서 만든다.
 *
 * <h2>새 API를 부르지 않는다</h2>
 * 두 자료 모두 <b>이미 지역 단위로 캐시돼 있다</b> — 지역 카탈로그(6시간)와 집중률
 * 예측(6시간). 여기서 하는 일은 그 위에서 세는 것뿐이라, 챗봇을 붙여도
 * <b>공사 호출이 늘지 않는다.</b> 캐시가 비어 있을 때만 각 지역에 한 번씩 나간다.
 *
 * <p>넓게 보는 층과 비싼 층을 가르는 것도 홈에서와 같다. 이름을 우리 장소로 잇는 일
 * (비싼 쪽)은 여기서 아예 하지 않는다 — 챗봇 카드에는 <b>지역만</b> 서지 장소가 서지 않는다.
 *
 * <h2>세는 것이 둘이고 캐시 수명이 다르다</h2>
 * <ul>
 *   <li><b>분류별 몫</b> — 카탈로그가 원천이라 하루가 지나도 거의 안 바뀐다.
 *       세는 데 지역당 수백~1,300건을 훑으므로 결과를 6시간 들고 있는다</li>
 *   <li><b>한적 비율</b> — 날짜 창이 하루만 밀려도 값이 달라진다. 캐시된 예측 위에서
 *       Map 조회만 하므로 <b>요청마다 새로 센다</b></li>
 * </ul>
 * 한적 비율까지 캐시하면 창이 어제 것으로 굳는다. 값싼 쪽을 굳이 아끼지 않는다.
 */
@Component
@ConditionalOnProperty(
		name = { "peakoff.kto.place", "peakoff.kto.congestion" },
		havingValue = "real")
public class KtoRegionProfileProvider implements RegionProfileProvider {

	private final KtoPlaceClient placeClient;
	private final KtoCongestionClient congestionClient;

	/**
	 * 분류별 몫만 캐시한다.
	 *
	 * <p>{@code RegionCache}를 그대로 쓴다 — 열쇠가 지역이고 수명이 6시간인,
	 * 이 저장소에 이미 있는 모양이다. 카탈로그 캐시와 수명이 같아 함께 늙는다.
	 */
	private final RegionCache<Map<Interest, Double>> shareCache;

	public KtoRegionProfileProvider(
			KtoPlaceClient placeClient, KtoCongestionClient congestionClient, Clock clock) {
		this.placeClient = placeClient;
		this.congestionClient = congestionClient;
		this.shareCache = new RegionCache<>(clock);
	}

	@Override
	public List<RegionProfile> profiles(LocalDate from, int days) {
		List<RegionProfile> profiles = new ArrayList<>();
		for (SupportedRegion region : SupportedRegion.values()) {
			profiles.add(profileOf(region, from, days));
		}
		return List.copyOf(profiles);
	}

	/**
	 * 지역 하나. <b>자료가 없어도 예외를 던지지 않는다</b> — 부르는 쪽은 열하나를 돌고 있고,
	 * 한 지역이 비었다고 챗봇 전체가 죽으면 안 된다.
	 */
	private RegionProfile profileOf(SupportedRegion supported, LocalDate from, int days) {
		Region region = supported.toRegion();

		Map<Interest, Double> shares;
		try {
			shares = shareCache.get(region, this::sharesOf);
		}
		catch (RuntimeException e) {
			// 카탈로그를 못 받았다. 관심사로 거를 수는 없지만 한적 비율은 아직 말할 수 있다.
			shares = Map.of();
		}

		RegionForecast forecast;
		try {
			forecast = congestionClient.forecastOf(region);
		}
		catch (RuntimeException e) {
			forecast = RegionForecast.empty();
		}
		Week week = weekOf(forecast, from, days);

		return new RegionProfile(supported, shares, week.quietShare(), week.places());
	}

	/**
	 * 관심사별 몫. <b>개수가 아니라 비율이다.</b>
	 *
	 * <p>카탈로그 크기가 남원 196곳에서 제주시 1,271곳까지 여섯 배 넘게 벌어진다.
	 * 개수로 견주면 큰 지역이 무엇을 물어도 1등이 되어, 챗봇이 <b>질문과 무관하게
	 * 같은 답</b>을 하게 된다.
	 *
	 * <p>한 장소가 여러 관심사에 들 수 있다 — 해변은 {@code NATURE}이면서 {@code WATER}다.
	 * 좁은 문과 넓은 문이 겹치는 것은 자연스러우므로 나누지 않는다.
	 */
	private Map<Interest, Double> sharesOf(Region region) {
		RegionCatalog catalog = placeClient.catalogOf(region);
		Map<Interest, Double> shares = new EnumMap<>(Interest.class);
		if (catalog.isEmpty()) {
			return shares;
		}

		Map<Interest, Integer> counts = new EnumMap<>(Interest.class);
		for (Place place : catalog.all()) {
			for (Interest interest : Interest.values()) {
				if (interest.matches(place.category())) {
					counts.merge(interest, 1, Integer::sum);
				}
			}
		}
		int total = catalog.size();
		counts.forEach((interest, count) -> shares.put(interest, (double) count / total));
		return shares;
	}

	/**
	 * 이번 주 예측에서 <b>한적한 관측이 몇 할인지</b>.
	 *
	 * <p>평균이 아니라 비율인 이유는 {@link RegionProfile}에 적어 두었다 —
	 * 11곳의 평균이 48~63으로 전부 "보통"이라, 평균으로는 카드가 서로 구분되지 않는다.
	 *
	 * <p>모수는 <b>(예측 대상 × 날짜)의 관측 전체</b>다. 장소마다 가장 한적한 날만 골라
	 * 세는 방법도 재 봤는데(39~96%) 위쪽에 몰려 지역이 갈리지 않았다 —
	 * <b>가장 좋은 날만 보면 어디나 한적하다.</b>
	 */
	private static Week weekOf(RegionForecast forecast, LocalDate from, int days) {
		if (forecast.isEmpty() || days < 1) {
			return new Week(null, 0);
		}
		int observed = 0;
		int quiet = 0;
		int places = 0;
		for (String apiName : forecast.placeNames()) {
			boolean seen = false;
			for (int offset = 0; offset < days; offset++) {
				OptionalDouble rate = forecast.rateOf(apiName, from.plusDays(offset));
				if (rate.isEmpty()) {
					continue;
				}
				seen = true;
				observed++;
				if (Quietness.of(rate.getAsDouble()) >= CongestionLevel.QUIET_THRESHOLD) {
					quiet++;
				}
			}
			if (seen) {
				places++;
			}
		}
		if (observed == 0) {
			// 지역은 있는데 이번 주에 걸치는 날짜가 없다. 자료 없음과 같이 다룬다.
			return new Week(null, 0);
		}
		return new Week((int) Math.round(100.0 * quiet / observed), places);
	}

	/** 이번 주 요약. 비율과 모수를 함께 든다 — 비율만 내걸면 몇 곳을 본 값인지 알 수 없다. */
	private record Week(Integer quietShare, int places) {
	}
}
