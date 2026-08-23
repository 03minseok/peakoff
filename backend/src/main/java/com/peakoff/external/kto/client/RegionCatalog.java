package com.peakoff.external.kto.client;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.peakoff.place.domain.Place;

/**
 * 한 지역의 관광지 목록 전체.
 *
 * <h3>왜 지역을 통째로 들고 있는가</h3>
 * 경주가 621건이다. 한 번 받아 두면 검색·상세 조회·이름 매칭이 전부 메모리에서 끝난다.
 * 검색어를 칠 때마다 공사를 부르면 글자마다 호출이 나가고, 그만큼 사용자가 기다린다.
 *
 * <p>집중률과 같은 방식이다({@link RegionForecast}). 두 자료가 같은 모양으로 캐시되어
 * 있어야 "이 장소의 그 날짜 한적도"를 호출 없이 이을 수 있다.
 *
 * <h3>화면은 여전히 검색으로 찾는다</h3>
 * 서버가 전부 들고 있다고 해서 화면에 621개를 늘어놓지는 않는다. 지역이 늘어나면
 * 목록 UI가 성립하지 않는다 — 그 판단은 CLAUDE.md의 결정이고, 여기는 그 검색이
 * 빠르게 돌도록 받쳐 주는 자리다.
 *
 * @param places 콘텐츠 ID → 장소. 넣은 순서(공사 응답 순서)를 유지한다
 */
public record RegionCatalog(Map<String, Place> places) {

	public RegionCatalog {
		places = Map.copyOf(places);
	}

	public static RegionCatalog empty() {
		return new RegionCatalog(Map.of());
	}

	public boolean isEmpty() {
		return places.isEmpty();
	}

	public int size() {
		return places.size();
	}

	public Optional<Place> findById(String contentId) {
		return Optional.ofNullable(places.get(contentId));
	}

	public Collection<Place> all() {
		return places.values();
	}

	/**
	 * 이름에 검색어가 든 장소를 찾는다.
	 *
	 * <p><b>공백을 지우고 견준다.</b> 공사 이름은 "경주 동궁과 월지"처럼 띄어쓰기가
	 * 들어가는데 사람은 "동궁과월지"라고 친다. 반대도 마찬가지다.
	 *
	 * <p>대소문자를 무시한다. 영문 이름이 섞여 있고, 사람은 대소문자를 신경 쓰지 않는다.
	 *
	 * @param limit 최대 개수. 화면이 감당할 만큼만 돌려준다
	 */
	public List<Place> search(String keyword, int limit) {
		String needle = squeeze(keyword);
		if (needle.isEmpty()) {
			return List.of();
		}
		return places.values().stream()
				.filter(place -> squeeze(place.name()).contains(needle))
				.limit(limit)
				.toList();
	}

	/**
	 * 주어진 순서대로 장소를 꺼낸다. 없는 ID는 건너뛴다.
	 *
	 * <p>중심 관광지가 인기 순위를 이름으로 주는데, 그 순서를 유지한 채 우리 장소로
	 * 바꿔야 해서 필요하다. 순서가 곧 의미인 목록이라 정렬을 다시 하면 안 된다.
	 */
	public List<Place> byIdsInOrder(List<String> contentIds) {
		return contentIds.stream()
				.map(places::get)
				.filter(place -> place != null)
				.toList();
	}

	/** 이름 매칭에 쓸 후보 목록을 만든다. 이름이 겹치는 장소가 있으면 나중 것이 밀린다. */
	public Map<String, Place> byName() {
		Map<String, Place> byName = new LinkedHashMap<>();
		places.values().forEach(place -> byName.putIfAbsent(place.name(), place));
		return byName;
	}

	private static String squeeze(String text) {
		return text == null ? "" : text.replaceAll("\\s+", "").toLowerCase();
	}
}
