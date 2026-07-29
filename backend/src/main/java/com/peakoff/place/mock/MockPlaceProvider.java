package com.peakoff.place.mock;

import java.util.List;
import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.place.domain.Place;
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
public class MockPlaceProvider implements PlaceProvider {

	@Override
	public List<Place> findByRegion(Region region) {
		if (region == null || !GyeongjuMockCatalog.GYEONGJU.legalDongCode().equals(region.legalDongCode())) {
			// 파일럿은 경주 한 곳이다. 다른 지역을 물으면 없는 게 맞다.
			return List.of();
		}
		return GyeongjuMockCatalog.places();
	}

	@Override
	public Optional<Place> findById(String placeId) {
		GyeongjuMockCatalog.Entry entry = GyeongjuMockCatalog.findById(placeId);
		return Optional.ofNullable(entry).map(GyeongjuMockCatalog.Entry::place);
	}
}
