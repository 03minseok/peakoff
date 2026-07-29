package com.peakoff.congestion.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.congestion.dto.DateAlternativeResponse;
import com.peakoff.congestion.service.DateAlternativeService;
import com.peakoff.global.response.ApiResponse;

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
	@GetMapping("/alternatives")
	public ApiResponse<DateAlternativeResponse> alternatives(
			@RequestParam List<String> placeId,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(defaultValue = "" + DEFAULT_RANGE_DAYS) int range) {

		return ApiResponse.ok(dateAlternativeService.suggest(placeId, date, range));
	}
}
