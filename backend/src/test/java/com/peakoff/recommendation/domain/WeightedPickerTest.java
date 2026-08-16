package com.peakoff.recommendation.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.function.ToIntFunction;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WeightedPickerTest {

	/** 씨앗을 고정한다. 분산은 일부러 결과를 흔드는 장치라 고정하지 않으면 검증할 수 없다. */
	private final WeightedPicker picker = new WeightedPicker(new Random(42));

	private static final ToIntFunction<Integer> ITSELF = score -> score;

	@Test
	@DisplayName("후보가 없으면 빈 값을 돌려준다 — 예외를 던지지 않는다")
	void returnsEmptyWhenNoCandidates() {
		assertThat(picker.pick(List.of(), ITSELF, 1.0, 5)).isEmpty();
	}

	/**
	 * 분산이 추천의 정확도를 포기하는 것이 아님을 못박는 테스트다.
	 * 뽑히는 것은 언제나 "충분히 좋은 후보" 안에서다.
	 */
	@Test
	@DisplayName("후보군 밖의 낮은 점수는 아무리 뽑아도 나오지 않는다")
	void neverPicksOutsideThePool() {
		List<Integer> candidates = List.of(10, 20, 30, 40, 50, 60, 70, 80, 90, 100);

		Set<Integer> picked = IntStream.range(0, 500)
				.mapToObj(i -> picker.pick(candidates, ITSELF, 1.0, 3).orElseThrow())
				.collect(Collectors.toSet());

		// 상위 3곳은 100, 90, 80이다.
		assertThat(picked).containsExactlyInAnyOrder(100, 90, 80);
	}

	@Test
	@DisplayName("같은 후보를 여러 번 물으면 매번 같은 답이 나오지는 않는다 — 2차 오버투어리즘 방지")
	void spreadsAcrossCandidates() {
		List<Integer> candidates = List.of(70, 80, 90);

		Set<Integer> picked = IntStream.range(0, 200)
				.mapToObj(i -> picker.pick(candidates, ITSELF, 1.0, 3).orElseThrow())
				.collect(Collectors.toSet());

		assertThat(picked).hasSizeGreaterThan(1);
	}

	@Test
	@DisplayName("점수가 높을수록 자주 뽑힌다 — 무작위지만 아무렇게나는 아니다")
	void favoursHigherScores() {
		List<Integer> candidates = List.of(10, 100);

		long highCount = IntStream.range(0, 500)
				.mapToObj(i -> picker.pick(candidates, ITSELF, 1.0, 2).orElseThrow())
				.filter(picked -> picked == 100)
				.count();

		// 가중치 10 대 100이므로 100 쪽이 압도적이어야 한다.
		assertThat(highCount).isGreaterThan(400);
	}

	@Test
	@DisplayName("집중도를 올리면 상위 후보에 더 쏠린다 — 혼잡 민감도가 이 값을 바꾼다")
	void higherBiasConcentratesOnTop() {
		List<Integer> candidates = List.of(40, 80);

		long flat = countTopPicks(candidates, 1.0);
		long steep = countTopPicks(candidates, 3.0);

		assertThat(steep).isGreaterThan(flat);
	}

	private long countTopPicks(List<Integer> candidates, double bias) {
		return IntStream.range(0, 500)
				.mapToObj(i -> picker.pick(candidates, ITSELF, bias, 2).orElseThrow())
				.filter(picked -> picked == 80)
				.count();
	}

	@Test
	@DisplayName("점수가 전부 0이어도 하나는 뽑는다 — 확률이 0이면 코스에 빈 자리가 생긴다")
	void picksEvenWhenEveryScoreIsZero() {
		assertThat(picker.pick(List.of(0, 0, 0), ITSELF, 2.0, 3)).isPresent();
	}

	@Test
	@DisplayName("후보군 크기가 0 이하면 거부한다")
	void rejectsInvalidPoolSize() {
		assertThatThrownBy(() -> picker.pick(List.of(1, 2), ITSELF, 1.0, 0))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
