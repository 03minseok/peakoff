package com.peakoff.place.controller;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.global.response.ApiResponse;
import com.peakoff.place.dto.NearbyPlaceResponse;
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
@RequiredArgsConstructor
@RequestMapping("/api/places")
public class PlaceController {

	private static final int DEFAULT_ALTERNATIVE_LIMIT = 5;

	private final PlaceService placeService;
	private final RecommendationService recommendationService;

	/** 화면이 한 번에 보여줄 만큼. 지역 전체(경주만 621곳)를 늘어놓지 않는다. */
	private static final int DEFAULT_SEARCH_LIMIT = 20;

	/** GET /api/places?region=gyeongju&keyword=불국사&limit=20 */
	@Operation(
			summary = "장소 검색",
			description = """
					이름으로 장소를 찾는다. 검색 범위는 그 지역 안이다.

					keyword를 비워 보내면 그 지역의 대표 관광지를 인기 순으로 돌려준다.
					검색 전 빈 화면에 쓰는 목록이다 — 그 지역을 모르면 첫 글자를 치지 못한다.

					⚠️ 대표 목록의 순서는 인기 순이지 추천 순이 아니다.
					인기 장소는 붐비는 장소이므로 추천 점수에는 쓰지 않는다.""")
	@GetMapping
	public ApiResponse<List<PlaceResponse>> places(
			@Parameter(description = "지역 슬러그", example = "gyeongju")
			@RequestParam @NotBlank(message = "지역이 필요합니다.") String region,

			@Parameter(description = "검색어. 비우면 대표 관광지가 나온다", example = "불국사")
			@RequestParam(required = false) String keyword,

			@Parameter(description = "최대 개수")
			@RequestParam(defaultValue = "" + DEFAULT_SEARCH_LIMIT)
			@Min(value = 1, message = "개수는 1 이상이어야 합니다.")
			@Max(value = 100, message = "한 번에 100곳까지 볼 수 있습니다.")
			int limit) {
		return ApiResponse.ok(placeService.search(region, keyword, limit));
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

	/**
	 * GET /api/places/{placeId}/nearby?limit=5
	 *
	 * <p>대안 추천과 <b>다른 엔드포인트인 이유</b>: 돌려주는 것이 다르다.
	 * 저쪽은 점수와 근거가 붙은 추천이고, 여기는 거리라는 사실뿐이다.
	 * 한 엔드포인트에 몰아 넣고 점수 자리를 비우면, 화면이 "점수가 아직 안 온 추천"으로 읽는다.
	 */
	@Operation(
			summary = "근처의 같은 분류 장소 (점수 없음)",
			description = """
					기준 장소에서 가까운 순으로, 같은 분류의 다른 장소를 돌려준다.

					<b>추천이 아니다.</b> 공사 집중률은 관광지만 예측해서 음식점·숙박은 한적도를 알 수 없고,
					한적도를 모르면 추천도를 매길 수 없다. 그래서 "여기가 더 한적합니다"라고 말하지 않고
					"같은 분류이고 몇 km 떨어져 있다"는 사실만 전한다.

					진단할 수 없는 장소에서 장소를 바꾸는 유일한 길이다.
					날짜를 받지 않는 것도 같은 이유다 — 날짜에 따라 달라지는 값이 하나도 없다.

					반경 밖이거나 같은 분류가 없으면 빈 목록이다.""")
	@GetMapping("/{placeId}/nearby")
	public ApiResponse<List<NearbyPlaceResponse>> nearby(
			@Parameter(description = "기준 장소 ID", example = "2736657")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId,

			@Parameter(description = "최대 개수")
			@RequestParam(defaultValue = "" + DEFAULT_ALTERNATIVE_LIMIT)
			@Min(value = 1, message = "개수는 1 이상이어야 합니다.")
			@Max(value = 20, message = "한 번에 20곳까지 볼 수 있습니다.")
			int limit) {

		return ApiResponse.ok(placeService.findNearby(placeId, limit));
	}
}
