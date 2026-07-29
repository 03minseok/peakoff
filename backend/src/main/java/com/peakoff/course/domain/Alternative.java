package com.peakoff.course.domain;

import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.global.support.Texts;
import com.peakoff.place.domain.Place;

/**
 * 슬롯을 교체할 대안지 후보.
 *
 * <p>{@code reason}을 필수로 둔 것이 이 타입의 핵심이다. 근거 없는 추천은 아예 만들 수 없다.
 * "추천에는 반드시 이유를 함께 보여준다"는 원칙을 문서가 아니라 생성자에서 강제한다.
 *
 * @param place          대안 관광지
 * @param quietness      예상 한적도 (0~100, 클수록 한적)
 * @param recommendation 추천도 (0~100). 연관성과 한적도를 합산한 정렬 기준
 * @param reason         추천 근거 문구 (예: "함께 많이 찾는 곳 · 예상 혼잡 낮음")
 */
public record Alternative(Place place, int quietness, int recommendation, String reason) {

	public Alternative {
		Objects.requireNonNull(place, "대안 장소는 필수입니다.");
		Scores.validate(quietness, "한적도");
		Scores.validate(recommendation, "추천도");
		reason = Texts.requireNotBlank(reason, "추천 근거");
	}
}
