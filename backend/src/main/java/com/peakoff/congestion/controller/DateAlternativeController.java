package com.peakoff.congestion.controller;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.congestion.dto.DateAlternativeResponse;
import com.peakoff.congestion.service.DateAlternativeService;
import com.peakoff.global.response.ApiResponse;

@Tag(name = "날짜", description = "장소를 바꾸지 않고 혼잡을 피하는 경로")
@RestController
@RequestMapping("/api/dates")
public class DateAlternativeController {

	/**
	 * 기준 날짜 앞뒤로 며칠씩 살펴볼지의 기본값.
	 *
	 * <p>3일인 이유: 여행 날짜를 옮길 수 있는 폭은 현실적으로 주말 하나를 넘기지 않는다.
	 * 넓게 열어두면 "두 주 뒤가 가장 한적합니다" 같은, 실행할 수 없는 제안이 위로 올라온다.
	 */
	private static final int DEFAULT_RANGE_DAYS = 3;

	private final DateAlternativeService dateAlternativeService;

	public DateAlternativeController(DateAlternativeService dateAlternativeService) {
		this.dateAlternativeService = dateAlternativeService;
	}

	/**
	 * GET /api/dates/alternatives?placeId=mock-bulguksa&placeId=mock-seokguram&date=2026-09-12&range=14
	 *
	 * <p>{@code placeId}를 여러 번 넘길 수 있다. 하나만 넘기면 그 장소 기준,
	 * 코스의 장소들을 모두 넘기면 코스 전체 기준으로 날짜를 비교한다.
	 */
	@Operation(
			summary = "날짜별 한적도 (앞뒤 range일)",
			description = """
					기준 날짜 앞뒤 range일의 한적도를 날짜순으로 돌려준다.

					장소를 바꾸지 않고도 혼잡을 피하는 경로다. 핵심 명소를 배제하지 않는다.

					더 붐비는 날과 지난 날짜도 함께 담는다. 화면이 날짜를 고르는 표로 쓰기 때문에
					되돌아갈 날짜와 비교 대상이 목록 안에 있어야 한다.
					고를 수 있는지(지난 날짜 제외)는 화면이 판단한다.

					창 안에 더 나은 날이 하나도 없으면 alreadyQuietest가 true다.
					목록이 비었다는 뜻은 아니다.""")
	@GetMapping("/alternatives")
	public ApiResponse<DateAlternativeResponse> alternatives(
			@Parameter(
					description = "기준으로 삼을 장소들. 여러 번 넘기면 코스 전체 평균으로 계산한다",
					example = "mock-bulguksa")
			@RequestParam @NotEmpty(message = "장소를 하나 이상 지정해야 합니다.")
			List<String> placeId,

			@Parameter(
					description = "기준 날짜 (yyyy-MM-dd). 창의 한가운데가 된다",
					example = "2026-09-12")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
			LocalDate date,

			@Parameter(description = "기준 날짜 앞뒤로 며칠씩 볼지. 3이면 창은 7일이 된다")
			@RequestParam(defaultValue = "" + DEFAULT_RANGE_DAYS)
			@Min(value = 1, message = "조회 기간은 1일 이상이어야 합니다.")
			// 앞뒤로 세므로 상한이 14면 창은 29일이다. 옛 상한 30을 그대로 두면 61일이 된다.
			@Max(value = 14, message = "조회 기간은 앞뒤 14일까지입니다.")
			int range) {

		return ApiResponse.ok(dateAlternativeService.suggest(placeId, date, range));
	}
}
