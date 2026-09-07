package com.peakoff.congestion.domain;

import com.peakoff.global.support.Scores;

/**
 * 공사 집중률을 한적도로 뒤집는 규칙. <b>한 곳에만 둔다.</b>
 *
 * <p>공사 값은 <b>높을수록 붐비고</b> 우리 한적도는 반대다. 이 변환이 여러 곳에 흩어지면
 * 한쪽만 고쳐져 <b>같은 자료가 화면마다 다른 숫자</b>가 된다 — 임계값을 서버 한 곳에만
 * 두는 것과 같은 이유다({@link CongestionLevel}).
 *
 * <h3>✅ 단순히 뒤집는 것으로 확정됐다 (2026-08-31 전국 실측)</h3>
 * 한때 여기 <b>"지금 식은 임시값"</b>이라 적어 두었다. 서비스 지역 셋만 볼 때 관측 범위가
 * 33~69라 뒤집으면 31~67에 모여서, 관측 분포에 맞춰 <b>늘려야 하는 것 아닌가</b> 싶었다.
 *
 * <p>전국 표본(64개 시군구 · 관측 87,150건)으로 보니 <b>늘릴 여지가 없다.</b>
 * 집중률 원자료가 <b>0.3 ~ 100.0</b>으로 척도 전 구간을 쓰고 있었다 — 좁아 보였던 것은
 * 척도의 문제가 아니라 우리가 지역 셋만 보고 있어서였다.
 *
 * <p>장소별 30일 합계가 322 ~ 2,957로 제각각이라(변동계수 0.32) <b>장소 안 정규화도 아니다</b> —
 * 즉 장소 간 절대 비교가 성립한다. 늘리면 오히려 그 성질이 깨진다.
 * 근거는 {@code analysis/national/RESULTS.md}.
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
