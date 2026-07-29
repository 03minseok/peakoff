package com.peakoff.congestion.domain;

import java.time.LocalDate;

/**
 * 특정 장소가 특정 날짜에 얼마나 한적할지 공급한다. (0~100, 클수록 한적)
 *
 * <p>실제 구현은 집중률 예측 데이터를 호출한다. 예측·통계값이므로 화면 문구는
 * "실시간 혼잡"이 아니라 "예상 혼잡"이어야 한다.
 *
 * <p>날짜를 인자로 받는 이유: 같은 장소라도 날짜에 따라 값이 다르다.
 * "더 한적한 날짜 안내" 기능이 이 시그니처 위에 그대로 올라간다 — 날짜만 바꿔 호출하면 된다.
 */
public interface CongestionProvider {

	/**
	 * @return 0~100 한적도
	 * @throws IllegalArgumentException 해당 장소의 예측 데이터가 없을 때.
	 *         "데이터 없음"을 0점으로 뭉개면 화면에서 "매우 붐빔"으로 잘못 읽힌다.
	 *         호출 전에 {@link #hasData(String)}로 확인한다.
	 */
	int quietnessOf(String placeId, LocalDate date);

	/** 해당 장소의 예측 데이터를 갖고 있는지. 없으면 화면에서 "예측 불가"로 표시해야 한다. */
	boolean hasData(String placeId);
}
