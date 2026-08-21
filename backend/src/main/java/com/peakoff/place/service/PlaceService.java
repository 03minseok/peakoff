package com.peakoff.place.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.PlaceResponse;

@Service
@RequiredArgsConstructor
public class PlaceService {

	private final PlaceProvider placeProvider;

	/**
	 * 이름으로 장소를 찾는다. 검색 범위는 그 지역 안이다.
	 *
	 * <p>검색어가 비어 있으면 <b>대표 관광지</b>를 돌려준다. 화면 입장에서는 "검색 전"과
	 * "검색 중"이 같은 목록 자리를 쓰는데, 빈 검색창에 아무것도 없으면 그 지역을 모르는
	 * 사용자가 첫 글자를 치지 못한다.
	 */
	public List<PlaceResponse> search(String regionSlug, String keyword, int limit) {
		SupportedRegion region = SupportedRegion.fromSlug(regionSlug);
		List<Place> found = keyword == null || keyword.isBlank()
				? placeProvider.representatives(region.toRegion(), limit)
				: placeProvider.search(region.toRegion(), keyword, limit);
		return found.stream().map(PlaceResponse::from).toList();
	}

	/** 다른 서비스도 쓰는 조회. 없으면 404가 되도록 예외를 던진다. */
	public Place getById(String placeId) {
		return placeProvider.findById(placeId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 장소입니다: " + placeId));
	}
}
