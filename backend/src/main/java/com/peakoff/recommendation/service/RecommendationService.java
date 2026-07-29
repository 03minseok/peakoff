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

	private static final int MAX_LIMIT = 20;

	private final PlaceService placeService;
	private final RecommendationProvider recommendationProvider;

	public RecommendationService(PlaceService placeService, RecommendationProvider recommendationProvider) {
		this.placeService = placeService;
		this.recommendationProvider = recommendationProvider;
	}

	public List<AlternativeResponse> findAlternatives(String placeId, LocalDate date, int limit) {
		if (limit < 1 || limit > MAX_LIMIT) {
			throw new IllegalArgumentException("후보 수는 1~%d 사이여야 합니다. 입력값: %d".formatted(MAX_LIMIT, limit));
		}
		Place origin = placeService.getById(placeId);

		return recommendationProvider.findAlternatives(origin, date, limit).stream()
				.map(AlternativeResponse::from)
				.toList();
	}
}
