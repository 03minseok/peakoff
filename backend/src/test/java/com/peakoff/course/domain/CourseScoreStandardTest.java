package com.peakoff.course.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 총점을 숫자로 말해도 되는 조건.
 *
 * <p>아래 모양들은 실측에서 실제로 가장 흔했던 코스다(2026-08-25, 지역별 코스 120개).
 * 경주의 {@code 1/3}이 120개 중 19개로 1위였다 — 관광지 셋을 담아 하나만 진단되는 코스다.
 */
class CourseScoreStandardTest {

	@Test
	@DisplayName("한 칸만 진단됐으면 평균이라는 말이 성립하지 않는다")
	void oneIsNotAnAverage() {
		// 경주에서 가장 흔했던 모양
		assertThat(CourseScoreStandard.isTotalPresentable(1, 3)).isFalse();
		assertThat(CourseScoreStandard.isTotalPresentable(1, 1)).isFalse();
	}

	@Test
	@DisplayName("두 칸 이상이고 절반을 넘으면 보여준다")
	void twoOutOfThreeIsEnough() {
		assertThat(CourseScoreStandard.isTotalPresentable(2, 3)).isTrue();
		assertThat(CourseScoreStandard.isTotalPresentable(2, 2)).isTrue();
		assertThat(CourseScoreStandard.isTotalPresentable(5, 5)).isTrue();
	}

	@Test
	@DisplayName("경계는 딱 절반까지 통과한다")
	void halfPasses() {
		assertThat(CourseScoreStandard.isTotalPresentable(2, 4)).isTrue();   // 0.50
		assertThat(CourseScoreStandard.isTotalPresentable(2, 5)).isFalse();  // 0.40
		assertThat(CourseScoreStandard.isTotalPresentable(3, 6)).isTrue();   // 0.50
		assertThat(CourseScoreStandard.isTotalPresentable(3, 7)).isFalse();  // 0.43
	}

	/**
	 * 개수만 보면 통과하지만 비율에서 걸린다. 열 곳 중 둘이 나머지 여덟을
	 * 대표한다고 말할 근거가 없다.
	 */
	@Test
	@DisplayName("개수를 채워도 비율이 낮으면 막는다")
	void countAloneIsNotEnough() {
		assertThat(CourseScoreStandard.isTotalPresentable(2, 10)).isFalse();
	}

	@Test
	@DisplayName("예측 대상 칸이 없으면 나눌 수가 없다")
	void noDenominator() {
		// 음식점만 담은 코스. 0으로 나누지 않고 막는다
		assertThat(CourseScoreStandard.isTotalPresentable(0, 0)).isFalse();
	}
}
