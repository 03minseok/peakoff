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

	private static final int DEFAULT_RANGE_DAYS = 14;

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
			summary = "더 한적한 날짜 제안",
			description = """
					선택한 날짜보다 한적한 날을 개선폭이 큰 순으로 돌려준다.

					장소를 바꾸지 않고도 혼잡을 피하는 경로다. 핵심 명소를 배제하지 않는다.
					더 나은 날이 없으면 alreadyQuietest가 true이고 목록은 비어 있다.""")
	@GetMapping("/alternatives")
	public ApiResponse<DateAlternativeResponse> alternatives(
			@Parameter(
					description = "기준으로 삼을 장소들. 여러 번 넘기면 코스 전체 평균으로 계산한다",
					example = "mock-bulguksa")
			@RequestParam @NotEmpty(message = "장소를 하나 이상 지정해야 합니다.") List<String> placeId,

			@Parameter(description = "현재 선택한 날짜 (yyyy-MM-dd)", example = "2026-09-12")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,

			@Parameter(description = "며칠 앞까지 살펴볼지")
			@RequestParam(defaultValue = "" + DEFAULT_RANGE_DAYS)
			@Min(value = 2, message = "조회 기간은 2일 이상이어야 합니다.")
			@Max(value = 30, message = "조회 기간은 30일까지입니다.")
			int range) {

		return ApiResponse.ok(dateAlternativeService.suggest(placeId, date, range));
	}
}
