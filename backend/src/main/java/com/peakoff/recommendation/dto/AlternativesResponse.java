package com.peakoff.recommendation.dto;

import java.util.List;

import com.peakoff.recommendation.domain.AlternativeStandard;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.PlaceOffStatus;

/**
 * 장소 교체 추천 응답.
 *
 * <p>후보 목록만 내려보내지 않는다. <b>빈 목록도 이유를 달고 나간다</b> — 왜 비었는지가
 * 사용자에게 매번 다른 소식이기 때문이다. 원래 자리가 이미 한적해서 비는 것과
 * 대신할 곳을 못 찾아서 비는 것은 정반대의 말이다.
 *
 * <p>날짜 대안 응답({@code DateAlternativeResponse})과 같은 모양이다 — 상태·임계값·목록.
 * 두 회피 경로(날짜·장소)가 같은 모양으로 답해야 화면이 같은 방식으로 말할 수 있다.
 *
 * @param status            왜 이런 목록이 나왔는가
 * @param statusMessage     그 이유를 사람이 읽는 문장. 화면이 그대로 띄운다.
 *                          추천이 있으면 {@code null}이다 — 목록 자체가 답이라 덧붙일 말이 없다
 * @param originQuietness   원래 장소의 그 날 한적도. 모르면 {@code null}.
 *                          후보의 절대 점수만 주면 "이게 지금보다 나은가"를 사용자가 암산해야 한다
 * @param minQuietnessGain  대안으로 권하기 위해 필요한 최소 개선폭.
 *                          <b>서버가 내려보낸다.</b> 화면에 숫자를 적어두면 분석 결과로 기준이
 *                          바뀔 때 한쪽만 고쳐져 설명과 실제가 어긋난다
 * @param alternatives      <b>뽑힌 순서 그대로의</b> 후보. 점수순이 아니다 —
 *                          상위 후보군에서 가중 무작위로 뽑고 다시 정렬하지 않는다.
 *                          같은 대안이 모두에게 반복 추천되면 그곳이 새로운 혼잡지가 되기 때문이다.
 *                          줄을 세워야 하면 화면이 <b>구간 단위까지만</b> 세운다
 */
public record AlternativesResponse(
		PlaceOffStatus status,
		String statusMessage,
		Integer originQuietness,
		int minQuietnessGain,
		List<AlternativeResponse> alternatives) {

	public static AlternativesResponse from(Alternatives alternatives) {
		return new AlternativesResponse(
				alternatives.status(),
				alternatives.status().message(),
				alternatives.originQuietness(),
				AlternativeStandard.MIN_QUIETNESS_GAIN,
				alternatives.picked().stream().map(AlternativeResponse::from).toList());
	}
}
