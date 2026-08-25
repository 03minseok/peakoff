package com.peakoff.recommendation.domain;

/**
 * 대안이 되기 위해 갖춰야 할 기준.
 *
 * <p>{@link RecommendationScorer}가 "몇 점인가"를 답한다면, 여기는 <b>"애초에 후보 자격이
 * 있는가"</b>를 답한다. 점수를 매기기 전에 통과해야 하는 문이다.
 *
 * <h2>왜 도메인에 두는가</h2>
 * 후보를 어디서 가져오는지는 공급자마다 다르지만(목업은 카탈로그에서, 실데이터는 연관
 * 관광지에서), <b>무엇을 대안이라 부를 수 있는가는 하나여야 한다.</b> 각자 자기 기준을
 * 들고 있으면 목업과 실데이터가 다른 규칙으로 답한다.
 *
 * <h2>왜 뽑기 전에 걸러야 하는가</h2>
 * 순서가 규칙이다 — <b>거르기가 먼저이고 뽑기가 마지막이다.</b> 가중 무작위로 뽑은 뒤에
 * 이 기준을 적용하면, 자격 있는 후보가 Pool에 더 있었는데도 뽑힌 것들만 걸러져
 * 목록이 이유 없이 짧아진다. 최악의 경우 자격 미달 후보가 무작위로 1등이 된다.
 */
public final class AlternativeStandard {

	/**
	 * 대안이라고 말하기 위해 원래 장소보다 더 한적해야 하는 최소 폭.
	 *
	 * <h3>왜 하한이 필요한가</h3>
	 * 없으면 <b>원래 장소보다 더 붐비는 곳도 "대안"으로 나간다.</b> 붐비는 곳을 피하라고
	 * 안내하는 서비스가 더 붐비는 곳을 권하는 셈이라, 과제와 정면으로 어긋난다.
	 *
	 * <p>0점이 아니라 5점인 이유: 1~2점 차이는 예측값의 오차 범위 안에 있다. 그 정도로
	 * "여기가 더 낫다"고 말하면 사용자에게 장소를 바꾸는 수고를 시켜 놓고 실제로는
	 * 아무것도 나아지지 않는다.
	 *
	 * <p><b>날짜 대안의 하한과 값은 같지만 같은 상수를 쓰지 않는다</b>
	 * ({@code DateAlternativeService.MIN_IMPROVEMENT}). 날짜를 옮기는 것은 숙소·교통까지
	 * 딸린 큰 결정이고 장소 하나를 바꾸는 것은 가볍다 — 실행 비용이 다르니 언제든 갈릴 값이다.
	 * 지금 같다는 이유로 묶어 두면 한쪽을 조정할 때 다른 쪽이 딸려 온다.
	 *
	 * <h3>이 값이 화면에 미치는 영향 (실측, 2026-08-25)</h3>
	 * 대안이 하나라도 있던 자리 중 경주 49곳→24곳, 제주시 114곳→72곳, 서귀포 97곳→62곳만
	 * 남는다. <b>사라지는 자리의 상당수는 원래 장소가 이미 한적한 곳이다</b>(경주는 25곳 중 22곳).
	 * 그래서 목록을 비우는 것으로 끝내지 않고 {@link PlaceOffStatus}가 이유를 함께 전한다.
	 */
	public static final int MIN_QUIETNESS_GAIN = 5;

	private AlternativeStandard() {
	}

	/**
	 * 이 후보를 대안이라고 말할 수 있는가.
	 *
	 * @param originQuietness    원래 장소의 그 날 한적도
	 * @param candidateQuietness 후보의 그 날 한적도
	 */
	public static boolean isWorthSuggesting(int originQuietness, int candidateQuietness) {
		return candidateQuietness - originQuietness >= MIN_QUIETNESS_GAIN;
	}
}
