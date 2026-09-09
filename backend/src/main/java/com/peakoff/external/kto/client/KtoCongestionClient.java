package com.peakoff.external.kto.client;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.support.KtoApiCaller;
import com.peakoff.external.kto.support.KtoApiException;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.external.kto.support.RegionCodes;
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
		/*
		 * ⚠️ <b>빈 예측은 담지 않는다.</b> 공사가 200에 항목 0건을 주면 그것이 정상 응답이라
		 * 멀쩡하던 옛 값을 덮어쓴다 — 9/8 여수가 그랬다. 쓸 만한 옛 값이 있는 한 지킨다.
		 */
		this.cache = new RegionCache<>(clock, forecast -> !forecast.isEmpty());
	}

	/** 그 지역의 예측 전체. 캐시가 살아 있으면 호출하지 않는다. */
	public RegionForecast forecastOf(Region region) {
		return cache.get(region, this::fetch);
	}

	/**
	 * 예측을 <b>지금</b> 다시 받아 담는다. 프리워밍({@code KtoCacheWarmer}) 전용.
	 * 빈 응답은 담지 않고 옛 값을 지킨다 — {@code usable} 술어가 {@code get}과 같은 길에서 막는다.
	 */
	public RegionForecast refreshForecast(Region region) {
		return cache.refresh(region, this::fetch);
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
			/*
			 * ■ 빈 응답을 그대로 <b>돌려주되, 캐시가 덮어쓰지는 않는다</b> (2026-09-08)
			 *
			 * 실제로 났다 — 9/5에 97곳 2,910건이 오던 여수가 9/8에 항목 0건이 됐다
			 * (46/46130·12/12130 두 코드 모두). 오류가 아니라 빈 응답이라 조용히 지나갔고,
			 * 캐시는 그것을 정상 응답으로 받아 <b>멀쩡하던 옛 값 위에 덮어썼다.</b>
			 *
			 * <p>⚠️ 여기서 <b>예외를 던지면 안 된다.</b> 한 번 그렇게 해 봤는데, 지역 하나가
			 * 비었다는 이유로 <b>챗봇 전체가 EXTERNAL_UNAVAILABLE</b>이 됐다 — 프로필을
			 * 만드는 쪽이 실패를 위로 올리기 때문이다. 여수 코스의 진단도 칸마다
			 * "자료 없음"이 아니라 화면째 오류가 된다.
			 *
			 * <p>대신 <b>캐시에게 "이 값은 덮어쓸 가치가 없다"고 알린다</b>
			 * ({@code RegionCache}의 usable 조건). 옛 값이 있으면 그것을 계속 쓰고,
			 * 없으면 지금처럼 빈 값으로 다룬다 — 그 지역만 조용히 빠지고 나머지는 그대로 돈다.
			 */
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
