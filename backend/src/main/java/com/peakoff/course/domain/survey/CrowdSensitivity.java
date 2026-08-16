package com.peakoff.course.domain.survey;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.recommendation.domain.ScoreWeights;

/**
 * 설문 3번 — 혼잡 민감도. <b>이 서비스 정체성의 핵심 문항이다.</b>
 *
 * <p>답에 따라 조작하는 것이 셋이다.
 * <ul>
 *   <li><b>한적도 반영 비율</b> — 추천도에서 한적도가 차지하는 몫</li>
 *   <li><b>후보 하한</b> — 붐빌 것으로 예측되는 곳을 후보에서 아예 뺄지</li>
 *   <li><b>추출 집중도</b> — 가중 무작위 추출에서 상위 후보에 얼마나 쏠릴지</li>
 * </ul>
 *
 * <h2>"유명한 곳 위주"를 골라도 한적도가 최대 비율이다</h2>
 * 세 답 모두 한적도의 반영 비율이 가장 높다. {@link ScoreWeights} 생성자가 이 규칙을 강제하므로
 * 어기는 값은 애초에 만들어지지 않는다.
 *
 * <p>그래서 <b>"유명한 곳 위주"는 "대표 명소를 후보에서 빼지 않는다"는 뜻이지
 * "붐비는 곳으로 몰아준다"는 뜻이 아니다.</b> 붐비는 곳으로 사람을 보내는 것은
 * 오버투어리즘을 줄이겠다는 과제와 정면으로 어긋나서, 설문 답 하나로 뒤집을 수 있는 것이 아니다.
 *
 * <p>실제로 명소가 코스에 오르게 하는 장치는 둘이다 — <b>한적도 하한을 걸지 않는 것</b>과,
 * <b>추출 분포를 평탄하게 해</b> 한적도가 낮은 후보도 뽑힐 여지를 주는 것이다.
 * 인기도를 가점으로 쓰지 않으므로 과제와 모순되는 지점이 없다.
 *
 * <p><b>아래 값은 분석 검증 전 임시값이다.</b>
 */
public enum CrowdSensitivity {

	/**
	 * 대표 명소를 후보에서 빼지 않는다. 하한도 없고 후보군을 자르지도 않는다.
	 *
	 * <p><b>후보군을 자르지 않는 것이 이 답의 핵심 장치다.</b> 후보군은 추천도 순으로 자르는데,
	 * 추천도에서 한적도가 가장 큰 몫이라 대표 명소는 언제나 뒤쪽에 선다.
	 * 상위 몇 곳만 남기면 명소는 영영 뽑히지 않는다.
	 */
	// Integer.MAX_VALUE = 후보군을 자르지 않는다는 뜻.
	// 상수 이름을 붙이지 못하는 이유: enum 상수는 static 필드보다 먼저 초기화돼서
	// 생성자 인자에 자기 타입의 static 필드를 쓸 수 없다.
	POPULAR("유명한 곳 위주", new ScoreWeights(55, 45), false, 1.0, Integer.MAX_VALUE),

	MIXED("적당히 섞기", ScoreWeights.DEFAULT, false, 1.5, 8),

	/**
	 * 붐빌 것으로 예측되는 곳을 후보에서 뺀다. 남은 후보 중에서도 상위에 강하게 쏠린다.
	 */
	QUIET("한적한 곳 위주", new ScoreWeights(85, 15), true, 2.0, 5);

	private final String label;
	private final ScoreWeights weights;
	private final boolean excludesCrowded;
	private final double pickBias;
	private final int candidatePoolSize;

	CrowdSensitivity(String label, ScoreWeights weights, boolean excludesCrowded,
			double pickBias, int candidatePoolSize) {
		this.label = label;
		this.weights = weights;
		this.excludesCrowded = excludesCrowded;
		this.pickBias = pickBias;
		this.candidatePoolSize = candidatePoolSize;
	}

	/**
	 * 추천도 상위 몇 곳까지를 후보군으로 볼지.
	 *
	 * <p>좁을수록 좋은 후보만 남지만 결과가 뻔해지고, 넓을수록 분산되지만 덜 맞는 곳도 섞인다.
	 */
	public int candidatePoolSize() {
		return candidatePoolSize;
	}

	/**
	 * 이 후보를 코스에 올릴 수 있는지. 점수가 아니라 <b>하한 필터</b>다.
	 *
	 * <p>"한적한 곳 위주"를 고른 사용자에게 붐빌 것으로 예측되는 곳을 추천하면,
	 * 점수를 아무리 잘 설명해도 답과 어긋난 결과가 된다.
	 */
	public boolean allows(int quietness) {
		if (!excludesCrowded) {
			return true;
		}
		return CongestionLevel.fromQuietness(quietness) != CongestionLevel.CROWDED;
	}

	/** 추천도 항목별 반영 비율. */
	public ScoreWeights weights() {
		return weights;
	}

	/**
	 * 가중 무작위 추출의 집중도. 1이면 점수에 비례, 클수록 상위 후보에 쏠린다.
	 *
	 * <p>분산 자체를 없애지는 않는다. 같은 대안이 모든 사용자에게 반복 추천되면
	 * 그곳이 새로운 혼잡지가 되기 때문이다 — 2차 오버투어리즘.
	 */
	public double pickBias() {
		return pickBias;
	}

	public String label() {
		return label;
	}
}
