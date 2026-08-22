package com.peakoff.external.kto;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.peakoff.place.domain.Region;

/**
 * 공사 "관광지 집중률 방문자 추이 예측"을 호출한다.
 *
 * <h3>왜 지역 단위로 한 번만 부르는가</h3>
 * 오퍼레이션이 {@code areaCd}·{@code signguCd}를 필수로 받고 그 지역 전체를 돌려준다.
 * 경주는 69곳 × 24일 = 1,656건이 한 번에 온다. 진단 한 번에 필요한 조회가
 * (장소 수 × 날짜 수)라 장소마다 부르면 호출이 수십 번이 되는데, 지역을 통째로 받으면 한 번이다.
 *
 * <p>호출과 응답 판별은 {@link KtoApiCaller}가, 캐시는 {@link RegionCache}가 맡는다.
 * 여기는 <b>응답을 우리 값으로 옮기는 일</b>만 한다.
 */
@Component
public class KtoCongestionClient {

	private static final Logger log = LoggerFactory.getLogger(KtoCongestionClient.class);

	private static final String PATH = "/B551011/TatsCnctrRateService/tatsCnctrRatedList";

	/**
	 * 한 번에 받아올 최대 행 수.
	 *
	 * <p>지역 전체가 한 응답에 들어와야 페이지를 넘기지 않는다. 관측값은 경주 1,656 /
	 * 서울 종로 2,712 / 제주시 5,856이라 여유 있게 잡았다. 그래도 넘치면 아래에서
	 * <b>경고를 남긴다</b> — 조용히 잘리면 "그 장소는 예측이 없다"로 잘못 읽힌다.
	 */
	private static final int MAX_ROWS = 10_000;

	private static final DateTimeFormatter BASE_YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

	private final KtoApiCaller caller;
	private final RegionCache<RegionForecast> cache;

	public KtoCongestionClient(KtoApiCaller caller, Clock clock) {
		this.caller = caller;
		this.cache = new RegionCache<>(clock);
	}

	/** 그 지역의 예측 전체. 캐시가 살아 있으면 호출하지 않는다. */
	public RegionForecast forecastOf(Region region) {
		return cache.get(region, this::fetch);
	}

	private RegionForecast fetch(Region region) {
		JsonNode body = caller.body(PATH, Map.of(
				"numOfRows", String.valueOf(MAX_ROWS),
				"pageNo", "1",
				"areaCd", RegionCodes.areaCodeOf(region),
				"signguCd", RegionCodes.sigunguCodeOf(region)));

		warnIfTruncated(body, region);

		JsonNode items = body.path("items").path("item");
		if (!items.isArray() || items.isEmpty()) {
			log.warn("공사 집중률 응답에 항목이 없습니다. region={}", region.name());
			return RegionForecast.empty();
		}

		Map<String, Map<LocalDate, Double>> rates = new HashMap<>();
		LocalDate first = null;
		LocalDate last = null;
		int skipped = 0;

		for (JsonNode item : items) {
			String name = item.path("tAtsNm").asText("").trim();
			String ymd = item.path("baseYmd").asText("").trim();
			String rate = item.path("cnctrRate").asText("").trim();
			if (name.isEmpty() || ymd.isEmpty() || rate.isEmpty()) {
				skipped++;
				continue;
			}

			LocalDate date;
			double value;
			try {
				date = LocalDate.parse(ymd, BASE_YMD);
				value = Double.parseDouble(rate);
			}
			catch (RuntimeException e) {
				// 한 행이 깨졌다고 지역 전체를 버리지 않는다. 나머지는 멀쩡하다.
				skipped++;
				continue;
			}

			rates.computeIfAbsent(name, key -> new HashMap<>()).put(date, value);
			if (first == null || date.isBefore(first)) {
				first = date;
			}
			if (last == null || date.isAfter(last)) {
				last = date;
			}
		}

		if (skipped > 0) {
			log.warn("공사 집중률 응답에서 읽지 못한 행이 있습니다. region={}, 건수={}", region.name(), skipped);
		}
		log.info("공사 집중률 조회 완료. region={}, 관광지={}곳, 예측범위={}~{}",
				region.name(), rates.size(), first, last);

		return new RegionForecast(rates, first, last);
	}

	/**
	 * 지역 전체가 한 응답에 안 들어왔으면 알린다.
	 *
	 * <p>조용히 잘리면 뒷장의 관광지들이 "예측 자료가 없는 곳"으로 보인다.
	 * 자료가 없는 것과 우리가 안 받아온 것은 완전히 다른 문제다.
	 */
	private static void warnIfTruncated(JsonNode body, Region region) {
		int totalCount = body.path("totalCount").asInt(0);
		if (totalCount > MAX_ROWS) {
			log.warn("공사 집중률 응답이 한 장에 다 들어오지 않았습니다. region={}, totalCount={}, 요청={}. "
					+ "페이지 처리가 필요합니다.", region.name(), totalCount, MAX_ROWS);
		}
	}
}
