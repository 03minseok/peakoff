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

	/**
	 * 대안 추천 계열이 함께 쓰는 <b>후보군 크기</b>와 <b>쏠림 정도</b>. (2026-08-26 실측)
	 *
	 * <p>여기 모아 둔 이유: 같은 값을 쓰는 곳이 둘이다 — 장소 교체의 실데이터와 목업.
	 * 각자 적어 두면 분석 결과로 값이 바뀔 때 한쪽만 고쳐지고,
	 * 그러면 화면마다 다른 분산이 걸린다.
	 *
	 * <p>⚠️ 홈의 "이번 주 한적한 곳"은 <b>2026-09-03에 여기서 빠졌다.</b> 후보를
	 * "지역 상위 35%"로 먼저 자르고 나면 그 안은 전부 충분히 한적해서, 점수로 다시
	 * 쏠림을 줄 근거가 없다 — 그쪽은 {@link #pickEvenly}를 쓴다.
	 *
	 * <p>왜 3과 1.2인지는 {@code KtoRecommendationProvider}에 실측과 함께 적어 두었다.
	 *
	 * <p>⚠️ <b>설문 코스 생성은 자기 값을 쓴다</b>({@code CrowdSensitivity}).
	 * 후보 풀의 성격이 달라(대표 관광지 100곳에서 고른다) 같은 값을 강요할 근거가 없다.
	 */
	public static final int DEFAULT_POOL_SIZE = 3;

	/** @see #DEFAULT_POOL_SIZE */
	public static final double DEFAULT_BIAS = 1.2;

	private final RandomGenerator random;

	public WeightedPicker(RandomGenerator random) {
		this.random = random;
	}

	/**
	 * 후보군 안에서 <b>점수를 보지 않고</b> 하나를 고른다.
	 *
	 * <h3>언제 가중이 아니라 균등인가</h3>
	 * {@link #pick}은 "좋은 후보에 더 많이"라는 규칙이고, 그러려면 <b>후보들 사이에
	 * 우열이 있어야</b> 한다. 그런데 부르는 쪽이 이미 자격선으로 후보를 잘라 놓았다면
	 * 남은 것들 사이의 점수 차는 우열이 아니라 <b>같은 등급 안의 잔차</b>다.
	 * 그 잔차로 확률을 기울이면, 넓혀 놓은 후보군에서 결국 위쪽 몇만 뽑힌다.
	 *
	 * <p>홈의 "이번 주 한적한 곳"이 그 자리다 — 지역 상위 35%(한적도 70~80 이상)로
	 * 자른 뒤라 그 안은 전부 한적 등급이다. 76점과 79점 사이에 순위를 매길 이유가 없다.
	 *
	 * @param candidates 이미 자격선을 통과한 후보들. 비어 있으면 빈 값
	 */
	public <T> Optional<T> pickEvenly(List<T> candidates) {
		if (candidates.isEmpty()) {
			return Optional.empty();
		}
		return Optional.of(candidates.get(random.nextInt(candidates.size())));
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
