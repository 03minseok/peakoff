package com.peakoff.recommendation.domain;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.place.domain.Place;

/**
 * 특정 장소를 대신할 만한 후보를 공급한다.
 *
 * <p>실제 구현은 연관 관광지 데이터를 호출한다. "함께 많이 방문되는 곳"이 대안 후보의 출발점이고,
 * 거기에 한적도와 동선을 얹어 추천도를 만든다.
 *
 * <p>날짜가 필요한 이유: 후보의 한적도는 날짜에 따라 달라진다.
 * 같은 후보라도 평일과 주말의 값이 다르므로, 언제 가는지 모르면 점수를 매길 수 없다.
 */
public interface RecommendationProvider {

	/**
	 * @param origin 교체 대상 장소. 이 장소와의 연관성·거리가 추천도의 근거가 된다
	 * @param date   방문 예정일
	 * @param limit  최대 후보 수 (1 이상)
	 * @return 추천 순으로 정렬된 대안 후보. 후보가 없으면 빈 목록
	 */
	List<Alternative> findAlternatives(Place origin, LocalDate date, int limit);
}
