package com.peakoff.chat.controller;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.RegionChatPicker;
import com.peakoff.chat.domain.RegionProfile;
import com.peakoff.chat.domain.RegionProfileProvider;
import com.peakoff.global.response.ApiResponse;

/**
 * 챗봇이 <b>지역을 고르는 부분만</b> LLM 없이 들여다보는 자리. 개발 기기 전용.
 *
 * <h3>왜 있는가</h3>
 * 지역을 고르는 규칙과 말로 옮기는 일은 층이 다르다. 층이 다르면 <b>따로 확인할 수 있어야</b>
 * 한다 — 카드 문장이 이상할 때 그것이 고르기가 틀린 탓인지 문장이 틀린 탓인지
 * 가려내려면, 고르기만 떼어 볼 수 있어야 한다.
 *
 * <p>관심사를 직접 넘기므로 <b>LLM을 부르지 않는다.</b> 크레딧을 쓰지 않고 규칙만 본다.
 *
 * <p>같은 관심사로 여러 번 불러 보면 뽑기가 실제로 도는지도 보인다 —
 * 같은 셋만 계속 나오면 분산 장치가 죽은 것이다(대안 추천에서 겪은 그 고장).
 */
@Tag(name = "개발용", description = "챗봇 지역 고르기 확인 (개발 기기 전용)")
@ConditionalOnProperty(name = "peakoff.dev.endpoints", havingValue = "true")
@RestController
@RequestMapping("/api/dev/chat-regions")
public class RegionChatDevController {

	/** 이번 주. 챗봇이 보는 창과 같아야 여기서 본 값이 화면과 맞는다. */
	private static final int FORECAST_DAYS = 7;

	private final Optional<RegionProfileProvider> profileProvider;
	private final RegionChatPicker picker;
	private final Clock clock;

	public RegionChatDevController(
			Optional<RegionProfileProvider> profileProvider, RegionChatPicker picker, Clock clock) {
		this.profileProvider = profileProvider;
		this.picker = picker;
		this.clock = clock;
	}

	@Operation(summary = "지역 고르기 확인",
			description = "관심사를 직접 넘긴다(FOOD·WATER·NATURE·HISTORY·CULTURE·LEISURE·EXPERIENCE·SHOPPING·NONE). "
					+ "LLM을 부르지 않는다.")
	@GetMapping
	public ApiResponse<Map<String, Object>> pick(
			@RequestParam(required = false, defaultValue = "NONE") String interest) {

		Map<String, Object> body = new LinkedHashMap<>();
		Interest read = Interest.of(interest);
		body.put("interest", read.name());
		body.put("interestLabel", read.label());

		if (profileProvider.isEmpty()) {
			/*
			 * 목업 구간이다. 지역 프로필은 카탈로그와 예측을 함께 봐야 만들어지는데
			 * 목업 카탈로그는 경주 한 곳뿐이라 견줄 것이 없다.
			 */
			body.put("available", false);
			body.put("note", "peakoff.kto.place와 peakoff.kto.congestion이 모두 real이어야 합니다.");
			return ApiResponse.ok(body);
		}

		List<RegionProfile> profiles = profileProvider.get().profiles(LocalDate.now(clock), FORECAST_DAYS);
		body.put("available", true);
		body.put("all", profiles.stream().map(profile -> row(profile, read)).toList());
		body.put("candidates", picker.filter(profiles, read).stream()
				.map(profile -> profile.region().shortName())
				.toList());
		body.put("picked", picker.pick(profiles, read).stream()
				.map(profile -> row(profile, read))
				.toList());
		return ApiResponse.ok(body);
	}

	private static Map<String, Object> row(RegionProfile profile, Interest interest) {
		Map<String, Object> row = new LinkedHashMap<>();
		row.put("region", profile.region().slug());
		row.put("name", profile.region().shortName());
		row.put("quietShare", profile.quietShare());
		row.put("forecastSize", profile.forecastSize());
		row.put("share", Math.round(profile.shareOf(interest) * 1000) / 10.0);
		return row;
	}
}
