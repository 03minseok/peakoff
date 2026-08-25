package com.peakoff.recommendation.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

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

	/**
	 * limit의 허용 범위는 컨트롤러의 {@code @Min}/{@code @Max}가 이미 걸렀다.
	 *
	 * @param excluded 후보에서 뺄 장소 ID. 이미 코스에 담긴 곳이 온다. {@code null}이면 없는 것으로 본다
	 */
	public AlternativesResponse findAlternatives(String placeId, LocalDate date, int limit,
			List<String> excluded) {

		Place origin = placeService.getById(placeId);
		Set<String> skip = excluded == null ? Set.of() : Set.copyOf(excluded);

		return AlternativesResponse.from(
				recommendationProvider.findAlternatives(origin, date, limit, skip));
	}
}
