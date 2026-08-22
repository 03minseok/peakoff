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

	/**
	 * 해당 장소가 <b>예측 대상</b>인지. 날짜와 무관하다.
	 *
	 * <p>{@code false}면 어느 날짜로 물어도 자료가 없다. 음식점·카페·숙박이 그렇다 —
	 * 공사 집중률은 관광지만 예측한다.
	 */
	boolean hasData(String placeId);

	/**
	 * 그 장소의 <b>그 날짜</b> 자료가 있는지.
	 *
	 * <p>{@link #hasData(String)}와 갈라 둔 이유는 <b>사용자에게 다르게 말해야 하기 때문</b>이다.
	 * 장소가 예측 대상이 아닌 것은 기다려도 생기지 않지만, 날짜가 예측 범위 밖인 것은
	 * 시간이 지나면 생긴다. 둘을 "자료 없음" 하나로 뭉개면 화면이 같은 문구를 쓰게 되고,
	 * 사용자는 서비스의 데이터가 부실하다고 읽는다.
	 */
	boolean hasData(String placeId, LocalDate date);
}
