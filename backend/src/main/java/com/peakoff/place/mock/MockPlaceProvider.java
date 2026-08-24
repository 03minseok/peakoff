package com.peakoff.place.mock;

import java.util.List;
import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.domain.NearbyPlaces;
import com.peakoff.place.domain.NearbyPlace;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.Region;

/**
 * 목업 관광지 공급자.
 *
 * <p>{@code @Profile("mock")}이 붙어 있어, 실제 API 구현이 생기면 프로파일만 바꿔 갈아끼운다.
 * 호출하는 쪽 코드는 한 줄도 고치지 않는다.
 */
@Component
@Profile(DataSourceProfiles.MOCK)
@ConditionalOnProperty(name = "peakoff.kto.place", havingValue = "mock", matchIfMissing = true)
public class MockPlaceProvider implements PlaceProvider {

	@Override
	public List<Place> search(Region region, String keyword, int limit) {
		String needle = squeeze(keyword);
		if (needle.isEmpty()) {
			return List.of();
		}
		return placesOf(region).stream()
				.filter(place -> squeeze(place.name()).contains(needle))
				.limit(limit)
				.toList();
	}

	/**
	 * 목업에는 대표성 자료가 없다. 카탈로그에 적힌 순서를 그대로 쓴다.
	 *
	 * <p>실데이터에서는 중심 관광지 API의 인기 순위가 이 자리를 채운다.
	 * 목업이 그럴듯한 순위를 지어내면 화면에서 둘을 구별할 수 없어, 순서가 근거 있는
	 * 값인지 아닌지를 개발 중에 알 수 없게 된다.
	 */
	@Override
	public List<Place> representatives(Region region, int limit) {
		return placesOf(region).stream().limit(limit).toList();
	}

	/**
	 * 목업 카탈로그 전체에서 고른다.
	 *
	 * <p>지역이 하나뿐이라 경주 목록을 그대로 훑는다. 규칙 자체는
	 * {@link NearbyPlaces}가 들고 있어 실데이터 구현과 같은 답을 낸다.
	 */
	@Override
	public List<NearbyPlace> nearby(Place origin, int limit) {
		return NearbyPlaces.from(placesOf(SupportedRegion.GYEONGJU.toRegion()), origin,
				NearbyPlaces.DEFAULT_RADIUS_KM, limit);
	}

	private static List<Place> placesOf(Region region) {
		if (region == null || !GyeongjuMockCatalog.GYEONGJU.legalDongCode().equals(region.legalDongCode())) {
			// 파일럿은 경주 한 곳이다. 다른 지역을 물으면 없는 게 맞다.
			return List.of();
		}
		return GyeongjuMockCatalog.places();
	}

	/** 띄어쓰기와 대소문자를 무시하고 견준다. 사람은 "동궁과월지"라고 친다. */
	private static String squeeze(String text) {
		return text == null ? "" : text.replaceAll("\s+", "").toLowerCase();
	}

	@Override
	public Optional<Place> findById(String placeId) {
		GyeongjuMockCatalog.Entry entry = GyeongjuMockCatalog.findById(placeId);
		return Optional.ofNullable(entry).map(GyeongjuMockCatalog.Entry::place);
	}
}
