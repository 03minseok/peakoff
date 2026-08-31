package com.peakoff.external.kto.provider;

import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.client.KtoHubClient;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.client.RegionCatalog;
import com.peakoff.external.kto.support.KtoApiException;
import com.peakoff.external.kto.support.PlaceNameMatcher;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceDescription;
import com.peakoff.place.domain.NearbyPlaces;
import com.peakoff.place.domain.NearbyPlace;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 공공데이터로 관광지를 공급한다. 목업 카탈로그를 대신한다.
 *
 * <h3>어떻게 켜는가</h3>
 * {@code peakoff.kto.place=real}이면 이 빈이, 아니면 목업이 등록된다.
 * 프로파일이 아니라 항목별 스위치인 이유는 도메인마다 실연동 시점이 달라서다
 * (집중률이 먼저 넘어갔고, 대안 추천은 아직 목업이다).
 *
 * <h3>세 API의 이름 표기가 다르다</h3>
 * 국문 관광정보는 {@code "경주 불국사 [유네스코 세계유산]"}, 중심 관광지는 {@code "불국사"}로
 * 부른다. 그래서 대표 관광지를 우리 장소로 이을 때 {@link PlaceNameMatcher}를 거친다 —
 * 집중률을 이을 때 쓴 그 정규화가 여기서도 그대로 쓰인다.
 */
@Component
@ConditionalOnProperty(name = "peakoff.kto.place", havingValue = "real")
public class KtoPlaceProvider implements PlaceProvider {

	private static final Logger log = LoggerFactory.getLogger(KtoPlaceProvider.class);

	private final KtoPlaceClient placeClient;
	private final KtoHubClient hubClient;
	private final PlaceNameMatcher nameMatcher;

	/**
	 * 대표 관광지를 <b>우리 장소로 이어 놓은 결과</b>를 지역별로 들고 있는다.
	 *
	 * <h3>왜 여기까지 캐시하는가</h3>
	 * 원자료(중심 관광지 목록·지역 카탈로그)는 이미 캐시돼 있었는데도 이 화면이 380ms 걸렸다.
	 * 남은 비용이 <b>이름 매칭</b>이었기 때문이다 — 중심 관광지 100개를 카탈로그 621곳과
	 * 견주는데, 후보 하나마다 정규화를 두 번 돌린다. 요청 한 번에 정규식이 12만 번 돈다.
	 *
	 * <h3>분산 규칙을 어기지 않는다</h3>
	 * 여기 담기는 것은 <b>"이 공사 이름이 우리 어느 장소인가"</b>라는 기계적 대응표뿐이다.
	 * 점수도 순서도 들어 있지 않다. 캐시하지 말아야 할 것은 완성된 <b>대안 목록</b>이다 —
	 * 그것을 캐시하면 모든 사용자가 같은 답을 받아 추천 분산이 죽는다.
	 * 점수 계산과 가중 무작위 뽑기는 지금처럼 매번 한다.
	 *
	 * <p>⚠️ 순서는 <b>인기 순</b>이라 추천 점수에 쓰지 않는다. 목록을 늘어놓는 순서로만 쓴다.
	 */
	private final RegionCache<List<Place>> representativesCache;

	public KtoPlaceProvider(KtoPlaceClient placeClient, KtoHubClient hubClient,
			PlaceNameMatcher nameMatcher, Clock clock) {
		this.placeClient = placeClient;
		this.hubClient = hubClient;
		this.nameMatcher = nameMatcher;
		this.representativesCache = new RegionCache<>(clock);
	}

	@Override
	public List<Place> search(Region region, String keyword, int limit) {
		return placeClient.catalogOf(region).search(keyword, limit);
	}

	/**
	 * 중심 관광지가 준 순서를 지킨 채 우리 장소로 바꾼다.
	 *
	 * <p>이름이 우리 카탈로그에 없으면 조용히 건너뛴다. 대표 목록은 "보여줄 것"이지
	 * "빠짐없이 세어야 할 것"이 아니라, 몇 곳이 빠져도 화면은 성립한다.
	 */
	@Override
	public List<Place> representatives(Region region, int limit) {
		// 이어 놓은 결과는 지역당 한 벌이다. limit은 그 목록에서 앞부분을 자르는 것뿐이라
		// 캐시 열쇠에 넣지 않는다 — 넣으면 limit이 다를 때마다 매칭을 다시 하게 된다.
		return representativesCache.get(region, this::resolveRepresentatives).stream()
				.limit(limit)
				.toList();
	}

	/** 중심 관광지 이름을 우리 장소로 잇는다. <b>비싼 쪽</b>이라 캐시 뒤에 둔다. */
	private List<Place> resolveRepresentatives(Region region) {
		RegionCatalog catalog = placeClient.catalogOf(region);
		if (catalog.isEmpty()) {
			return List.of();
		}
		Map<String, Place> byName = catalog.byName();

		return hubClient.representativeNames(region).stream()
				.map(name -> nameMatcher.match(name, region, byName.keySet()).orElse(null))
				.filter(matched -> matched != null)
				.map(byName::get)
				.distinct()
				.toList();
	}

	/**
	 * 캐시된 카탈로그에서 먼저 찾고, 없으면 상세를 한 번 조회한다.
	 *
	 * <p>폴백이 필요한 자리는 <b>저장해 둔 코스를 불러올 때</b>다. 저장된 장소가 카탈로그에서
	 * 빠졌거나(분류 변경·폐업) 지역이 달라졌을 수 있는데, 그때 못 찾는다고만 하면
	 * 사용자는 자기가 저장한 코스를 영영 못 연다.
	 */
	@Override
	public Optional<Place> findById(String placeId) {
		/*
		 * 장소 ID에 지역이 묻어 있지 않아 지원 지역을 하나씩 훑는다.
		 * 카탈로그는 6시간 캐시라 대개 메모리에 있고, 첫 조회에서만 지역 수만큼 부른다.
		 */
		for (Region region : SupportedRegion.allRegions()) {
			Optional<Place> cached = placeClient.catalogOf(region).findById(placeId);
			if (cached.isPresent()) {
				return cached;
			}
		}

		/*
		 * 카탈로그에 없다. 마지막 수단으로 낱개 조회를 해 보되, <b>실패는 "못 찾았다"로 다룬다.</b>
		 *
		 * 공사 상세 조회가 막혀 있을 때(한도 초과·장애·백오프) 예외를 그대로 올리면
		 * <b>500 + 전체 스택</b>이 된다. 실제로 그렇게 터졌다(2026-08-26) — 화면이 들고 있던
		 * 옛 장소 ID 하나 때문에 요청마다 스택 수백 줄이 로그를 채웠다.
		 *
		 * 우리가 아는 것은 "지역 카탈로그에 없다"까지다. 확인할 길이 막혔다고 서버 오류라고
		 * 말할 일은 아니다 — 없는 장소와 같은 404로 답하는 편이 화면에도 로그에도 정직하다.
		 * 카탈로그 자체를 못 받아온 경우는 위쪽 {@code catalogOf}에서 그대로 터지므로,
		 * <b>여기서 삼키는 것은 낱개 조회 실패뿐이다.</b>
		 */
		try {
			return placeClient.findDetail(placeId);
		}
		catch (KtoApiException e) {
			log.warn("카탈로그에 없는 장소의 상세 조회에 실패했습니다. 없는 것으로 답합니다. placeId={}, 사유={}",
					placeId, e.getMessage());
			return Optional.empty();
		}
	}

	/**
	 * <b>이미 받아 둔 지역 카탈로그</b>에서 고른다. 공사 API를 새로 부르지 않는다.
	 *
	 * <p>카탈로그는 6시간 캐시라 대개 메모리에 있다. 음식점 211곳·숙박 121곳이 전부 여기 있으므로,
	 * 예측이 닿지 않는 장소일수록 오히려 후보가 넉넉하다 — 진단은 못 해도 바꿀 곳은 보여줄 수 있다.
	 */
	/**
	 * 장소 하나의 읽을거리. <b>카탈로그를 거치지 않고</b> 곧장 상세 조회로 간다.
	 *
	 * <p>{@link #findById}는 카탈로그를 먼저 뒤지지만 여기서는 그럴 수 없다 —
	 * 카탈로그(목록 API)에는 소개글이 없기 때문이다. 카탈로그에 있는 장소라도
	 * 소개글을 얻으려면 상세를 불러야 한다.
	 *
	 * <p>조회가 막혔을 때 예외를 올리지 않는 것은 {@link #findById}와 같은 이유다.
	 * 읽을거리는 <b>곁들이는 정보</b>라, 못 가져왔다고 화면이 오류를 띄울 일은 아니다.
	 */
	@Override
	public Optional<PlaceDescription> describe(String placeId) {
		try {
			return placeClient.findDescription(placeId);
		}
		catch (KtoApiException e) {
			log.warn("장소 소개를 불러오지 못했습니다. 없는 것으로 답합니다. placeId={}, 사유={}",
					placeId, e.getMessage());
			return Optional.empty();
		}
	}

	/**
	 * 이 장소가 든 지역. 카탈로그를 하나씩 훑어 찾는다.
	 *
	 * <p>{@link #findById}와 같은 순회이지만 <b>돌려주는 것이 다르다</b> — 저쪽은 장소를,
	 * 이쪽은 지역을 준다. 카탈로그는 6시간 캐시라 대개 메모리 조회로 끝난다.
	 *
	 * <p>⚠️ 카탈로그에 없으면 빈 값이다. {@code findById}는 마지막 수단으로 낱개 조회까지
	 * 가지만 <b>그 응답에는 지역이 없다</b> — 없는 것을 지어내느니 모른다고 답한다.
	 */
	@Override
	public Optional<Place> findInRegion(Region region, String placeId) {
		return placeClient.catalogOf(region).findById(placeId);
	}

	@Override
	public Optional<SupportedRegion> regionOf(String placeId) {
		return Arrays.stream(SupportedRegion.values())
				.filter(region -> placeClient.catalogOf(region.toRegion()).findById(placeId).isPresent())
				.findFirst();
	}

	@Override
	public List<NearbyPlace> nearby(Place origin, int limit) {
		/*
		 * 기준 장소가 든 지역의 카탈로그에서만 고른다. 모든 지역을 한 무더기로 합치지 않는 이유는
		 * 반경(5km)이 어차피 걸러 주기 때문이 아니라 <b>지역이 코스의 단위</b>이기 때문이다 —
		 * 경주 코스의 밥집 자리에 제주 식당이 후보로 오르면 안 된다.
		 */
		return SupportedRegion.allRegions().stream()
				.map(placeClient::catalogOf)
				.filter(catalog -> catalog.findById(origin.id()).isPresent())
				.findFirst()
				.map(catalog -> NearbyPlaces.from(catalog.all(), origin,
						NearbyPlaces.DEFAULT_RADIUS_KM, limit))
				.orElseGet(List::of);
	}
}
