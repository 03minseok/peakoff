package com.peakoff.external.kto;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 한 지역의 "관광지별 연관 관광지" 전체.
 *
 * <p>연관 관광지는 <b>함께 많이 방문되는 곳</b>이다. 티맵 이동 데이터에서 나온 값이라
 * "이 곳에 간 사람들이 또 어디를 갔는가"를 실제로 담고 있다.
 *
 * <h3>왜 이 데이터가 대안 추천의 출발점인가</h3>
 * 대안은 "아무 데나 한적한 곳"이 아니라 <b>그 자리를 대신할 만한 곳</b>이어야 한다.
 * 거리만으로 고르면 근처 주유소가 후보에 오르고, 한적도만으로 고르면 아무도 안 가는 곳이 뽑힌다.
 * 함께 방문되는 곳이라는 조건이 그 둘을 걸러 준다.
 *
 * <p>동시에 이것이 <b>인기도 하한</b> 역할을 겸한다. 아무도 함께 가지 않는 곳은 애초에
 * 이 목록에 나오지 않는다. 그래서 인기도를 별도 가점으로 둘 필요가 없다 —
 * 인기도를 가점으로 쓰면 붐비는 곳을 밀게 되어 과제와 정면으로 어긋난다.
 *
 * @param relatedByName 기준 관광지 이름 → 연관 관광지 이름들(연관 순위 오름차순)
 */
public record RelatedPlaces(Map<String, List<String>> relatedByName) {

	public RelatedPlaces {
		Map<String, List<String>> copy = new HashMap<>();
		relatedByName.forEach((name, related) -> copy.put(name, List.copyOf(related)));
		relatedByName = Collections.unmodifiableMap(copy);
	}

	public static RelatedPlaces empty() {
		return new RelatedPlaces(Map.of());
	}

	public boolean isEmpty() {
		return relatedByName.isEmpty();
	}

	/** 연관 정보를 갖고 있는 기준 관광지 이름들. 이름 매칭의 후보 목록이 된다. */
	public java.util.Set<String> originNames() {
		return relatedByName.keySet();
	}

	/** 그 기준 관광지의 연관 관광지 이름들. 없으면 빈 목록. */
	public List<String> relatedTo(String originName) {
		return relatedByName.getOrDefault(originName, List.of());
	}
}
