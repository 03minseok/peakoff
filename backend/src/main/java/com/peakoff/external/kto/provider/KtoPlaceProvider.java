package com.peakoff.external.kto.provider;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.client.KtoHubClient;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.client.RegionCatalog;
import com.peakoff.external.kto.support.PlaceNameMatcher;
import com.peakoff.place.domain.Place;
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
@RequiredArgsConstructor
public class KtoPlaceProvider implements PlaceProvider {

	private final KtoPlaceClient placeClient;
	private final KtoHubClient hubClient;
	private final PlaceNameMatcher nameMatcher;

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
				.limit(limit)
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
		return placeClient.findDetail(placeId);
	}

	/**
	 * <b>이미 받아 둔 지역 카탈로그</b>에서 고른다. 공사 API를 새로 부르지 않는다.
	 *
	 * <p>카탈로그는 6시간 캐시라 대개 메모리에 있다. 음식점 211곳·숙박 121곳이 전부 여기 있으므로,
	 * 예측이 닿지 않는 장소일수록 오히려 후보가 넉넉하다 — 진단은 못 해도 바꿀 곳은 보여줄 수 있다.
	 */
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
