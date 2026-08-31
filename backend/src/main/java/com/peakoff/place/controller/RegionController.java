package com.peakoff.place.controller;

import java.util.Arrays;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.global.response.ApiResponse;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.RegionResponse;

/**
 * 지원 지역 목록.
 *
 * <p>화면이 지역 칩을 그리고 지역을 검색하는 데 쓴다. 목록이 <b>서버에만</b> 있어야
 * {@link SupportedRegion}에 한 줄을 더하는 것으로 지역이 늘어난다 — 예전에는
 * {@code constants/regions.ts}가 같은 목록을 들고 있어서 둘을 함께 고쳐야 했고,
 * 한쪽을 놓치면 화면에는 보이는데 서버가 거절했다.
 *
 * <p><b>공사를 부르지 않는다.</b> 목록은 우리가 정한 것이라 메모리에서 나온다.
 * 화면이 뜰 때마다 부르는 자리라, 여기서 공사를 부르면 일일 한도를 그냥 태운다
 * ({@code docs/OPEN_DECISIONS.md} 15번).
 *
 * <p>주소를 {@code /api/places} 아래에 두지 않은 이유: 지역은 장소의 하위 개념이 아니라
 * 장소·코스·진단이 모두 딛고 서는 축이다.
 */
@Tag(name = "지역", description = "서비스가 지원하는 지역 목록")
@RestController
@RequestMapping("/api/regions")
public class RegionController {

	@Operation(summary = "지원 지역 목록",
			description = "화면의 지역 선택과 검색에 쓴다. 순서는 서버가 정한 순서 그대로다.")
	@GetMapping
	public ApiResponse<List<RegionResponse>> regions() {
		/*
		 * 정렬하지 않는다. enum 선언 순서가 곧 화면 순서이고, 그 순서에는 뜻이 있다 —
		 * 파일럿(경주)이 맨 앞이고 뒤로 갈수록 나중에 넣은 지역이다.
		 * 가나다순으로 바꾸면 "경주가 첫 지역"이라는 사실이 화면에서 사라진다.
		 */
		return ApiResponse.ok(Arrays.stream(SupportedRegion.values())
				.map(RegionResponse::from)
				.toList());
	}
}
