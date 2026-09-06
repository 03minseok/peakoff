package com.peakoff.external.kto.provider;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.peakoff.external.kto.support.KtoApiException;
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

	private static final Logger log = LoggerFactory.getLogger(KtoRegionProfileProvider.class);

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

	/**
	 * ⚠️ <b>한 지역이 공사에 닿지 못하면 나머지는 묻지 않는다</b> (2026-09-06).
	 *
	 * <p>공사가 침묵하던 날 이 자리가 <b>65초</b>를 먹었다. 지역이 열하나이고 지역마다
	 * 카탈로그·예측 둘을 부르니 스물두 번이고, 호출마다 타임아웃 3초를 꼬박 기다린 것이다.
	 *
	 * <p>더 나쁜 것은 <b>{@code TtlCache}의 60초 백오프가 듣지 않았다</b>는 점이다 —
	 * 요청 하나가 65초를 쓰는 바람에, 두 번째 요청이 시작될 때는 첫 요청 앞부분에서 남긴
	 * 실패 기록이 <b>이미 만료</b>돼 있었다. 아낀 시간이 하나도 없었다.
	 *
	 * <p>닿지 못하는 것은 <b>그 지역의 사정이 아니라 공사의 사정</b>이다. 한 곳에서 확인했으면
	 * 남은 열 곳도 같은 답이므로, 30초를 더 기다려 같은 결론에 이를 이유가 없다.
	 *
	 * <p>⚠️ <b>자료가 비어 있는 것과는 다르다.</b> 카탈로그가 0건이거나 예측이 없는 지역은
	 * 예외가 아니라 <b>빈 값</b>으로 오므로 여기서 멈추지 않는다 — 그런 지역은 프로필이
	 * 만들어지되 {@code RegionChatPicker}가 걸러낸다.
	 */
	@Override
	public List<RegionProfile> profiles(LocalDate from, int days) {
		List<RegionProfile> profiles = new ArrayList<>();
		for (SupportedRegion region : SupportedRegion.values()) {
			try {
				profiles.add(profileOf(region, from, days));
			}
			catch (KtoApiException e) {
				log.warn("공사에 닿지 못해 지역 프로필 수집을 멈춥니다. 마지막 지역={}, 모은 지역={}곳",
						region.shortName(), profiles.size());
				break;
			}
		}
		return List.copyOf(profiles);
	}

	/**
	 * 지역 하나.
	 *
	 * <p><b>자료가 비어 있는 것</b>(카탈로그 0건·예측 없음)은 여기서 빈 프로필이 되어 나가고,
	 * <b>공사에 닿지 못한 것</b>은 예외로 위에 올라간다. 둘은 다른 일이다 —
	 * 앞은 그 지역의 사정이고 뒤는 공사의 사정이라, 뒤에서는 나머지를 물어봐야 소용없다.
	 */
	private RegionProfile profileOf(SupportedRegion supported, LocalDate from, int days) {
		Region region = supported.toRegion();

		/*
		 * ⚠️ 실패를 삼키지 않는다. 예전에는 지역마다 try/catch로 감싸 빈 값으로 넘겼는데,
		 * 그러면 공사가 죽었을 때 <b>열한 곳을 모두 헛되이 기다린다.</b> 지금은 위로 올려
		 * 부르는 쪽이 한 번에 멈춘다.
		 */
		Map<Interest, Double> shares = shareCache.get(region, this::sharesOf);
		Week week = weekOf(congestionClient.forecastOf(region), from, days);

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
