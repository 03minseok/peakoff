package com.peakoff.place.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.NearbyPlaceResponse;
import com.peakoff.place.dto.PlaceDescriptionResponse;
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

	/**
	 * 기준 장소 근처의 같은 분류 장소들. 가까운 순.
	 *
	 * <p>한적도를 매길 수 없는 장소(음식점·숙박)에서 <b>장소를 바꾸는</b> 유일한 길이다.
	 * 진단할 수 없다는 이유로 바꿀 방법까지 막을 이유는 없다 —
	 * 우리가 점수를 못 매기는 것이지, 사용자가 다른 밥집을 고르고 싶지 않은 것이 아니다.
	 *
	 * <p>기준 장소가 없으면 404다. 근처에 아무것도 없으면 <b>빈 목록</b>이다 —
	 * 요청이 잘못된 것과 답이 없는 것은 다르다.
	 */
	public List<NearbyPlaceResponse> findNearby(String placeId, int limit) {
		Place origin = getById(placeId);
		return placeProvider.nearby(origin, limit).stream()
				.map(NearbyPlaceResponse::from)
				.toList();
	}

	/**
	 * 장소 하나의 읽을거리(주소·소개글).
	 *
	 * <p>⚠️ <b>장소가 있는지부터 확인하지 않는다.</b> {@code getById}를 앞에 두면 카탈로그를
	 * 훑는 조회가 한 번 더 붙는데, 소개글 조회는 어차피 없는 ID면 빈 값으로 돌아온다.
	 * 여기서 얻을 것이 없는 확인이다.
	 *
	 * <p>못 구해도 빈 값으로 답한다 — 곁들이는 정보라 없다고 화면이 오류를 띄울 일은 아니다.
	 */
	public PlaceDescriptionResponse describe(String placeId) {
		return placeProvider.describe(placeId)
				.map(PlaceDescriptionResponse::from)
				.orElseGet(PlaceDescriptionResponse::empty);
	}

	/** 다른 서비스도 쓰는 조회. 없으면 404가 되도록 예외를 던진다. */
	public Place getById(String placeId) {
		return placeProvider.findById(placeId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 장소입니다: " + placeId));
	}
}
