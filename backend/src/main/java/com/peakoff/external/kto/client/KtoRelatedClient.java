package com.peakoff.external.kto.client;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.support.KtoApiCaller;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.external.kto.support.RegionCodes;
import com.peakoff.place.domain.Region;

/**
 * 공사 "관광지별 연관 관광지 정보"를 호출한다. 함께 많이 방문되는 곳을 준다.
 *
 * <h3>지역 단위로 한 번만 부른다</h3>
 * 경주가 1,918건(기준 관광지 × 연관 목록)이라 한 응답에 다 들어온다. 장소마다 부르면
 * 대안 시트를 열 때마다 호출이 나가는데, 지역을 통째로 받아 두면 그 뒤로는 메모리에서 끝난다.
 *
 * <p>{@code areaBasedList1}은 {@code keyword}를 받지 않는다. 기준 관광지로 좁히는 것은
 * 우리 쪽에서 한다.
 */
@Component
public class KtoRelatedClient {

	private static final Logger log = LoggerFactory.getLogger(KtoRelatedClient.class);

	private static final String PATH = "/B551011/TarRlteTarService1/areaBasedList1";

	/** 경주 실측 1,918건. 지역이 커도 한 장에 들어오도록 넉넉히 잡는다. */
	private static final int MAX_ROWS = 20_000;

	/**
	 * 조회 기준 월.
	 *
	 * <p>⚠️ <b>고정값이다.</b> {@code baseYm}이 필수인데 최신 월을 넣으면 아직 집계 전이라
	 * 빈 응답이 온다. 자료가 있는 월을 실측으로 확인해 박아 두었다.
	 * {@code KtoHubClient}와 같은 값을 쓴다 — 두 API가 같은 집계 주기를 따른다.
	 */
	private static final String BASE_MONTH = "202504";

	private final KtoApiCaller caller;
	private final RegionCache<RelatedPlaces> cache;

	public KtoRelatedClient(KtoApiCaller caller, Clock clock) {
		this.caller = caller;
		this.cache = new RegionCache<>(clock);
	}

	public RelatedPlaces relatedOf(Region region) {
		return cache.get(region, this::fetch);
	}

	private RelatedPlaces fetch(Region region) {
		JsonNode items = caller.items(PATH, Map.of(
				"numOfRows", String.valueOf(MAX_ROWS),
				"pageNo", "1",
				"baseYm", BASE_MONTH,
				"areaCd", RegionCodes.areaCodeOf(region),
				"signguCd", RegionCodes.sigunguCodeOf(region)));

		if (!items.isArray() || items.isEmpty()) {
			log.warn("연관 관광지 응답에 항목이 없습니다. region={}, baseYm={}", region.name(), BASE_MONTH);
			return RelatedPlaces.empty();
		}

		/*
		 * 같은 지역 안의 연관 관광지만 남긴다. 응답에 다른 시군구가 섞여 오는데,
		 * 사용자가 고른 지역 밖으로 보내면 "경주 여행"이 아니게 된다.
		 */
		String signguCd = RegionCodes.sigunguCodeOf(region);

		Map<String, List<JsonNode>> grouped = new LinkedHashMap<>();
		for (JsonNode item : items) {
			String origin = item.path("tAtsNm").asText("").trim();
			String related = item.path("rlteTatsNm").asText("").trim();
			if (origin.isEmpty() || related.isEmpty()) {
				continue;
			}
			if (!signguCd.equals(item.path("rlteSignguCd").asText("").trim())) {
				continue;
			}
			grouped.computeIfAbsent(origin, key -> new ArrayList<>()).add(item);
		}

		Map<String, List<String>> relatedByName = new LinkedHashMap<>();
		grouped.forEach((origin, rows) -> {
			/*
			 * 연관 순위 오름차순. 응답 순서를 믿지 않고 직접 정렬한다 —
			 * 이 순서가 "얼마나 함께 가는가"를 뜻하는데, 공사가 순서를 바꾸면 조용히 뒤섞인다.
			 */
			List<String> names = rows.stream()
					.sorted(Comparator.comparingInt(row -> row.path("rlteRank").asInt(Integer.MAX_VALUE)))
					.map(row -> row.path("rlteTatsNm").asText("").trim())
					.distinct()
					.toList();
			relatedByName.put(origin, names);
		});

		log.info("연관 관광지 조회 완료. region={}, 기준 관광지={}곳", region.name(), relatedByName.size());
		return new RelatedPlaces(relatedByName);
	}
}
