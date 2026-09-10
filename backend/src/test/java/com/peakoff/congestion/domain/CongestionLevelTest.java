package com.peakoff.congestion.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 한적도 3단계 경계 — <b>65 / 35</b>.
 *
 * <p>값 자체는 분석이 정한다(전국 64개 시군구 · 관측 87,150건, 2026-08-31). 여기서 잠그는 것은
 * <b>경계가 어느 쪽에 붙는가</b>다 — 65는 한적이고 64는 보통, 35는 보통이고 34는 붐빔.
 * 마감 직전에 부등호를 잘못 건드리면 화면의 배지가 한 점씩 밀리는데,
 * 눈으로는 알 수 없는 종류의 고장이다.
 *
 * <p>⚠️ 경계를 옮길 때는 {@code CrowdSensitivity}의 "붐비는 곳 제외"도 같은 자를 쓴다.
 * 이 테스트가 깨지면 그쪽도 함께 봐야 한다.
 */
class CongestionLevelTest {

	@Test
	@DisplayName("65 이상이 한적이다 — 경계값이 한적 쪽에 붙는다")
	void quietStartsAt65() {
		assertThat(CongestionLevel.fromQuietness(65)).isEqualTo(CongestionLevel.QUIET);
		assertThat(CongestionLevel.fromQuietness(64)).isEqualTo(CongestionLevel.MODERATE);
		assertThat(CongestionLevel.fromQuietness(100)).isEqualTo(CongestionLevel.QUIET);
	}

	@Test
	@DisplayName("35 이상 65 미만이 보통이다 — 아래 경계도 보통 쪽에 붙는다")
	void moderateStartsAt35() {
		assertThat(CongestionLevel.fromQuietness(35)).isEqualTo(CongestionLevel.MODERATE);
		assertThat(CongestionLevel.fromQuietness(34)).isEqualTo(CongestionLevel.CROWDED);
		assertThat(CongestionLevel.fromQuietness(0)).isEqualTo(CongestionLevel.CROWDED);
	}

	@Test
	@DisplayName("상수와 판정이 같은 값을 본다 — 한쪽만 고쳐지지 않게")
	void thresholdsAreTheOnesUsed() {
		assertThat(CongestionLevel.fromQuietness(CongestionLevel.QUIET_THRESHOLD)).isEqualTo(CongestionLevel.QUIET);
		assertThat(CongestionLevel.fromQuietness(CongestionLevel.QUIET_THRESHOLD - 1)).isEqualTo(CongestionLevel.MODERATE);
		assertThat(CongestionLevel.fromQuietness(CongestionLevel.MODERATE_THRESHOLD)).isEqualTo(CongestionLevel.MODERATE);
		assertThat(CongestionLevel.fromQuietness(CongestionLevel.MODERATE_THRESHOLD - 1)).isEqualTo(CongestionLevel.CROWDED);
	}

	@Test
	@DisplayName("배지 글자는 한적 · 보통 · 붐빔 — 화면이 이 글자를 그대로 쓴다")
	void labels() {
		assertThat(CongestionLevel.QUIET.label()).isEqualTo("한적");
		assertThat(CongestionLevel.MODERATE.label()).isEqualTo("보통");
		assertThat(CongestionLevel.CROWDED.label()).isEqualTo("붐빔");
	}
}
