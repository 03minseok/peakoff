package com.peakoff.recommendation.dto;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.place.dto.PlaceResponse;
import com.peakoff.recommendation.domain.Alternative;

/**
 * 대안 후보 응답.
 *
 * <p>{@code reason}은 화면에 반드시 함께 표시한다. 근거 없는 추천은 서비스가 데이터를 어떻게
 * 활용했는지 보여주지 못한다.
 */
public record AlternativeResponse(
		PlaceResponse place,
		int quietness,
		int recommendation,
		CongestionLevel level,
		String levelLabel,
		String reason) {

	public static AlternativeResponse from(Alternative alternative) {
		CongestionLevel level = CongestionLevel.fromQuietness(alternative.quietness());
		return new AlternativeResponse(
				PlaceResponse.from(alternative.place()),
				alternative.quietness(),
				alternative.recommendation(),
				level,
				level.label(),
				alternative.reason());
	}
}
