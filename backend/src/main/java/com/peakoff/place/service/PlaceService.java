package com.peakoff.place.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.PlaceResponse;

@Service
public class PlaceService {

	private final PlaceProvider placeProvider;

	public PlaceService(PlaceProvider placeProvider) {
		this.placeProvider = placeProvider;
	}

	public List<PlaceResponse> findByRegion(String regionSlug) {
		SupportedRegion region = SupportedRegion.fromSlug(regionSlug);
		return placeProvider.findByRegion(region.toRegion()).stream()
				.map(PlaceResponse::from)
				.toList();
	}

	/** 다른 서비스도 쓰는 조회. 없으면 404가 되도록 예외를 던진다. */
	public Place getById(String placeId) {
		return placeProvider.findById(placeId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 장소입니다: " + placeId));
	}
}
