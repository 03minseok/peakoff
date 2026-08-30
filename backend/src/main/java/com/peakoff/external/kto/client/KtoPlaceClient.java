package com.peakoff.external.kto.client;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.support.KtoApiCaller;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.external.kto.support.RegionCodes;
import com.peakoff.external.kto.support.TtlCache;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.domain.PlaceCategory;
import com.peakoff.place.domain.PlaceDescription;
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

	/**
	 * 상세 조회 캐시가 담을 수 있는 최대 개수.
	 *
	 * <p>지역 캐시와 달리 <b>아무 문자열이나 열쇠가 될 수 있다.</b> 없는 ID로 계속 물으면
	 * ("못 찾았다"도 담으므로) 캐시가 무한히 자란다. 상한을 두고, 넘으면 통째로 비운다.
	 */
	private static final int DETAIL_CACHE_MAX = 1_000;

	private final KtoApiCaller caller;
	private final RegionCache<RegionCatalog> cache;

	/**
	 * 장소 하나짜리 상세 조회의 캐시.
	 *
	 * <h3>왜 생겼나 — 2026-08-26의 소진 사고</h3>
	 * {@link #findDetail}은 원래 캐시가 없었다. 카탈로그에 없는 장소를 물을 때마다
	 * 공사 호출이 그대로 나갔는데, 카탈로그 밖 ID 하나를 반복해서 묻는 클라이언트가 생기자
	 * <b>요청 수 = 공사 호출 수</b>가 되어 39분 동안 1,912번을 태웠다. 일일 한도가
	 * 그렇게 소진됐다 — 로그의 실패 1,912건 전부가 이 메서드의 스택이었다.
	 *
	 * <p><b>"못 찾았다"({@code Optional.empty()})도 담는다.</b> 없는 장소는 다시 물어도
	 * 없다 — 그 답을 기억하지 않으면 없는 ID일수록 더 자주 부르게 된다.
	 */
	private final TtlCache<Optional<Place>> detailCache;

	/**
	 * 소개글 캐시.
	 *
	 * <p>{@link #detailCache}와 <b>같은 응답에서 나오지만 따로 담는다.</b> 담는 값이 달라서다 —
	 * 저쪽은 {@link Place}(좌표·분류)이고 이쪽은 주소와 500자 남짓의 글이다.
	 * 한 캐시에 두 모양을 섞으면 어느 쪽이 비었는지에 따라 분기가 늘고, 상한(개수)이
	 * 뜻하는 메모리 크기도 달라진다.
	 *
	 * <p>상한을 상세 캐시와 같이 두는 이유: 열쇠가 같은 성질(아무 문자열이나 올 수 있는
	 * 장소 ID)이라 무한히 자랄 위험도 같다.
	 *
	 * <h3>⚠️ TTL만 다르다 — 24시간</h3>
	 * 다른 캐시는 6시간이다({@link RegionCache#DEFAULT_TTL}). 공사 자료가 하루 1회
	 * 갱신되므로 그보다 짧게 잡아 <b>갱신을 늦게 반영하는 창</b>을 줄이려는 값이다.
	 *
	 * <p>소개글은 그 성질이 아니다. 집중률처럼 매일 바뀌는 예측값이 아니라 <b>몇 달에 한 번
	 * 손보는 글</b>이라, 하루를 붙들어 둬도 틀린 값을 보여줄 위험이 거의 없다.
	 *
	 * <p>대신 얻는 것이 분명하다. 소개글은 <b>장소마다 공사를 한 번씩</b> 부르는 유일한
	 * 자리라, 이 캐시가 살아 있는 동안이 곧 아끼는 호출이다.
	 *
	 * <p>⚠️ <b>다른 캐시까지 24시간으로 늘리지 말 것.</b> 두 가지를 잃는다 —
	 * 집중률이 반나절 묵은 값이 되고, 심사가 확인하는 <b>인증키 호출 이력</b>이 반으로 준다
	 * (CLAUDE.md 절대 규칙 1: 개발 기간 내내 실제 호출이 발생해야 한다).
	 * 지역 단위 호출은 원래 하루 50회 남짓이라 아껴 봐야 얻는 것이 없다.
	 */
	private static final Duration DESCRIPTION_TTL = Duration.ofHours(24);

	private final TtlCache<Optional<PlaceDescription>> descriptionCache;

	public KtoPlaceClient(KtoApiCaller caller, Clock clock) {
		this.caller = caller;
		this.cache = new RegionCache<>(clock);
		this.detailCache = new TtlCache<>(clock, RegionCache.DEFAULT_TTL, DETAIL_CACHE_MAX);
		this.descriptionCache = new TtlCache<>(clock, DESCRIPTION_TTL, DETAIL_CACHE_MAX);
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
		return detailCache.get(contentId, this::fetchDetail);
	}

	/**
	 * 장소 하나의 읽을거리. <b>상세 조회의 같은 응답</b>에서 주소와 소개글만 꺼낸다.
	 *
	 * <p>⚠️ 추가 파라미터를 보내지 않는다. 지금 요청({@code contentId}만)에 이미 28개 필드가
	 * 오고 그 안에 {@code overview}가 들어 있다(실측 2026-08-29, 3개 지역 18곳 전부 값이 있었고
	 * 길이는 118~1,399자). 옛 문서의 {@code overviewYN=Y}를 붙이면 오히려 응답이 깨진다.
	 */
	public Optional<PlaceDescription> findDescription(String contentId) {
		return descriptionCache.get(contentId, this::fetchDescription);
	}

	private Optional<PlaceDescription> fetchDescription(String contentId) {
		JsonNode item = detailItem(contentId);
		if (item == null) {
			return Optional.empty();
		}
		PlaceDescription description = new PlaceDescription(
				item.path("addr1").asText(""),
				item.path("overview").asText(""));
		// 둘 다 비었으면 없는 것으로 답한다. 화면이 빈 상자를 그리지 않게.
		return description.isEmpty() ? Optional.empty() : Optional.of(description);
	}

	/** 상세 응답에서 항목 하나를 꺼낸다. 없거나 모양이 다르면 {@code null} */
	private JsonNode detailItem(String contentId) {
		JsonNode items = caller.items(DETAIL_PATH, Map.of("contentId", contentId));
		JsonNode item = items.isArray() ? (items.isEmpty() ? null : items.get(0)) : items;
		if (item == null || item.isMissingNode() || !item.hasNonNull("contentid")) {
			return null;
		}
		return item;
	}

	private Optional<Place> fetchDetail(String contentId) {
		JsonNode item = detailItem(contentId);
		return item == null ? Optional.empty() : Optional.ofNullable(toPlace(item));
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
		if (!isInKorea(latitude, longitude)) {
			/*
			 * 좌표가 깨진 장소는 <b>없는 것보다 나쁘다.</b> 없으면 위에서 버려지지만,
			 * 틀린 값은 조용히 거짓말을 한다 — 지도에 엉뚱한 데 찍히고, 동선 근접도가
			 * 그 거리로 계산되어 추천 점수까지 오염된다.
			 *
			 * 실측(2026-08-25)에서 두 건이 걸렸다.
			 *   서귀포 "영주산"   경도 12.797   → 126.797에서 한 자리가 빠졌다. 9,877km 밖
			 *   경주 "해파랑길"   (0, 0)        → 기니만 앞바다
			 *
			 * 영주산은 예측 대상 분류(자연·풍경)라 실제로 대안 후보로 나가고 있었다.
			 */
			log.warn("좌표가 서비스 범위를 벗어나 건너뜁니다. contentId={}, 분류={}",
					id, item.path("lclsSystm1").asText(""));
			return null;
		}

		// 중분류를 함께 읽는다. VE(문화·명소)에 박물관·워터파크·리조트가 섞여 있어서,
		// 대분류만으로 대안을 고르면 역사 유적 자리에 워터파크가 올라온다.
		PlaceCategory category = PlaceCategories.of(
				item.path("lclsSystm1").asText("").trim(),
				item.path("lclsSystm2").asText("").trim());
		if (category == null) {
			return null;
		}

		String image = item.path("firstimage").asText("").trim();
		return new Place(id, title, latitude, longitude, category, image.isEmpty() ? null : image);
	}

	/**
	 * 좌표가 우리가 서비스하는 범위 안인가.
	 *
	 * <p>위도 -90~90, 경도 -180~180이라는 일반 검사로는 <b>부족하다.</b> 영주산의 경도 12.797은
	 * 그 범위 안에 있는 멀쩡한 숫자다 — 대서양 한가운데라는 사실은 우리가 한국만 다룬다는 것을
	 * 알아야 드러난다.
	 *
	 * <p>범위는 남한 전체를 넉넉히 감싼다(제주 남단 마라도 33.06, 강원 최북단 38.6,
	 * 서해 최서단 124.6, 동해 독도 131.9). 지역이 늘어도 이 값은 그대로 쓸 수 있다.
	 */
	private static boolean isInKorea(double latitude, double longitude) {
		return latitude >= 33.0 && latitude <= 38.7
				&& longitude >= 124.5 && longitude <= 132.0;
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
