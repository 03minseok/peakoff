package com.peakoff.congestion.domain;

import com.peakoff.global.support.Scores;

/**
 * 공사 집중률을 한적도로 뒤집는 규칙. <b>한 곳에만 둔다.</b>
 *
 * <p>공사 값은 <b>높을수록 붐비고</b> 우리 한적도는 반대다. 이 변환이 여러 곳에 흩어지면
 * 한쪽만 고쳐져 <b>같은 자료가 화면마다 다른 숫자</b>가 된다 — 임계값을 서버 한 곳에만
 * 두는 것과 같은 이유다({@link CongestionLevel}).
 *
 * <p>⚠️ <b>지금 식은 임시값이다.</b> 실측 관측 범위가 33~69라 단순히 뒤집으면 한적도가
 * 31~67에 모인다. 3단계 배지의 경계와 잘 맞는지, 아니면 관측 분포에 맞춰 늘려야 하는지는
 * 분석 담당이 실제 데이터로 확정한다. 그때 고칠 자리가 이 파일 하나다.
 */
public final class Quietness {

	private Quietness() {
	}

	/**
	 * @param concentrationRate 공사 집중률 (0~100, 높을수록 붐빔)
	 * @return 한적도 (0~100, 높을수록 한적)
	 */
	public static int of(double concentrationRate) {
		double quietness = Scores.MAX - concentrationRate;
		return (int) Math.round(Math.clamp(quietness, Scores.MIN, Scores.MAX));
	}
}
