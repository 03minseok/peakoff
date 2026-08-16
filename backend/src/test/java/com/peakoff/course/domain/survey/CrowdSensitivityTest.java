package com.peakoff.course.domain.survey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.recommendation.domain.ScoreWeights;

class CrowdSensitivityTest {

	/**
	 * 이 서비스의 정체성이 걸린 규칙이다. 근접도가 한적도를 넘어서면 "가깝기만 하면 붐벼도 좋다"가
	 * 되어, 오버투어리즘을 줄이겠다는 과제와 정면으로 어긋난다.
	 *
	 * <p><b>"유명한 곳 위주"조차 예외가 아니다.</b> 그 답은 "대표 명소를 후보에서 빼지 않는다"는
	 * 뜻이지 "붐비는 곳으로 몰아준다"는 뜻이 아니다.
	 */
	@ParameterizedTest
	@EnumSource(CrowdSensitivity.class)
	@DisplayName("어떤 답을 골라도 한적도의 반영 비율이 가장 높다")
	void quietnessAlwaysWeighsMost(CrowdSensitivity sensitivity) {
		ScoreWeights weights = sensitivity.weights();

		assertThat(weights.quietness())
				.as(sensitivity.label() + "의 한적도 반영 비율")
				.isGreaterThanOrEqualTo(weights.proximity());
	}

	@ParameterizedTest
	@EnumSource(CrowdSensitivity.class)
	@DisplayName("반영 비율의 합은 100이다 — 아니면 추천도가 0~100 척도를 벗어난다")
	void weightsSumTo100(CrowdSensitivity sensitivity) {
		ScoreWeights weights = sensitivity.weights();

		assertThat(weights.quietness() + weights.proximity()).isEqualTo(100);
	}

	@Test
	@DisplayName("규칙을 어기는 비율은 아예 만들어지지 않는다")
	void rejectsInvalidWeights() {
		// 근접도가 한적도보다 높다
		assertThatThrownBy(() -> new ScoreWeights(30, 70))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("한적도의 반영 비율이 가장 높아야");

		// 합이 100이 아니다
		assertThatThrownBy(() -> new ScoreWeights(60, 30))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("합은 100");
	}

	@Test
	@DisplayName("'한적한 곳 위주'는 붐빌 것으로 예측되는 곳을 후보에서 뺀다")
	void quietExcludesCrowdedPlaces() {
		int crowded = CongestionLevel.MODERATE_THRESHOLD - 1;

		assertThat(CrowdSensitivity.QUIET.allows(crowded)).isFalse();
		assertThat(CrowdSensitivity.QUIET.allows(CongestionLevel.QUIET_THRESHOLD)).isTrue();
	}

	/**
	 * 후보군을 자르지 않는 것이 "유명한 곳 위주"의 핵심 장치다. 후보군은 추천도 순으로 자르는데
	 * 추천도에서 한적도가 가장 큰 몫이라, 상위 몇 곳만 남기면 대표 명소는 영영 뽑히지 않는다.
	 */
	@Test
	@DisplayName("'유명한 곳 위주'는 후보를 걸러내지도 자르지도 않는다")
	void popularKeepsEveryCandidate() {
		assertThat(CrowdSensitivity.POPULAR.allows(0)).isTrue();
		assertThat(CrowdSensitivity.POPULAR.candidatePoolSize())
				.isGreaterThan(CrowdSensitivity.MIXED.candidatePoolSize());
	}

	@Test
	@DisplayName("한적한 쪽을 고를수록 후보군이 좁고 상위에 쏠린다")
	void stricterAnswersConcentrateMore() {
		assertThat(CrowdSensitivity.QUIET.pickBias())
				.isGreaterThan(CrowdSensitivity.MIXED.pickBias());
		assertThat(CrowdSensitivity.MIXED.pickBias())
				.isGreaterThan(CrowdSensitivity.POPULAR.pickBias());

		assertThat(CrowdSensitivity.QUIET.candidatePoolSize())
				.isLessThan(CrowdSensitivity.MIXED.candidatePoolSize());
	}
}
