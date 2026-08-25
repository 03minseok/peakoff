package com.peakoff.external.kto.provider;

import java.time.LocalDate;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.client.KtoRelatedClient;
import com.peakoff.external.kto.client.RegionCatalog;
import com.peakoff.external.kto.client.RelatedPlaces;
import com.peakoff.external.kto.support.PlaceNameMatcher;
import com.peakoff.external.kto.support.RegionCache;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.AlternativeStandard;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.RecommendationProvider;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoreWeights;
import com.peakoff.recommendation.domain.ScoredPlace;
import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * 연관 관광지 데이터로 대안 후보를 고른다. 목업 공급자를 대신한다.
 *
 * <h3>순서가 규칙이다</h3>
 * <b>거르기가 먼저이고 뽑기가 마지막이다.</b> 거르기를 뽑기 뒤로 미루면 자격 미달 후보가
 * 무작위로 1등이 될 수 있다.
 * <ol>
 *   <li>연관 관광지에서 후보를 모은다 — 함께 많이 방문되는 곳</li>
 *   <li>지역·분류·혼잡자료·중복 조건으로 거른다</li>
 *   <li>한적도와 동선 근접도로 추천도를 계산한다</li>
 *   <li>상위 후보 Pool을 만든다</li>
 *   <li>Pool 안에서 점수에 비례한 가중 무작위로, 중복 없이 뽑는다</li>
 * </ol>
 *
 * <h3>왜 1등을 그대로 주지 않는가</h3>
 * 같은 대안이 모든 사용자에게 반복 추천되면 그곳이 <b>새로운 혼잡지</b>가 된다.
 * 붐비는 곳을 피하라고 안내해 놓고 한 곳으로 몰아주면, 서비스가 직접 2차 오버투어리즘을
 * 만드는 셈이다. 점수가 높을수록 뽑힐 확률이 높되 매번 같은 결과가 나오지는 않게 한다.
 *
 * <p>후보군을 상위 몇 곳으로 먼저 자르기 때문에 <b>정확도를 포기하는 것이 아니다.</b>
 * 뽑히는 것은 언제나 "충분히 좋은 후보" 안에서다.
 *
 * <p>⚠️ 매 호출마다 다시 뽑으므로, <b>화면이 결과를 들고 있어야 한다.</b> 대안 시트를
 * 닫았다 열 때마다 목록이 바뀌면 사용자가 되돌아갈 후보를 찾지 못한다.
 * 서버가 결과를 캐시하지 않는 이유는 그러면 모든 사용자가 같은 목록을 받아 분산이 죽기 때문이다 —
 * 캐시는 공사 원자료 층에만 둔다.
 */
@Component
@ConditionalOnProperty(name = "peakoff.kto.recommendation", havingValue = "real")
public class KtoRecommendationProvider implements RecommendationProvider {

	/**
	 * 가중 무작위를 적용할 상위 후보군 크기.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b> 너무 좁으면 늘 같은 곳이 나와 분산이 무의미해지고,
	 * 너무 넓으면 한참 아래 후보가 1등으로 올라와 "왜 이게 추천이지"가 된다.
	 */
	private static final int POOL_SIZE = 8;

	/**
	 * 점수에 비례한 확률의 집중 정도. 1이면 점수에 정비례한다.
	 *
	 * <p>1.5는 상위 후보에 적당히 쏠리되 아래쪽도 뽑힐 여지를 남기는 값이다.
	 * 설문 코스 생성의 "적당히 섞기"와 같은 값을 쓴다 — 두 화면이 같은 성격의 분산을 해야 한다.
	 */
	private static final double PICK_BIAS = 1.5;

	private final KtoRelatedClient relatedClient;
	private final KtoPlaceClient placeClient;
	private final PlaceNameMatcher nameMatcher;
	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;
	private final WeightedPicker picker;

	/**
	 * 연관 관광지 이름을 <b>우리 장소로 이어 놓은 대응표</b>. 지역별로 한 벌 들고 있는다.
	 *
	 * <h3>왜 여기까지 캐시하는가</h3>
	 * 원자료(연관 목록·지역 카탈로그)는 이미 캐시돼 있었는데도 대안 한 번에 930ms가 걸렸다.
	 * 남은 비용이 <b>이름 매칭</b>이었다 — 기준 장소의 연관 이름 수십 개를 카탈로그 621곳과
	 * 견주는데, 후보 하나마다 정규화를 두 번 돌린다.
	 *
	 * <h3>⚠️ 추천 분산은 그대로다</h3>
	 * 여기 담기는 것은 <b>이름과 장소의 대응뿐</b>이다. 점수도, 순서도, 뽑힌 결과도 없다.
	 * 캐시하면 안 되는 것은 <b>완성된 대안 목록</b>이다 — 그것을 캐시해 모든 사용자에게
	 * 같은 답을 돌려주면 그곳이 새로운 혼잡지가 된다(2차 오버투어리즘).
	 * 아래 {@code scoreCandidates}의 점수 계산과 {@code drawWithoutRepeat}의 가중 무작위
	 * 뽑기는 <b>매 호출마다</b> 그대로 돈다.
	 *
	 * <p>표는 <b>물어본 이름만</b> 채워진다. 자세한 이유는 {@link NameIndex}에 적어 두었다.
	 */
	private final RegionCache<NameIndex> relatedIndex;

	public KtoRecommendationProvider(KtoRelatedClient relatedClient, KtoPlaceClient placeClient,
			PlaceNameMatcher nameMatcher, CongestionProvider congestionProvider,
			RecommendationScorer scorer, WeightedPicker picker, Clock clock) {
		this.relatedClient = relatedClient;
		this.placeClient = placeClient;
		this.nameMatcher = nameMatcher;
		this.congestionProvider = congestionProvider;
		this.scorer = scorer;
		this.picker = picker;
		this.relatedIndex = new RegionCache<>(clock);
	}

	@Override
	public Alternatives findAlternatives(Place origin, LocalDate date, int limit) {
		if (origin == null || date == null) {
			throw new IllegalArgumentException("원래 장소와 날짜는 필수입니다.");
		}
		if (limit < 1) {
			throw new IllegalArgumentException("후보 수는 1 이상이어야 합니다. 입력값: " + limit);
		}

		/*
		 * 원래 장소의 한적도가 먼저다. 이 값이 없으면 "얼마나 나아지는가"를 잴 기준이 없어
		 * 후보를 아무리 모아도 대안이라고 부를 수 없다.
		 */
		if (!congestionProvider.hasData(origin.id(), date)) {
			return Alternatives.originNotForecasted();
		}
		int originQuietness = congestionProvider.quietnessOf(origin.id(), date);

		/*
		 * 기준 장소가 든 지역에서만 후보를 찾는다.
		 *
		 * 장소 ID에 지역이 묻어 있지 않아 지원 지역을 하나씩 훑는다. 못 찾으면 후보가 없다 —
		 * 어느 지역 카탈로그에도 없는 장소는 연관 목록에도 없다.
		 */
		Region region = regionOf(origin).orElse(null);
		if (region == null) {
			return Alternatives.of(originQuietness, 0, List.of());
		}

		Candidates candidates = scoreCandidates(origin, date, region, originQuietness);
		if (candidates.qualified().isEmpty()) {
			return Alternatives.of(originQuietness, candidates.consideredCount(), List.of());
		}

		List<Alternative> picked = drawWithoutRepeat(candidates.qualified(), limit).stream()
				.map(candidate -> candidate.withReason(reasonFor(origin, candidate)))
				// 화면에 보이는 값으로 줄을 세운다. 뽑기는 끝났고 여기서는 보기 좋게 정렬만 한다.
				.sorted(Comparator.comparingInt(Alternative::recommendation).reversed())
				.toList();

		return Alternatives.of(originQuietness, candidates.consideredCount(), picked);
	}

	/**
	 * 거르기의 결과. <b>통과한 것과, 통과를 따져 본 것의 수를 함께 들고 나온다.</b>
	 *
	 * <p>통과한 목록만 돌려주면 "후보가 아예 없었다"와 "후보는 있었는데 아무도 하한을
	 * 넘지 못했다"가 똑같이 빈 목록이 된다. 둘은 사용자에게 정반대의 소식이라
	 * ({@code NO_VALID_CANDIDATE} / {@code ALREADY_QUIET}) 여기서 갈라 두어야 한다.
	 *
	 * @param qualified       개선폭까지 통과한 후보. 뽑기의 재료가 된다
	 * @param consideredCount 지역·분류·자료 조건을 통과해 <b>개선폭을 따져 본</b> 후보 수
	 */
	private record Candidates(List<ScoredPlace> qualified, int consideredCount) {
	}

	/**
	 * 1~3단계: 후보를 모으고, 거르고, 점수를 매긴다.
	 *
	 * <p>여기서 나온 것이 곧 <b>자격을 갖춘 후보 전부</b>다. 뽑기는 이 다음이다 —
	 * 순서를 뒤집으면 자격 미달 후보가 무작위로 1등이 될 수 있다.
	 */
	private Candidates scoreCandidates(Place origin, LocalDate date, Region region,
			int originQuietness) {
		RelatedPlaces related = relatedClient.relatedOf(region);
		RegionCatalog catalog = placeClient.catalogOf(region);
		if (related.isEmpty() || catalog.isEmpty()) {
			return new Candidates(List.of(), 0);
		}

		/*
		 * 연관 데이터는 "불국사"라고 부르고 우리 장소는 "경주 불국사 [유네스코 세계유산]"이다.
		 * 기준 장소를 그쪽 이름으로 먼저 옮겨야 연관 목록을 찾을 수 있다.
		 */
		Optional<String> originName = nameMatcher.match(origin.name(), region, related.originNames());
		if (originName.isEmpty()) {
			return new Candidates(List.of(), 0);
		}

		NameIndex index = relatedIndex.get(region, this::newIndex);
		List<ScoredPlace> scored = new ArrayList<>();
		int considered = 0;

		for (String relatedName : related.relatedTo(originName.get())) {
			Place candidate = index.resolve(relatedName, region, nameMatcher);
			if (candidate == null) {
				// 우리 카탈로그에 없는 이름. 좌표도 사진도 없어 화면에 세울 수 없다.
				continue;
			}
			if (candidate.id().equals(origin.id())) {
				continue;
			}
			if (!candidate.category().code().equals(origin.category().code())) {
				// 음식점 자리에 숙박을 넣지 않는다. 분류 적합성은 지금 점수가 아니라 필터다.
				continue;
			}
			if (!congestionProvider.hasData(candidate.id(), date)) {
				// 자료가 없는 곳을 0점으로 뭉개면 화면에서 "매우 붐빔"으로 잘못 읽힌다.
				continue;
			}
			ScoredPlace candidateScore = scorer.scoreAgainst(origin, candidate, date, ScoreWeights.DEFAULT);
			// 여기까지 온 것이 "따져 본 후보"다. 하한을 넘든 못 넘든 자격 심사는 받았다.
			considered++;
			/*
			 * 원래 장소보다 뚜렷하게 한적하지 않으면 대안이 아니다.
			 *
			 * 이 문이 없으면 <b>더 붐비는 곳도 "대안"으로 나간다.</b> 추천도에 동선 근접도가
			 * 섞여 있어서, 아주 가까운 곳은 한적도가 원래보다 낮아도 총점이 높게 나올 수 있다.
			 * 붐비는 곳을 피하라고 안내해 놓고 더 붐비는 곳을 권하면 과제와 정면으로 어긋난다.
			 */
			if (!AlternativeStandard.isWorthSuggesting(originQuietness, candidateScore.quietness())) {
				continue;
			}
			scored.add(candidateScore);
		}
		return new Candidates(scored, considered);
	}

	/**
	 * 공사 이름 하나를 우리 장소로 이어 놓고 <b>물어본 것만</b> 기억한다.
	 *
	 * <h3>왜 통째로 미리 만들지 않는가</h3>
	 * 처음에는 지역의 연관 이름 전부를 한 번에 이어 표로 만들었다. 두 번째 요청부터는
	 * 빨랐지만 <b>첫 요청이 2.1초가 됐다</b> — 자기가 쓰지도 않을 수백 개를 대신 이어 주느라
	 * 그렇다. 사용자는 평균이 아니라 자기가 누른 그 한 번을 기다린다.
	 *
	 * <p>그래서 기준 장소의 연관 이름(수십 개)만 잇고 그 결과를 남긴다. 다음 사람이 같은
	 * 장소를 물으면 공짜고, 다른 장소를 물어도 자기 몫만 치른다.
	 *
	 * <h3>⚠️ 여기에 점수는 없다</h3>
	 * 담기는 것은 이름과 장소의 대응뿐이다. 점수 계산과 가중 무작위 뽑기는 매 호출마다
	 * 그대로 돈다 — 완성된 대안 목록을 캐시하면 모두가 같은 답을 받아 분산이 죽는다.
	 *
	 * @param byName 카탈로그의 이름 → 장소. 한 번만 만들어 들고 있는다
	 * @param memo   이미 이어 본 이름. 못 이은 것도 빈 값으로 남겨 두 번 헛수고하지 않는다
	 */
	private record NameIndex(Map<String, Place> byName, Map<String, Optional<Place>> memo) {

		Place resolve(String ktoName, Region region, PlaceNameMatcher matcher) {
			return memo.computeIfAbsent(ktoName,
					name -> matcher.match(name, region, byName.keySet()).map(byName::get))
					.orElse(null);
		}
	}

	private NameIndex newIndex(Region region) {
		RegionCatalog catalog = placeClient.catalogOf(region);
		return new NameIndex(catalog.isEmpty() ? Map.of() : catalog.byName(),
				new ConcurrentHashMap<>());
	}

	/**
	 * 4~5단계: 상위 후보군에서 가중 무작위로, <b>중복 없이</b> 뽑는다.
	 *
	 * <p>뽑은 것을 후보에서 빼고 다시 뽑는다. 빼지 않으면 같은 곳이 목록에 두 번 오른다.
	 */
	private List<ScoredPlace> drawWithoutRepeat(List<ScoredPlace> candidates, int limit) {
		List<ScoredPlace> remaining = new ArrayList<>(candidates);
		List<ScoredPlace> drawn = new ArrayList<>();

		while (drawn.size() < limit && !remaining.isEmpty()) {
			Optional<ScoredPlace> picked =
					picker.pick(remaining, ScoredPlace::recommendation, PICK_BIAS, POOL_SIZE);
			if (picked.isEmpty()) {
				break;
			}
			drawn.add(picked.get());
			remaining.remove(picked.get());
		}
		return drawn;
	}

	/**
	 * 추천 근거. <b>이제 "함께 많이 찾는 곳"이라고 말할 수 있다.</b>
	 *
	 * <p>목업 시절에는 이 문구를 쓸 수 없었다. 계산하지 않은 것을 근거로 말하지 않는다는
	 * 규칙 때문이다. 연관 관광지 데이터가 실제로 후보를 고르는 지금은 사실이 됐다.
	 *
	 * <p>예: "불국사 방문객이 함께 많이 찾는 곳 · 예상 혼잡 낮음"
	 */
	private static String reasonFor(Place origin, ScoredPlace scored) {
		return "%s 방문객이 함께 많이 찾는 곳 · %s".formatted(
				origin.name(), scored.level().congestionPhrase());
	}

	/**
	 * 그 장소가 어느 지역 카탈로그에 들어 있는지 찾는다.
	 *
	 * <p>카탈로그는 6시간 캐시라 대개 메모리에 있다. 첫 조회에서만 지역 수만큼 부른다.
	 */
	private Optional<Region> regionOf(Place origin) {
		return SupportedRegion.allRegions().stream()
				.filter(region -> placeClient.catalogOf(region).findById(origin.id()).isPresent())
				.findFirst();
	}
}
