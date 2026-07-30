package com.peakoff.recommendation.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

import com.peakoff.place.domain.Place;
import com.peakoff.place.service.PlaceService;
import com.peakoff.recommendation.domain.RecommendationProvider;
import com.peakoff.recommendation.dto.AlternativeResponse;

@Service
public class RecommendationService {

	private final PlaceService placeService;
	private final RecommendationProvider recommendationProvider;

	public RecommendationService(PlaceService placeService, RecommendationProvider recommendationProvider) {
		this.placeService = placeService;
		this.recommendationProvider = recommendationProvider;
	}

	/** limit의 허용 범위는 컨트롤러의 {@code @Min}/{@code @Max}가 이미 걸렀다. */
	public List<AlternativeResponse> findAlternatives(String placeId, LocalDate date, int limit) {
		Place origin = placeService.getById(placeId);

		return recommendationProvider.findAlternatives(origin, date, limit).stream()
				.map(AlternativeResponse::from)
				.toList();
	}
}
