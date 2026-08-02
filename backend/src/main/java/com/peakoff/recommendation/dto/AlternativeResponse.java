package com.peakoff.recommendation.dto;

import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.place.dto.PlaceResponse;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.ScoreFactor;

/**
 * 대안 후보 응답.
 *
 * <p>{@code reason}과 {@code factors}는 화면에 반드시 함께 표시한다. 점수만 내려보내면
 * 서비스가 데이터를 어떻게 활용했는지 화면에서 드러나지 않는다.
 *
 * <p>후보는 <b>추천도가 높은 순</b>으로 담겨 온다. 정렬 기준이 곧 화면에 보이는 값이다.
 */
public record AlternativeResponse(
		PlaceResponse place,
		int quietness,
		int recommendation,
		CongestionLevel level,
		String levelLabel,
		List<FactorResponse> factors,
		String reason) {

	/** 추천도를 이룬 항목 하나. 화면에서 "왜 이 점수인지"를 보여주는 데 쓴다. */
	public record FactorResponse(String label, int score, int weightPercent, String detail) {

		static FactorResponse from(ScoreFactor factor) {
			return new FactorResponse(
					factor.label(), factor.score(), factor.weightPercent(), factor.detail());
		}
	}

	public static AlternativeResponse from(Alternative alternative) {
		CongestionLevel level = CongestionLevel.fromQuietness(alternative.quietness());
		return new AlternativeResponse(
				PlaceResponse.from(alternative.place()),
				alternative.quietness(),
				alternative.recommendation(),
				level,
				level.label(),
				alternative.factors().stream().map(FactorResponse::from).toList(),
				alternative.reason());
	}
}
