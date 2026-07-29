package com.peakoff.course.domain;

import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Place;

/**
 * 코스의 한 칸. "N일차 M번째에 이 장소를 간다"를 표현한다.
 *
 * <p>슬롯이 교체 단위다. 사용자가 화면에서 바꾸는 대상이 곧 이 객체 하나다.
 *
 * @param day       일차 (1부터 시작)
 * @param order     그 날 안에서의 순서 (1부터 시작)
 * @param place     방문할 관광지
 * @param quietness 이 장소의 해당 날짜 예상 한적도 (0~100, 클수록 한적)
 */
public record CourseSlot(int day, int order, Place place, int quietness) {

	public CourseSlot {
		if (day < 1) {
			throw new IllegalArgumentException("일차는 1 이상이어야 합니다. 입력값: " + day);
		}
		if (order < 1) {
			throw new IllegalArgumentException("순서는 1 이상이어야 합니다. 입력값: " + order);
		}
		Objects.requireNonNull(place, "장소는 필수입니다.");
		Scores.validate(quietness, "한적도");
	}

	/** 장소만 갈아끼운 새 슬롯. 일차·순서는 유지된다. */
	public CourseSlot replaceWith(Place newPlace, int newQuietness) {
		return new CourseSlot(day, order, newPlace, newQuietness);
	}
}
