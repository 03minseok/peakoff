package com.peakoff.course.domain;

/**
 * 코스 총점을 <b>숫자로 말해도 되는가</b>를 가른다.
 *
 * <h2>왜 이런 문이 필요한가</h2>
 * 총점은 진단된 칸만의 평균이다. 그런데 공사 집중률이 닿는 곳이 좁아서, 관광지 셋을 담아도
 * 한 곳만 진단되는 일이 흔하다. <b>그 한 곳의 점수를 "코스 총점"이라 부르면 설명할 수 없다.</b>
 *
 * <p>실측(2026-08-25, 지역별 코스 120개)에서 가장 흔한 모양이 경주의 {@code 1/3}이었다 —
 * 관광지 셋 중 하나만 진단된 코스가 120개 중 19개다.
 *
 * <h2>여기가 저장을 막지는 않는다</h2>
 * ⚠️ 이 판단은 <b>화면에 숫자를 띄울지</b>에만 쓴다. 조건을 못 채운 코스도 저장은 된다 —
 * 저장은 그때의 점수를 스냅샷으로 남기는 일인데, 점수와 함께 <b>모수</b>(진단 2곳 / 관광지 5곳)를
 * 남기면 스냅샷이 오히려 더 정직해진다. 나중에 열었을 때 "5곳 중 2곳 기준"이라고 말할 수 있고,
 * 코스끼리 견줄 때도 "이 코스는 근거가 얇다"가 드러난다.
 *
 * <p>둘을 묶었다면 실측 기준 <b>경주 코스의 41.7%가 저장 불가</b>가 됐다. 경주는 파일럿
 * 지역이라 심사에서 가장 많이 쓸 곳이다.
 */
public final class CourseScoreStandard {

	/**
	 * 총점을 숫자로 말하려면 최소 몇 칸이 진단돼야 하는가.
	 *
	 * <p>한 칸으로는 "평균"이라는 말 자체가 성립하지 않는다. 그 칸 하나가 흔들리면
	 * 총점이 통째로 흔들리는데, 원안 대비 개선폭(발표 하이라이트)이 그 위에 놓인다.
	 */
	public static final int MIN_DIAGNOSED = 2;

	/**
	 * 예측 대상 관광지 중 몇 할이 진단돼야 하는가.
	 *
	 * <p>개수만 보면 관광지 열 곳 중 둘이 진단된 코스도 통과한다. 그 둘이 나머지 여덟을
	 * 대표한다고 말할 근거가 없다.
	 */
	public static final double MIN_DIAGNOSED_RATIO = 0.5;

	private CourseScoreStandard() {
	}

	/**
	 * 총점을 숫자로 보여줘도 되는가.
	 *
	 * @param diagnosed     실제로 한적도가 매겨진 칸 수
	 * @param forecastTarget 공사가 <b>예측하기로 되어 있는 분류</b>의 칸 수.
	 *                       음식점·숙박·쇼핑은 여기서 빠진다 — 애초에 예측 대상이 아닌 것을
	 *                       분모에 넣으면 밥집을 담을수록 진단율이 떨어진다
	 */
	public static boolean isTotalPresentable(int diagnosed, int forecastTarget) {
		if (diagnosed < MIN_DIAGNOSED || forecastTarget <= 0) {
			return false;
		}
		return (double) diagnosed / forecastTarget >= MIN_DIAGNOSED_RATIO;
	}
}
