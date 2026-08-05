package com.peakoff.recommendation.domain;

import java.util.List;
import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.global.support.Texts;
import com.peakoff.place.domain.Place;

/**
 * 슬롯을 교체할 대안지 후보.
 *
 * <p>{@code reason}과 {@code factors}를 필수로 둔 것이 이 타입의 핵심이다. 근거 없는 추천은
 * 아예 만들 수 없다. "추천에는 반드시 이유를 함께 보여준다"는 원칙을 문서가 아니라 생성자에서 강제한다.
 *
 * @param place          대안 관광지
 * @param quietness      예상 한적도 (0~100, 클수록 한적). 그 날 이 후보가 얼마나 덜 붐빌지.
 *                       추천도에 이미 반영돼 있지만 원래 값도 그대로 내려보낸다 —
 *                       사용자가 "덜 붐빈다"는 판단의 원본 수치를 확인할 수 있어야 한다
 * @param recommendation 추천도 (0~100). <b>이 서비스가 이곳을 대안으로 얼마나 미는가.</b>
 *                       <b>한적도가 여기 포함된다.</b> 오버투어리즘을 피해 한적한 곳으로
 *                       사람을 보내는 것이 추천의 목적 자체이므로, 한적하지 않은 곳을
 *                       "좋은 대안"이라 부를 수 없기 때문이다. 나머지 구성 항목은
 *                       연관성·카테고리 적합성·동선 근접도이고, <b>한적도의 반영 비율이 가장 높아야 한다.</b>
 * @param factors        추천도가 어떻게 나왔는지 항목별로 쪼갠 내역. 화면에서 그대로 보여준다
 * @param reason         추천 근거 문구 (예: "불국사에서 가까운 같은 분류 · 예상 혼잡 낮음")
 */
public record Alternative(
		Place place,
		int quietness,
		int recommendation,
		List<ScoreFactor> factors,
		String reason) {

	public Alternative {
		Objects.requireNonNull(place, "대안 장소는 필수입니다.");
		Scores.validate(quietness, "한적도");
		Scores.validate(recommendation, "추천도");
		Objects.requireNonNull(factors, "추천도 구성 항목은 필수입니다.");
		if (factors.isEmpty()) {
			throw new IllegalArgumentException("추천도가 어떻게 나왔는지 설명할 항목이 하나 이상 있어야 합니다.");
		}
		// 방어적 복사. 밖에서 넘긴 리스트를 나중에 고쳐도 후보는 흔들리지 않는다.
		factors = List.copyOf(factors);
		reason = Texts.requireNotBlank(reason, "추천 근거");
	}
}
