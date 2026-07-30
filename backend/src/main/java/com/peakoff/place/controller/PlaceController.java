package com.peakoff.place.controller;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

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
@Tag(name = "장소", description = "장소 목록 조회와 대안 추천")
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
	@Operation(
			summary = "지역의 장소 목록",
			description = "코스에 담을 수 있는 장소를 모두 돌려준다. v1은 경주만 지원한다.")
	@GetMapping
	public ApiResponse<List<PlaceResponse>> places(
			@Parameter(description = "지역 슬러그", example = "gyeongju")
			@RequestParam @NotBlank(message = "지역이 필요합니다.") String region) {
		return ApiResponse.ok(placeService.findByRegion(region));
	}

	/** GET /api/places/{placeId}/alternatives?date=2026-09-12&limit=5 */
	@Operation(
			summary = "이 장소의 대안 후보",
			description = """
					붐비는 장소를 대신할 후보를 추천 순으로 돌려준다.

					각 후보에는 한적도·추천도와 함께 추천 근거 문구가 담긴다.
					추천도는 인기도가 아니라 원래 장소와의 연관성·카테고리 적합성·동선 근접도로 매긴다.
					날짜가 필요한 이유는 같은 후보라도 날짜에 따라 한적도가 다르기 때문이다.""")
	@GetMapping("/{placeId}/alternatives")
	public ApiResponse<List<AlternativeResponse>> alternatives(
			@Parameter(description = "교체 대상 장소 ID", example = "mock-bulguksa")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId,

			@Parameter(description = "방문 예정일 (yyyy-MM-dd)", example = "2026-09-12")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,

			@Parameter(description = "최대 후보 수")
			@RequestParam(defaultValue = "" + DEFAULT_ALTERNATIVE_LIMIT)
			@Min(value = 1, message = "후보 수는 1 이상이어야 합니다.")
			@Max(value = 20, message = "후보는 한 번에 20곳까지 볼 수 있습니다.")
			int limit) {

		return ApiResponse.ok(recommendationService.findAlternatives(placeId, date, limit));
	}
}
