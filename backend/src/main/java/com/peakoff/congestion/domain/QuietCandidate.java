package com.peakoff.congestion.domain;

import java.time.LocalDate;
import java.util.Objects;

/**
 * 아직 우리 장소로 잇지 않은 한적 후보. <b>공사가 부르는 이름</b>과 그 이름이 가장 한적한 날만 안다.
 *
 * <h3>왜 {@link QuietSpot} 앞에 이 단계가 생겼는가</h3>
 * 예측 이름을 우리 장소로 잇는 일은 지역 카탈로그를 통째로 훑는 <b>비싼 작업</b>이다.
 * 그런데 홈이 고르는 범위를 지역 상위 35%로 넓히면 그 후보가 지역마다 24~85곳이 된다
 * (2026-09-03 실측). 전부 이어 놓고 그중 하나를 뽑으면 화면 한 번에 수백 번의 이름 대조가 난다.
 *
 * <p>그래서 순서를 뒤집는다 — <b>이름 상태로 먼저 뽑고, 뽑힌 하나만 잇는다.</b>
 * 이름·날짜·한적도는 캐시된 예측에서 바로 나오므로 뽑기 직전까지는 값이 공짜다.
 *
 * <p>⚠️ <b>이 값은 화면으로 나가지 않는다.</b> 공사 이름 원문({@code "경주 불국사 [유네스코…]"})은
 * 우리가 부르는 이름이 아니고, 좌표·분류·사진도 없다. 화면이 받는 것은 언제나
 * 장소로 이어진 {@link QuietSpot}이다.
 *
 * @param forecastName 공사 예측이 쓰는 관광지명 원문
 * @param date         살펴본 기간 중 <b>가장 한적한 날</b>
 * @param quietness    그 날의 한적도 (0~100, 클수록 한적)
 */
public record QuietCandidate(String forecastName, LocalDate date, int quietness) {

	public QuietCandidate {
		Objects.requireNonNull(forecastName, "예측 관광지명은 필수입니다.");
		Objects.requireNonNull(date, "날짜는 필수입니다.");
	}

	public CongestionLevel level() {
		return CongestionLevel.fromQuietness(quietness);
	}
}
