package com.peakoff.place.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.global.response.ApiResponse;
import com.peakoff.place.dto.PlaceResponse;
import com.peakoff.place.service.PlaceService;
import com.peakoff.recommendation.dto.AlternativeResponse;
import com.peakoff.recommendation.service.RecommendationService;

/**
 * 장소 조회와 그 장소의 대안 추천.
 *
 * <p>대안 추천은 추천 도메인의 일이지만 URL은 장소 아래에 둔다
 * ({@code /api/places/{id}/alternatives}). "이 장소의 대안"이라는 관계가 주소에 그대로 드러나는 편이
 * 프론트에서 읽기 쉽다.
 */
@RestController
@RequestMapping("/api/places")
public class PlaceController {

	private static final int DEFAULT_ALTERNATIVE_LIMIT = 5;

	private final PlaceService placeService;
	private final RecommendationService recommendationService;

	public PlaceController(PlaceService placeService, RecommendationService recommendationService) {
		this.placeService = placeService;
		this.recommendationService = recommendationService;
	}

	/** GET /api/places?region=gyeongju */
	@GetMapping
	public ApiResponse<List<PlaceResponse>> places(@RequestParam String region) {
		return ApiResponse.ok(placeService.findByRegion(region));
	}

	/** GET /api/places/{placeId}/alternatives?date=2026-09-12&limit=5 */
	@GetMapping("/{placeId}/alternatives")
	public ApiResponse<List<AlternativeResponse>> alternatives(
			@PathVariable String placeId,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(defaultValue = "" + DEFAULT_ALTERNATIVE_LIMIT) int limit) {

		return ApiResponse.ok(recommendationService.findAlternatives(placeId, date, limit));
	}
}
