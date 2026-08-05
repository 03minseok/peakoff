package com.peakoff.recommendation.domain;

import com.peakoff.global.support.Scores;
import com.peakoff.global.support.Texts;

/**
 * 추천도를 이루는 항목 하나.
 *
 * <p>추천도를 숫자 하나로만 내려보내면 "왜 82점인지"를 화면에서 설명할 수 없다.
 * 여러 항목을 합친 점수일수록 결과만으로는 근거가 사라진다.
 * 항목별 점수와 반영 비율을 함께 내려 사용자가 직접 확인하게 한다.
 *
 * <p>반영 비율을 서버가 들고 있는 이유는 한적도 임계값과 같다.
 * 화면에 비율을 적어두면 분석 결과로 가중치가 바뀔 때 한쪽만 고쳐져 두 값이 어긋난다.
 *
 * @param label         항목 이름 (예: "한적도")
 * @param score         이 항목의 점수 (0~100)
 * @param weightPercent 추천도에 반영된 비율(%). 모든 항목을 더하면 100이 된다
 * @param detail        점수의 근거를 짧게 (예: "예상 혼잡 낮음", "직선거리 3.2km")
 */
public record ScoreFactor(String label, int score, int weightPercent, String detail) {

	public ScoreFactor {
		label = Texts.requireNotBlank(label, "항목 이름");
		Scores.validate(score, label);
		if (weightPercent < 0 || weightPercent > 100) {
			throw new IllegalArgumentException("반영 비율은 0~100이어야 합니다. 입력값: " + weightPercent);
		}
		detail = Texts.requireNotBlank(detail, "항목 근거");
	}
}
