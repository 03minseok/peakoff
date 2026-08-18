package com.peakoff.recommendation.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.ToIntFunction;
import java.util.random.RandomGenerator;

import org.springframework.stereotype.Component;

/**
 * 상위 후보군에서 점수에 비례한 확률로 하나를 뽑는다.
 *
 * <h2>왜 그냥 1등을 쓰지 않는가</h2>
 * <b>같은 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 된다.</b>
 * 붐비는 곳을 피하라고 안내해 놓고 정작 한 곳으로 몰아주면, 서비스가 직접 2차 오버투어리즘을
 * 만드는 셈이다. 점수가 높을수록 뽑힐 확률이 높되, 매번 같은 결과가 나오지는 않게 한다.
 *
 * <p>이 분산은 <b>추천의 정확도를 포기하는 것이 아니다.</b> 후보군을 상위 몇 곳으로 먼저 자르기
 * 때문에, 뽑히는 것은 언제나 "충분히 좋은 후보" 안에서다. 10등이 1등을 제치는 일은 없다.
 *
 * <p>지금은 설문 코스 생성만 쓰지만, 장소 교체 추천에도 같은 규칙이 필요하다.
 * 그때 이 컴포넌트를 그대로 쓰면 분산 규칙이 한 곳에 남는다.
 */
@Component
public class WeightedPicker {

	private final RandomGenerator random;

	public WeightedPicker(RandomGenerator random) {
		this.random = random;
	}

	/**
	 * @param candidates 후보 목록. 비어 있으면 빈 값을 돌려준다
	 * @param score      후보의 점수(0~100). 이 값이 곧 뽑힐 가중치가 된다
	 * @param bias       집중도. 1이면 점수에 비례, 클수록 상위 후보에 쏠린다.
	 *                   설문의 혼잡 민감도가 이 값을 정한다
	 * @param poolSize   상위 몇 곳까지를 후보군으로 볼지
	 */
	public <T> Optional<T> pick(List<T> candidates, ToIntFunction<T> score, double bias, int poolSize) {
		if (candidates.isEmpty()) {
			return Optional.empty();
		}
		if (poolSize < 1) {
			throw new IllegalArgumentException("후보군 크기는 1 이상이어야 합니다. 입력값: " + poolSize);
		}

		List<T> pool = candidates.stream()
				.sorted(Comparator.comparingInt(score).reversed())
				.limit(poolSize)
				.toList();

		double[] weights = new double[pool.size()];
		double total = 0;
		for (int i = 0; i < pool.size(); i++) {
			/*
			 * 점수 0인 후보를 확률 0으로 두면 후보군이 전부 0점일 때 아무것도 못 뽑는다.
			 * 1로 바닥을 깔아 "거의 안 뽑히지만 뽑힐 수는 있는" 상태로 둔다.
			 */
			weights[i] = Math.pow(Math.max(score.applyAsInt(pool.get(i)), 1), bias);
			total += weights[i];
		}

		double roll = random.nextDouble() * total;
		for (int i = 0; i < pool.size(); i++) {
			roll -= weights[i];
			if (roll <= 0) {
				return Optional.of(pool.get(i));
			}
		}
		// 부동소수점 오차로 마지막 칸을 스쳐 지나갔을 때의 대비.
		return Optional.of(pool.get(pool.size() - 1));
	}
}
