package com.peakoff.external.kto;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.peakoff.place.domain.Region;

/**
 * 공사 "관광지 집중률 방문자 추이 예측"을 호출한다.
 *
 * <h3>왜 지역 단위로 한 번만 부르는가</h3>
 * 오퍼레이션이 {@code areaCd}·{@code signguCd}를 필수로 받고 그 지역 전체를 돌려준다.
 * 경주는 69곳 × 24일 = 1,656건이 한 번에 온다. 진단 한 번에 필요한 조회가
 * (장소 수 × 날짜 수)라 장소마다 부르면 호출이 수십 번이 되는데, 지역을 통째로 받으면 한 번이다.
 *
 * <h3>캐시</h3>
 * 공사 데이터는 하루 한 번 갱신되므로 TTL 6시간을 둔다(CLAUDE.md 규칙).
 * <b>캐시는 성능을 위한 것이지 API 호출을 대체하는 장치가 아니다</b> — TTL이 지나면 다시 부른다.
 * 데이터를 DB에 적재해 사실상 호출하지 않는 구조는 공모전 규칙 위반이다.
 *
 * <h3>응답이 세 가지 모양으로 온다</h3>
 * 성공과 실패의 JSON 뿌리가 서로 다르다. 그래서 타입에 바로 매핑하지 않고 트리로 읽는다.
 * <ul>
 *   <li>정상 — {@code response.header.resultCode = "0000"}</li>
 *   <li>파라미터 오류 — 최상위에 {@code resultCode}/{@code resultMsg} (예: {@code areaCd} 누락)</li>
 *   <li>인증 오류 — {@code OpenAPI_ServiceResponse.cmmMsgHeader.errMsg}
 *       (예: 키가 이 API에 활용신청되지 않음)</li>
 * </ul>
 * 셋을 구분해 던지지 않으면 "설정을 안 했다"와 "공사가 죽었다"가 같은 오류로 보인다.
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

	private static final Duration CACHE_TTL = Duration.ofHours(6);

	private static final DateTimeFormatter BASE_YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

	private static final String SUCCESS_CODE = "0000";

	/**
	 * 응답을 트리로 읽기만 하는 파서.
	 *
	 * <p>스프링에서 주입받지 않고 직접 만든다. 부트 4에서는 웹 스타터만으로 {@code ObjectMapper}
	 * 빈이 생기지 않아 주입이 실패하고, 무엇보다 <b>여기서 필요한 것은 설정 없는 순수 파서</b>다.
	 * 응답 본문에 우리 직렬화 설정(날짜 형식·널 처리 등)이 끼어들 이유가 없다.
	 */
	private static final ObjectMapper JSON = new ObjectMapper();

	private final RestClient restClient;
	private final KtoProperties properties;
	private final Clock clock;

	/** 지역 법정동 코드 → 캐시된 예측. 지역이 하나뿐인 v1에서도 구조는 여러 지역을 받는다. */
	private final Map<String, Cached> cache = new ConcurrentHashMap<>();

	private record Cached(RegionForecast forecast, Instant fetchedAt) {
	}

	public KtoCongestionClient(RestClient.Builder builder, KtoProperties properties, Clock clock) {
		this.restClient = builder.build();
		this.properties = properties;
		this.clock = clock;
	}

	/**
	 * 그 지역의 예측 전체. 캐시가 살아 있으면 호출하지 않는다.
	 *
	 * <p>동시에 여러 요청이 들어오면 같은 지역을 두 번 부를 수 있다. 막지 않은 이유는
	 * 잠금을 걸면 첫 호출이 느릴 때 뒤따르는 요청이 모두 멈추기 때문이다.
	 * 최악이 <b>중복 호출 한 번</b>이라 그대로 둔다.
	 */
	public RegionForecast forecastOf(Region region) {
		String key = region.legalDongCode();
		Cached cached = cache.get(key);
		if (cached != null && !isExpired(cached)) {
			return cached.forecast();
		}
		RegionForecast fresh = fetch(region);
		cache.put(key, new Cached(fresh, clock.instant()));
		return fresh;
	}

	private boolean isExpired(Cached cached) {
		return Duration.between(cached.fetchedAt(), clock.instant()).compareTo(CACHE_TTL) >= 0;
	}

	private RegionForecast fetch(Region region) {
		if (!properties.isConfigured()) {
			throw new KtoApiException("공사 OpenAPI 인증키가 설정되지 않았습니다. "
					+ "환경변수 또는 application-local.yml의 peakoff.kto.service-key를 확인하세요.");
		}

		String body;
		try {
			body = restClient.get().uri(requestUri(region)).retrieve().body(String.class);
		}
		catch (RestClientException e) {
			throw new KtoApiException("공사 OpenAPI 호출에 실패했습니다: " + e.getMessage(), e);
		}

		return parse(body, region);
	}

	/**
	 * 요청 주소를 만든다.
	 *
	 * <p><b>{@code build(true)}가 핵심이다.</b> 인증키는 이미 URL 인코딩된 값이라
	 * 빌더가 한 번 더 인코딩하면 {@code %2B}가 {@code %252B}가 되어 공사가 다른 키로 읽는다.
	 * {@code true}는 "값들이 이미 인코딩돼 있다"는 선언이다. 나머지 값이 전부
	 * 숫자·영문이라 이 선언이 안전하다 — 한글 파라미터를 넣게 되면 그때는 직접 인코딩해야 한다.
	 *
	 * <p>{@code URI}로 넘기는 이유도 같다. 문자열로 넘기면 RestClient가 다시 인코딩한다.
	 */
	private URI requestUri(Region region) {
		return UriComponentsBuilder.fromUriString(properties.baseUrl() + PATH)
				.queryParam("serviceKey", properties.serviceKey())
				.queryParam("MobileOS", "ETC")
				.queryParam("MobileApp", "PEAKOFF")
				.queryParam("_type", "json")
				.queryParam("numOfRows", MAX_ROWS)
				.queryParam("pageNo", 1)
				.queryParam("areaCd", areaCodeOf(region))
				.queryParam("signguCd", sigunguCodeOf(region))
				.build(true)
				.toUri();
	}

	/**
	 * 법정동 코드에서 시도 코드를 뗀다. 앞 2자리다. (예: 4713000000 → 47 경상북도)
	 *
	 * <p>지역 정의는 {@code SupportedRegion} 한 곳에만 두기로 했으므로, 여기서 코드를
	 * 다시 적지 않고 잘라 쓴다. 두 벌로 적으면 지역을 늘릴 때 한쪽만 고쳐진다.
	 */
	private static String areaCodeOf(Region region) {
		return legalDongCode(region).substring(0, 2);
	}

	/** 시군구 코드는 앞 5자리다. (예: 4713000000 → 47130 경주시) */
	private static String sigunguCodeOf(Region region) {
		return legalDongCode(region).substring(0, 5);
	}

	private static String legalDongCode(Region region) {
		String code = region.legalDongCode();
		if (code == null || code.length() < 5) {
			throw new KtoApiException("법정동 코드가 5자리 이상이어야 시군구를 가릅니다. 입력값: " + code);
		}
		return code;
	}

	private RegionForecast parse(String body, Region region) {
		JsonNode root = readTree(body);

		failIfAuthError(root);
		failIfParameterError(root);

		JsonNode header = root.path("response").path("header");
		String resultCode = header.path("resultCode").asText("");
		if (!SUCCESS_CODE.equals(resultCode)) {
			throw new KtoApiException("공사 OpenAPI가 오류를 돌려줬습니다. resultCode=%s, resultMsg=%s"
					.formatted(resultCode, header.path("resultMsg").asText("")));
		}

		JsonNode bodyNode = root.path("response").path("body");
		warnIfTruncated(bodyNode, region);

		/*
		 * 결과가 없으면 items가 객체가 아니라 빈 문자열로 오는 경우가 있다(공사 API의 오래된 습관).
		 * path()는 그때도 예외 없이 빈 노드를 주고, 아래 반복은 그냥 돌지 않는다.
		 */
		JsonNode items = bodyNode.path("items").path("item");
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

	private static JsonNode readTree(String body) {
		if (body == null || body.isBlank()) {
			throw new KtoApiException("공사 OpenAPI 응답이 비어 있습니다.");
		}
		try {
			return JSON.readTree(body);
		}
		catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException e) {
			/*
			 * _type=json을 넣어도 오류일 때는 XML로 답하는 경우가 있다. 그때 파싱 실패 메시지만
			 * 남기면 원인을 알 수 없어, 앞부분을 함께 실어 보낸다. 길이를 자르는 이유는
			 * 응답 전체가 로그와 오류 메시지에 통째로 실리는 것을 막기 위해서다.
			 */
			String head = body.length() > 200 ? body.substring(0, 200) + "…" : body;
			throw new KtoApiException("공사 OpenAPI 응답을 JSON으로 읽지 못했습니다. 응답 앞부분: " + head, e);
		}
	}

	/** 인증 실패는 뿌리가 {@code OpenAPI_ServiceResponse}로 통째로 다르다. */
	private static void failIfAuthError(JsonNode root) {
		JsonNode header = root.path("OpenAPI_ServiceResponse").path("cmmMsgHeader");
		if (header.isMissingNode()) {
			return;
		}
		String errMsg = header.path("errMsg").asText("");
		String reason = header.path("returnAuthMsg").asText("");
		throw new KtoApiException(("공사 OpenAPI 인증에 실패했습니다: %s (%s). "
				+ "공공데이터포털에서 이 API에 활용신청이 되어 있는지 확인하세요 — "
				+ "인증키는 API마다 따로 등록됩니다.").formatted(errMsg, reason));
	}

	/** 필수 파라미터 누락 등은 최상위에 {@code resultCode}가 실려 온다. */
	private static void failIfParameterError(JsonNode root) {
		if (!root.hasNonNull("resultCode")) {
			return;
		}
		String code = root.path("resultCode").asText("");
		if (SUCCESS_CODE.equals(code)) {
			return;
		}
		throw new KtoApiException("공사 OpenAPI 요청이 거절됐습니다. resultCode=%s, resultMsg=%s"
				.formatted(code, root.path("resultMsg").asText("")));
	}

	/**
	 * 지역 전체가 한 응답에 안 들어왔으면 알린다.
	 *
	 * <p>조용히 잘리면 뒷장의 관광지들이 "예측 자료가 없는 곳"으로 보인다.
	 * 자료가 없는 것과 우리가 안 받아온 것은 완전히 다른 문제다.
	 */
	private static void warnIfTruncated(JsonNode bodyNode, Region region) {
		int totalCount = bodyNode.path("totalCount").asInt(0);
		if (totalCount > MAX_ROWS) {
			log.warn("공사 집중률 응답이 한 장에 다 들어오지 않았습니다. region={}, totalCount={}, 요청={}. "
					+ "페이지 처리가 필요합니다.", region.name(), totalCount, MAX_ROWS);
		}
	}
}
