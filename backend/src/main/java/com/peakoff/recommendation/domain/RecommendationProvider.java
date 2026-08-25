package com.peakoff.recommendation.domain;

import java.time.LocalDate;
import java.util.Set;

import com.peakoff.place.domain.Place;

/**
 * 특정 장소를 대신할 만한 후보를 공급한다.
 *
 * <p>실제 구현은 연관 관광지 데이터를 호출한다. "함께 많이 방문되는 곳"이 대안 후보의 출발점이고,
 * 거기에 카테고리 적합성과 동선 근접도를 얹어 추천도를 만든다.
 *
 * <p>한적도와 추천도는 <b>서로 다른 축이라 섞지 않는다.</b> 한적도는 "그 날 얼마나 덜 붐비는가",
 * 추천도는 "원래 장소의 대체재로 얼마나 적절한가"다. 둘을 어떻게 저울질할지는
 * 이 인터페이스가 아니라 후보를 줄 세우는 쪽이 정한다.
 *
 * <p>날짜가 필요한 이유: 후보의 한적도는 날짜에 따라 달라진다.
 * 같은 후보라도 평일과 주말의 값이 다르므로, 언제 가는지 모르면 점수를 매길 수 없다.
 */
public interface RecommendationProvider {

	/**
	 * <b>후보 자격은 {@link AlternativeStandard}가 정하고, 뽑기는 그 뒤에 온다.</b>
	 * 구현마다 후보를 어디서 가져오는지는 다르지만 거르는 기준과 순서는 같아야 한다 —
	 * 뽑은 뒤에 거르면 자격 있는 후보가 Pool에 남아 있는데도 목록이 짧아진다.
	 *
	 * @param origin   교체 대상 장소. 이 장소와의 연관성·거리가 추천도의 근거가 된다
	 * @param date     방문 예정일
	 * @param limit    최대 후보 수 (1 이상)
	 * @param excluded 후보에서 뺄 장소 ID. <b>이미 코스에 담긴 곳</b>이 여기 온다 —
	 *                 고를 수 없는 것을 뽑아 봐야 Pool 자리만 차지하고 화면에서 걸러진다.
	 *                 비어 있어도 된다
	 * @return 추천 순으로 정렬된 후보와 <b>그런 목록이 나온 이유</b>.
	 *         빈 목록도 이유를 달고 나간다 — 왜 비었는지가 사용자에게 매번 다른 소식이다
	 */
	Alternatives findAlternatives(Place origin, LocalDate date, int limit, Set<String> excluded);
}
