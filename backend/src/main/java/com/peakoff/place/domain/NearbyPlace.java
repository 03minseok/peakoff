package com.peakoff.place.domain;

import java.util.Objects;

/**
 * 어떤 장소 근처에 있는, 같은 분류의 다른 장소.
 *
 * <h2>이것은 "추천"이 아니다</h2>
 * 이름에 추천도 점수가 없는 것이 핵심이다. 공사 집중률은 관광지만 예측해서
 * <b>음식점·숙박은 한적도를 알 수 없고, 한적도를 모르면 추천도를 매길 수 없다</b> —
 * 추천도는 한적도를 가장 큰 비중으로 품는 값이기 때문이다({@code ScoreWeights}).
 *
 * <p>그래서 이 목록은 "여기가 더 한적합니다"라고 말하지 않는다. "같은 분류이고 몇 km 떨어져 있다"는
 * <b>사실만</b> 전한다. 고르는 판단은 사용자가 한다.
 *
 * <p>왜 그런 것이라도 필요한가: 밥집 셋으로 코스를 짠 사용자에게 지금까지는 아무 선택지도
 * 없었다. 진단할 수 없다는 이유로 <b>장소를 바꿀 방법까지 막을 이유는 없다.</b>
 * 우리가 점수를 못 매기는 것이지, 사용자가 다른 밥집을 고르고 싶지 않은 것이 아니다.
 *
 * @param place      그 장소
 * @param distanceKm 기준 장소로부터의 직선 거리(km). 도로 거리가 아니다
 */
public record NearbyPlace(Place place, double distanceKm) {

	public NearbyPlace {
		Objects.requireNonNull(place, "장소는 필수입니다.");
		if (distanceKm < 0) {
			throw new IllegalArgumentException("거리는 0 이상이어야 합니다. 입력값: " + distanceKm);
		}
	}
}
