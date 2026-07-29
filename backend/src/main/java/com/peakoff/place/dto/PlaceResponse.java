package com.peakoff.place.dto;

import com.peakoff.place.domain.Place;

/**
 * 장소 응답.
 *
 * <p>도메인의 {@code PlaceCategory}를 중첩 객체로 내보내지 않고 두 필드로 편 이유:
 * 화면에서 {@code place.category.name}보다 {@code place.categoryName}이 다루기 쉽고,
 * 나중에 도메인 구조가 바뀌어도 응답 모양은 그대로 유지할 수 있다.
 */
public record PlaceResponse(
		String id,
		String name,
		double latitude,
		double longitude,
		String categoryCode,
		String categoryName,
		String imageUrl) {

	public static PlaceResponse from(Place place) {
		return new PlaceResponse(
				place.id(),
				place.name(),
				place.latitude(),
				place.longitude(),
				place.category().code(),
				place.category().name(),
				place.imageUrl());
	}
}
