package com.peakoff.recommendation.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.peakoff.place.domain.Place;
import com.peakoff.place.service.PlaceService;
import com.peakoff.recommendation.domain.RecommendationProvider;
import com.peakoff.recommendation.dto.AlternativesResponse;

@Service
public class RecommendationService {

	private final PlaceService placeService;
	private final RecommendationProvider recommendationProvider;

	public RecommendationService(PlaceService placeService, RecommendationProvider recommendationProvider) {
		this.placeService = placeService;
		this.recommendationProvider = recommendationProvider;
	}

	/** limit의 허용 범위는 컨트롤러의 {@code @Min}/{@code @Max}가 이미 걸렀다. */
	public AlternativesResponse findAlternatives(String placeId, LocalDate date, int limit) {
		Place origin = placeService.getById(placeId);

		return AlternativesResponse.from(recommendationProvider.findAlternatives(origin, date, limit));
	}
}
