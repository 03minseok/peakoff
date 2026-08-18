package com.peakoff.recommendation.domain;

import java.util.List;
import java.util.Objects;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Place;

/**
 * 점수만 매겨진 후보. 아직 근거 문구가 붙지 않았다.
 *
 * <p>{@link Alternative}를 바로 만들지 않는 이유는 <b>근거 문구가 호출하는 쪽마다 다르기</b> 때문이다.
 * 교체 추천은 "불국사에서 가까운 같은 분류 · 예상 혼잡 낮음"이라 말하고,
 * 설문 코스 생성은 "역사·유적 선호 · 예상 혼잡 낮음"이라 말한다.
 * 계산은 한 곳에서 하되 말하는 방식은 화면마다 다르므로, 그 경계를 타입으로 갈라 뒀다.
 *
 * <p>{@code level}을 함께 담는 이유: 근거 문구를 만들려면 등급이 필요한데,
 * 그 등급은 방금 계산한 한적도에서 나온다. 호출하는 쪽이 다시 계산하게 두면
 * 임계값이 바뀔 때 점수와 문구가 어긋날 수 있다.
 *
 * @param place          후보 장소
 * @param quietness      해당 날짜의 예상 한적도 (0~100, 클수록 한적)
 * @param level          한적도를 3단계로 묶은 등급
 * @param recommendation 항목들을 반영 비율대로 합친 추천도 (0~100)
 * @param factors        추천도가 어떻게 나왔는지 항목별로 쪼갠 내역
 */
public record ScoredPlace(
		Place place,
		int quietness,
		CongestionLevel level,
		int recommendation,
		List<ScoreFactor> factors) {

	public ScoredPlace {
		Objects.requireNonNull(place, "후보 장소는 필수입니다.");
		Scores.validate(quietness, "한적도");
		Objects.requireNonNull(level, "혼잡 등급은 필수입니다.");
		Scores.validate(recommendation, "추천도");
		Objects.requireNonNull(factors, "추천도 구성 항목은 필수입니다.");
		factors = List.copyOf(factors);
	}

	/** 근거 문구를 붙여 화면에 내려보낼 수 있는 대안으로 만든다. */
	public Alternative withReason(String reason) {
		return new Alternative(place, quietness, recommendation, factors, reason);
	}
}
