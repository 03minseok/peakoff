package com.peakoff.recommendation.domain;

/**
 * 추천도를 이루는 항목들의 반영 비율(%).
 *
 * <p>비율을 상수가 아니라 <b>타입</b>으로 만든 이유는 두 가지다.
 *
 * <p>첫째, 비율을 쓰는 곳이 둘이 됐다. 교체 추천은 고정 비율을 쓰지만, 설문 코스 생성은
 * 사용자의 혼잡 민감도에 따라 비율이 달라진다. 각자 숫자를 들고 있으면 분석 결과로 값이
 * 바뀔 때 한쪽만 고쳐진다.
 *
 * <p>둘째, <b>지켜야 할 규칙을 생성자가 강제한다.</b> 아래 두 규칙은 주석으로 적어두면
 * 언젠가 깨지지만, 생성자에 두면 깨진 값이 애초에 만들어지지 않는다.
 *
 * <p>⚠️ <b>연관성 필드를 여기 넣지 않는다</b>(2026-08-31 확정). 한때 "연관 관광지
 * 데이터가 붙으면 {@code relatedness} 필드가 늘어난다"고 적어 두었는데, 실측 결과
 * 넣으면 안 되는 값이었다 — 연관 순위와 한적도가 <b>음의 상관</b>이라
 * (6개 지역 26,819쌍, 켄달 타우 -0.073) 가점을 주면 더 붐비는 곳을 더 밀게 된다.
 * 연관 관광지는 점수가 아니라 <b>후보를 고르는 문</b>으로 쓴다({@link CandidateSource}).
 *
 * <p>항목이 늘 일이 아주 없지는 않다. 그때도 합이 100이고 한적도가 최대라는 규칙은
 * 이 파일 한 곳에 남는다.
 *
 * @param quietness 한적도 반영 비율
 * @param proximity 동선 근접도 반영 비율
 */
public record ScoreWeights(int quietness, int proximity) {

	/**
	 * 교체 추천이 쓰는 기본 비율.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b> 실제 데이터로 확정해야 한다.
	 */
	public static final ScoreWeights DEFAULT = new ScoreWeights(70, 30);

	/**
	 * 비교 대상이 없는 자리에 쓴다.
	 *
	 * <p>코스의 첫 장소처럼 앞에 놓인 것이 없으면 "무엇에 가까운가"를 잴 수 없다.
	 * 그 자리에서는 한적도가 판단의 전부가 된다.
	 */
	public static final ScoreWeights QUIETNESS_ONLY = new ScoreWeights(100, 0);

	public ScoreWeights {
		/*
		 * 합이 100이어야 가중합 결과가 0~100 척도 안에 남는다.
		 * 90이면 아무리 좋은 후보도 90점을 못 넘고, 110이면 척도를 넘어선다.
		 */
		if (quietness + proximity != 100) {
			throw new IllegalArgumentException(
					"반영 비율의 합은 100이어야 합니다. 입력값: 한적도 %d + 근접도 %d = %d"
							.formatted(quietness, proximity, quietness + proximity));
		}
		/*
		 * 서비스 정체성이 걸린 규칙이다. 근접도가 한적도를 넘어서면 "가깝기만 하면 붐벼도 좋다"가
		 * 되어, 덜 붐비는 곳으로 안내한다는 목적과 오버투어리즘 과제에 정면으로 어긋난다.
		 * 설문의 "유명한 곳 위주"조차 이 선은 넘지 못한다.
		 */
		if (proximity > quietness) {
			throw new IllegalArgumentException(
					"한적도의 반영 비율이 가장 높아야 합니다. 입력값: 한적도 %d, 근접도 %d"
							.formatted(quietness, proximity));
		}
	}
}
