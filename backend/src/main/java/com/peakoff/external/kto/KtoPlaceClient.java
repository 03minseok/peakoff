package com.peakoff.external.kto;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.domain.PlaceCategory;
import com.peakoff.place.domain.Region;

/**
 * 공사 "국문 관광정보"에서 지역의 관광지 목록과 상세를 가져온다.
 *
 * <h3>지역을 통째로 받는다</h3>
 * 경주가 621건이다. 한 번 받아 캐시해 두면 검색·상세·이름 매칭이 전부 메모리에서 끝난다.
 * 검색어를 칠 때마다 {@code searchKeyword2}를 부르면 글자마다 호출이 나가고,
 * 그만큼 사용자가 기다린다.
 *
 * <h3>지역·분류는 신분류 체계로만 지정한다</h3>
 * {@code lDongRegnCd}/{@code lDongSignguCd}(법정동)와 {@code lclsSystm1}(신분류)을 쓴다.
 * 구 {@code areaCode}/{@code cat1} 체계는 26년 폐기 예정이고, 실제로 최근 등록분은
 * 그 자리가 비어서 온다.
 */
@Component
public class KtoPlaceClient {

	private static final Logger log = LoggerFactory.getLogger(KtoPlaceClient.class);

	private static final String LIST_PATH = "/B551011/KorService2/areaBasedList2";
	private static final String DETAIL_PATH = "/B551011/KorService2/detailCommon2";

	/** 지역 전체가 한 응답에 들어와야 페이지를 넘기지 않는다. 경주 621건 기준 넉넉하게. */
	private static final int MAX_ROWS = 5_000;

	private final KtoApiCaller caller;
	private final RegionCache<RegionCatalog> cache;

	public KtoPlaceClient(KtoApiCaller caller, Clock clock) {
		this.caller = caller;
		this.cache = new RegionCache<>(clock);
	}

	/** 그 지역의 관광지 목록 전체. 캐시가 살아 있으면 호출하지 않는다. */
	public RegionCatalog catalogOf(Region region) {
		return cache.get(region, this::fetchCatalog);
	}

	/**
	 * 카탈로그에 없는 장소를 하나만 조회한다.
	 *
	 * <p>필요한 자리가 하나 있다 — <b>저장해 둔 코스를 불러올 때</b>다. 저장된 장소가
	 * 카탈로그에서 빠졌거나(폐업·분류 변경) 다른 지역의 것일 수 있는데, 그때 "장소를 찾을 수
	 * 없다"고만 하면 사용자는 자기가 저장한 코스를 영영 못 연다.
	 */
	public Optional<Place> findDetail(String contentId) {
		JsonNode items = caller.items(DETAIL_PATH, Map.of("contentId", contentId));
		JsonNode item = items.isArray() ? (items.isEmpty() ? null : items.get(0)) : items;
		if (item == null || item.isMissingNode() || !item.hasNonNull("contentid")) {
			return Optional.empty();
		}
		return Optional.ofNullable(toPlace(item));
	}

	private RegionCatalog fetchCatalog(Region region) {
		JsonNode body = caller.body(LIST_PATH, Map.of(
				"numOfRows", String.valueOf(MAX_ROWS),
				"pageNo", "1",
				"lDongRegnCd", RegionCodes.areaCodeOf(region),
				"lDongSignguCd", RegionCodes.lDongSignguCodeOf(region),
				// 제목순. 순서가 정해져 있어야 같은 검색이 늘 같은 차례로 나온다.
				"arrange", "A"));

		int totalCount = body.path("totalCount").asInt(0);
		if (totalCount > MAX_ROWS) {
			log.warn("국문 관광정보가 한 장에 다 들어오지 않았습니다. region={}, totalCount={}, 요청={}. "
					+ "페이지 처리가 필요합니다.", region.name(), totalCount, MAX_ROWS);
		}

		JsonNode items = body.path("items").path("item");
		if (!items.isArray() || items.isEmpty()) {
			log.warn("국문 관광정보 응답에 항목이 없습니다. region={}", region.name());
			return RegionCatalog.empty();
		}

		Map<String, Place> places = new LinkedHashMap<>();
		int skipped = 0;
		for (JsonNode item : items) {
			Place place = toPlace(item);
			if (place == null) {
				skipped++;
				continue;
			}
			places.put(place.id(), place);
		}

		if (skipped > 0) {
			// 좌표나 분류가 빠진 장소는 지도에도 못 찍고 스타일 필터도 통과시킬 수 없다.
			log.info("국문 관광정보에서 건너뛴 항목 {}건 (좌표·분류·이름 누락). region={}", skipped, region.name());
		}
		log.info("국문 관광정보 조회 완료. region={}, 관광지={}곳", region.name(), places.size());

		return new RegionCatalog(places);
	}

	/**
	 * 응답 한 줄을 우리 장소로 옮긴다. 쓸 수 없으면 {@code null}.
	 *
	 * <p><b>좌표가 없으면 버린다.</b> 지도에 찍을 수 없고 동선 근접도도 잴 수 없어서,
	 * 담아 봐야 나중에 계산하는 쪽에서 터진다.
	 *
	 * <p>{@code mapx}가 경도, {@code mapy}가 위도다. 이름만 보면 x가 위도 같아서
	 * 뒤집어 넣기 쉬운데, 그러면 경주가 태평양에 찍힌다.
	 */
	private static Place toPlace(JsonNode item) {
		String id = item.path("contentid").asText("").trim();
		String title = item.path("title").asText("").trim();
		if (id.isEmpty() || title.isEmpty()) {
			return null;
		}

		Double longitude = parseCoordinate(item.path("mapx").asText(""));
		Double latitude = parseCoordinate(item.path("mapy").asText(""));
		if (longitude == null || latitude == null) {
			return null;
		}

		PlaceCategory category = PlaceCategories.of(item.path("lclsSystm1").asText("").trim());
		if (category == null) {
			return null;
		}

		String image = item.path("firstimage").asText("").trim();
		return new Place(id, title, latitude, longitude, category, image.isEmpty() ? null : image);
	}

	private static Double parseCoordinate(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			return Double.parseDouble(raw.trim());
		}
		catch (NumberFormatException e) {
			return null;
		}
	}
}
