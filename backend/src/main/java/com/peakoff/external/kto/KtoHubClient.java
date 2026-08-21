package com.peakoff.external.kto;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.peakoff.place.domain.Region;

/**
 * 공사 "기초지자체 중심 관광지"를 호출한다. 지역을 대표하는 관광지를 인기 순으로 준다.
 *
 * <h3>어디에 쓰는가</h3>
 * <ul>
 *   <li><b>검색 전 빈 화면</b> — 경주를 모르는 사용자가 첫 글자를 못 친다. 대표 몇 곳을
 *       보여줘야 시작할 수 있다.</li>
 *   <li><b>코스 자동 생성의 첫 장소 후보</b> — 하루의 출발점이 될 만한 곳.</li>
 * </ul>
 *
 * <h3>⚠️ 순위를 추천도에 넣지 않는다</h3>
 * {@code hubRank}는 <b>인기 순위</b>다. 인기 장소 = 붐비는 장소이므로, 이 값을 추천 점수에
 * 가점으로 쓰면 "덜 붐비는 곳으로 안내한다"는 과제와 정면으로 어긋난다.
 * 여기서는 <b>목록을 보여줄 순서</b>와 <b>후보군의 하한</b>으로만 쓴다 —
 * 아무도 모르는 곳만 추천하면 그것대로 쓸모가 없기 때문이다.
 */
@Component
public class KtoHubClient {

	private static final Logger log = LoggerFactory.getLogger(KtoHubClient.class);

	private static final String PATH = "/B551011/LocgoHubTarService1/areaBasedList1";

	/** 지역당 100건 정도가 온다(경주 실측). 넉넉히 잡아 한 번에 받는다. */
	private static final int MAX_ROWS = 500;

	/**
	 * 조회 기준 월.
	 *
	 * <p>⚠️ <b>고정값이다.</b> 이 API는 {@code baseYm}이 필수인데, 최신 월을 넣으면
	 * 아직 집계 전이라 빈 응답이 온다. 실측으로 자료가 있는 월을 확인해 박아 두었다.
	 * 시간이 지나면 이 값도 낡는다 — 자동으로 최신 월을 찾는 것은 호출이 여러 번 나가고,
	 * 그 판단을 어디에 둘지가 애매해서 지금은 상수로 둔다.
	 */
	private static final String BASE_MONTH = "202504";

	private final KtoApiCaller caller;
	private final RegionCache<List<String>> cache;

	public KtoHubClient(KtoApiCaller caller, Clock clock) {
		this.caller = caller;
		this.cache = new RegionCache<>(clock);
	}

	/**
	 * 지역 대표 관광지의 <b>이름</b>을 인기 순으로 돌려준다.
	 *
	 * <p>이름을 돌려주는 이유: 이 API의 식별자({@code hubTatsCd})는 국문 관광정보의
	 * 콘텐츠 ID와 다른 체계다. 우리 장소로 이으려면 어차피 이름을 거쳐야 한다
	 * ({@link PlaceNameMatcher}).
	 */
	public List<String> representativeNames(Region region) {
		return cache.get(region, this::fetch);
	}

	private List<String> fetch(Region region) {
		JsonNode items = caller.items(PATH, Map.of(
				"numOfRows", String.valueOf(MAX_ROWS),
				"pageNo", "1",
				"baseYm", BASE_MONTH,
				"areaCd", RegionCodes.areaCodeOf(region),
				"signguCd", RegionCodes.sigunguCodeOf(region)));

		if (!items.isArray() || items.isEmpty()) {
			log.warn("중심 관광지 응답에 항목이 없습니다. region={}, baseYm={}", region.name(), BASE_MONTH);
			return List.of();
		}

		/*
		 * 응답이 hubRank 순으로 오지만 믿지 않고 직접 정렬한다. 순서가 곧 "대표성"이라
		 * 화면에 그대로 드러나는데, 공사가 순서를 바꾸면 조용히 뒤섞인다.
		 */
		List<JsonNode> rows = new ArrayList<>();
		items.forEach(rows::add);
		rows.sort((a, b) -> Integer.compare(
				a.path("hubRank").asInt(Integer.MAX_VALUE),
				b.path("hubRank").asInt(Integer.MAX_VALUE)));

		List<String> names = rows.stream()
				.map(row -> row.path("hubTatsNm").asText("").trim())
				.filter(name -> !name.isEmpty())
				.distinct()
				.toList();

		log.info("중심 관광지 조회 완료. region={}, 대표 관광지={}곳", region.name(), names.size());
		return names;
	}
}
