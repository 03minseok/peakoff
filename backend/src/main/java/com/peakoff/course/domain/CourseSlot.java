package com.peakoff.course.domain;

import java.util.Objects;

import com.peakoff.congestion.domain.DiagnosisGap;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Place;

/**
 * 코스의 한 칸. "N일차 M번째에 이 장소를 간다"를 표현한다.
 *
 * <p>슬롯이 교체 단위다. 사용자가 화면에서 바꾸는 대상이 곧 이 객체 하나다.
 *
 * <h3>한적도가 없을 수 있다</h3>
 * 공사 집중률은 관광지만 예측한다. 음식점·카페·숙박은 목록에 아예 없고, 여행일이
 * 예측 범위 밖이면 관광지도 값이 없다. 그렇다고 <b>코스에 못 담게 막지는 않는다</b> —
 * 밥집 없는 여행 코스는 없다.
 *
 * <p>그래서 진단되지 않은 칸은 {@code quietness}가 {@code null}이고 {@code gap}에 사유가 담긴다.
 * 0점으로 채우지 않는 이유는 {@link DiagnosisGap}에 적어 두었다.
 *
 * @param day       일차 (1부터 시작)
 * @param order     그 날 안에서의 순서 (1부터 시작)
 * @param place     방문할 관광지
 * @param quietness 이 장소의 해당 날짜 예상 한적도 (0~100, 클수록 한적). 진단 불가면 {@code null}
 * @param gap       한적도가 없는 이유. 진단됐으면 {@code null}
 */
public record CourseSlot(int day, int order, Place place, Integer quietness, DiagnosisGap gap) {

	public CourseSlot {
		if (day < 1) {
			throw new IllegalArgumentException("일차는 1 이상이어야 합니다. 입력값: " + day);
		}
		if (order < 1) {
			throw new IllegalArgumentException("순서는 1 이상이어야 합니다. 입력값: " + order);
		}
		Objects.requireNonNull(place, "장소는 필수입니다.");

		/*
		 * 둘 중 정확히 하나만 있어야 한다. 점수와 "점수가 없는 이유"가 함께 있으면
		 * 화면이 어느 쪽을 믿어야 할지 알 수 없고, 둘 다 없으면 그 칸이 무엇인지 말할 수 없다.
		 */
		if (quietness == null && gap == null) {
			throw new IllegalArgumentException("한적도가 없으면 그 이유가 있어야 합니다. place=" + place.name());
		}
		if (quietness != null && gap != null) {
			throw new IllegalArgumentException(
					"한적도가 있는데 진단 불가 사유도 함께 있습니다. place=" + place.name());
		}
		if (quietness != null) {
			Scores.validate(quietness, "한적도");
		}
	}

	/** 한적도를 매긴 칸. */
	public static CourseSlot diagnosed(int day, int order, Place place, int quietness) {
		return new CourseSlot(day, order, place, quietness, null);
	}

	/** 한적도를 매기지 못한 칸. 코스에는 남지만 총점과 교체 추천에서는 빠진다. */
	public static CourseSlot undiagnosed(int day, int order, Place place, DiagnosisGap gap) {
		return new CourseSlot(day, order, place, null, Objects.requireNonNull(gap, "진단 불가 사유는 필수입니다."));
	}

	public boolean isDiagnosed() {
		return quietness != null;
	}

	/** 장소만 갈아끼운 새 슬롯. 일차·순서는 유지된다. */
	public CourseSlot replaceWith(Place newPlace, int newQuietness) {
		return diagnosed(day, order, newPlace, newQuietness);
	}
}
