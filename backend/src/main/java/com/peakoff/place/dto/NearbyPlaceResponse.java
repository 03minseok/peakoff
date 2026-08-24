package com.peakoff.place.dto;

import com.peakoff.place.domain.NearbyPlace;

/**
 * 근처의 같은 분류 장소 하나.
 *
 * <p><b>{@code AlternativeResponse}와 일부러 다르게 생겼다.</b> 저쪽에는 한적도·추천도·근거가
 * 있고 여기에는 거리뿐이다. 같은 모양으로 맞춰 점수 자리를 {@code null}로 채우면, 화면이
 * "점수를 아직 못 받은 대안"으로 읽고 로딩 표시를 내거나 0으로 그린다.
 * <b>못 받은 것이 아니라 처음부터 없는 값</b>이라, 아예 다른 모양이어야 한다.
 *
 * @param distanceKm 직선 거리(km). 반올림하지 않고 그대로 보낸다 —
 *                   "1.2km"로 적을지 "1km 남짓"으로 적을지는 화면이 정한다
 */
public record NearbyPlaceResponse(PlaceResponse place, double distanceKm) {

	public static NearbyPlaceResponse from(NearbyPlace nearby) {
		return new NearbyPlaceResponse(PlaceResponse.from(nearby.place()), nearby.distanceKm());
	}
}
