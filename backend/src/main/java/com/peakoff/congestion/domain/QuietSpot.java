package com.peakoff.congestion.domain;

import java.time.LocalDate;
import java.util.Objects;

import com.peakoff.place.domain.Place;

/**
 * 어느 날 한적할 것으로 예측된 장소 한 곳.
 *
 * <p><b>장소와 날짜가 한 몸이다.</b> 같은 곳이라도 날짜마다 값이 다르므로
 * ({@code d}와 {@code d+7}이 같은 경우가 1,587쌍 중 0쌍이었다, 2026-08-30)
 * "한적한 곳"만 떼어 말할 수 없다. 화면이 "9월 3일 수요일에 한적해요"라고
 * 말할 수 있으려면 <b>어느 날 그런지</b>가 값에 붙어 있어야 한다.
 *
 * <p>한적도를 등급으로 바꾸지 않고 원본 점수로 담는다. 등급 경계는
 * {@link CongestionLevel}가 정하고, 그 경계가 움직이면 이 값은 그대로 따라간다.
 *
 * @param place     그 장소
 * @param date      살펴본 기간 중 <b>가장 한적한 날</b>
 * @param quietness 그 날의 한적도 (0~100, 클수록 한적)
 */
public record QuietSpot(Place place, LocalDate date, int quietness) {

	public QuietSpot {
		Objects.requireNonNull(place, "장소는 필수입니다.");
		Objects.requireNonNull(date, "날짜는 필수입니다.");
	}

	public CongestionLevel level() {
		return CongestionLevel.fromQuietness(quietness);
	}
}
