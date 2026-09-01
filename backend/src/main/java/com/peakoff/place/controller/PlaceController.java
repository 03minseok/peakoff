package com.peakoff.place.controller;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.congestion.dto.QuietSpotResponse;
import com.peakoff.congestion.service.QuietWeekService;
import com.peakoff.global.response.ApiResponse;
import com.peakoff.place.dto.NearbyPlaceResponse;
import com.peakoff.place.dto.PlaceDescriptionResponse;
import com.peakoff.place.dto.PlaceResponse;
import com.peakoff.place.service.PlaceService;
import com.peakoff.recommendation.dto.AlternativesResponse;
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
	private final QuietWeekService quietWeekService;

	/**
	 * 홈이 세우는 "이번 주 한적한 곳" 수.
	 *
	 * <p>카드 셋이다. 넷을 넘기면 홈에서 이 박스만 길어지고, 무엇보다
	 * <b>지역 대표가 일곱까지밖에 모이지 않는다</b> — 요청 수가 후보 수에 가까워지면
	 * 가중 무작위가 고를 것이 없어져 분산 장치가 일하지 않는다.
	 */
	private static final int DEFAULT_QUIET_SPOT_LIMIT = 3;

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

	/** GET /api/places/quiet-week?limit=3 */
	@Operation(
			summary = "이번 주 한적한 곳",
			description = """
					지역을 가리지 않고, 앞으로 7일 안에 한적할 것으로 예측된 곳을 돌려준다.

					곳마다 <b>그 기간 중 가장 한적한 하루</b>가 함께 온다(date).
					같은 장소라도 날짜마다 값이 달라서, 날짜 없이는 "한적하다"를 말할 수 없다.

					<b>한적(QUIET) 등급인 곳만 담는다.</b> 수를 채우려고 보통인 곳을 섞지 않으므로
					자료가 모자라면 limit보다 적게 온다.

					⚠️ <b>순서는 점수 순이 아니라 뽑힌 순서다.</b> 매번 가중 무작위로 고르기 때문에
					같은 요청에 다른 답이 온다. 홈에 뜨는 곳이 늘 같으면 그곳이 새로운 혼잡지가
					되기 때문이고, 그래서 이 목록은 서버도 캐시하지 않는다.""")
	@GetMapping("/quiet-week")
	public ApiResponse<List<QuietSpotResponse>> quietWeek(
			@Parameter(description = "최대 개수")
			@RequestParam(defaultValue = "" + DEFAULT_QUIET_SPOT_LIMIT)
			@Min(value = 1, message = "개수는 1 이상이어야 합니다.")
			@Max(value = 10, message = "한 번에 10곳까지 볼 수 있습니다.")
			int limit) {
		return ApiResponse.ok(quietWeekService.thisWeek(limit));
	}

	/** GET /api/places/{placeId}/alternatives?date=2026-09-12&limit=5 */
	@Operation(
			summary = "이 장소의 대안 후보",
			description = """
					붐비는 장소를 대신할 후보를 추천 순으로 돌려준다.

					각 후보에는 한적도·추천도와 함께 추천 근거 문구와 추천도 구성 내역이 담긴다.

					<b>추천도의 점수 항목은 둘이다 — 한적도(70%)와 동선 근접도(30%).</b>
					한적도의 반영 비율이 언제나 가장 높다. 한적한 곳으로 보내는 것이 추천의 목적 자체라,
					한적하지 않은 곳을 "좋은 대안"이라 부를 수 없기 때문이다.
					비율은 factors에 실려 오므로 화면에 적어 두지 말 것.

					<b>연관성과 카테고리 적합성은 점수가 아니라 후보를 거르는 문이다.</b>
					연관 순위와 한적도는 음의 상관이라(6개 지역 26,819쌍, 켄달 타우 -0.073)
					가점을 주면 더 붐비는 곳을 더 미는 셈이 된다. 인기도도 같은 이유로 가점이 아니다.

					<b>순서는 점수순이 아니다.</b> 상위 후보군에서 가중 무작위로 뽑은 차례 그대로 온다 —
					같은 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 되기 때문이다.
					그래서 같은 요청에 다른 답이 올 수 있고, 서버는 이 목록을 캐시하지 않는다.

					날짜가 필요한 이유는 같은 후보라도 날짜에 따라 한적도가 다르기 때문이다.

					<b>원래 장소보다 minQuietnessGain점 이상 한적한 곳만 담는다.</b>
					하한이 없으면 더 붐비는 곳도 "대안"으로 나가, 붐빔을 피하라는 서비스가
					더 붐비는 곳을 권하게 된다.

					그래서 목록이 비는 일이 흔하다. <b>왜 비었는지는 status가 말한다</b> —
					원래 자리가 이미 한적해서(ALREADY_QUIET) 비는 것과 대신할 곳을 못 찾아서
					(NO_VALID_CANDIDATE) 비는 것은 사용자에게 정반대의 소식이다.
					statusMessage를 그대로 띄우면 된다.

					exclude로 이미 코스에 담긴 장소를 넘기면 후보에서 빠진다.
					고를 수 없는 곳이 뽑히면 Pool 자리만 차지하고 화면에서 걸러진다.""")
	@GetMapping("/{placeId}/alternatives")
	public ApiResponse<AlternativesResponse> alternatives(
			@Parameter(description = "교체 대상 장소 ID", example = "mock-bulguksa")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId,

			@Parameter(description = "방문 예정일 (yyyy-MM-dd)", example = "2026-09-12")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,

			@Parameter(description = "최대 후보 수")
			@RequestParam(defaultValue = "" + DEFAULT_ALTERNATIVE_LIMIT)
			@Min(value = 1, message = "후보 수는 1 이상이어야 합니다.")
			@Max(value = 20, message = "후보는 한 번에 20곳까지 볼 수 있습니다.")
			int limit,

			@Parameter(
					description = """
							후보에서 뺄 장소 ID. 이미 그 날 코스에 담긴 곳을 넘긴다.
							여러 번 넘길 수 있다""",
					example = "mock-seokguram")
			// 코스 슬롯 상한(50)과 같다. 코스에 담긴 것을 넘기는 자리라 그보다 많을 수 없다.
			@RequestParam(required = false)
			@Size(max = 50, message = "한 번에 제외할 수 있는 장소는 50곳까지입니다.")
			List<String> exclude) {

		return ApiResponse.ok(recommendationService.findAlternatives(placeId, date, limit, exclude));
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

	@Operation(
			summary = "장소 소개",
			description = """
					장소 하나의 주소와 소개글. 화면이 "설명 보기"를 펼칠 때만 부른다.

					⚠️ 목록에 붙이지 말 것. 소개글은 지역 카탈로그(목록 API)에 없고 상세 조회에만
					있어서 장소마다 공사를 한 번씩 부른다 — N곳이면 N번이 되고, 그것이
					2026-08-26 한도 소진 사고의 모양이었다. 서버는 6시간 캐시로 받쳐 두지만
					캐시가 빈 첫 조회는 그대로 나간다.

					주소도 소개글도 없을 수 있다. 그때는 404가 아니라 둘 다 null로 답한다 —
					곁들이는 정보라 없다고 오류를 띄울 일은 아니다.""")
	@GetMapping("/{placeId}/description")
	public ApiResponse<PlaceDescriptionResponse> description(
			@Parameter(description = "장소 ID", example = "126166")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId) {

		return ApiResponse.ok(placeService.describe(placeId));
	}
}
