package com.peakoff.external.kto.provider;

import java.time.LocalDate;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.HashSet;
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
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.AlternativeStandard;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.CandidateSource;
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
	 * <p>너무 좁으면 늘 같은 곳이 나와 분산이 무의미해지고, 너무 넓으면 한참 아래 후보가
	 * 1등으로 올라와 "왜 이게 추천이지"가 된다.
	 *
	 * <p><b>8에서 3으로 내렸다(분석 검증값).</b> 8은 <b>거르는 문이 넷뿐이던 시절</b>의
	 * 값이다. 그때는 자격 미달 후보가 Pool에 많이 남아 있어 넓게 잡아야 분산이 생겼다.
	 * 지금은 개선폭·거리·분류·중복이 앞에서 걸러 내므로 Pool에 남는 것은 이미
	 * "충분히 좋은 후보"뿐이다.
	 *
	 * <p>이 값이 실제로 일하게 되기까지 두 가지를 더 고쳐야 했다(2026-08-26).
	 * <ul>
	 *   <li><b>화면이 8개를 요청했다.</b> Pool이 셋인데 여덟을 달라고 하면
	 *       "다 가져가라"와 같아 Pool이라는 개념이 무의미해진다.
	 *       {@code AlternativeSheet.ALTERNATIVE_COUNT}를 3으로 내렸다</li>
	 *   <li><b>뽑기가 끝난 뒤 추천도 순으로 다시 정렬했다.</b> 뽑힌 순서가 통째로 덮여
	 *       최고점이 언제나 1등이었다. {@code findAlternatives}에서 걷어냈다</li>
	 * </ul>
	 *
	 * <p>둘을 고치기 전에는 자격 후보가 20곳인 자리에서도 1등이 68~82% 고정이었다 —
	 * 값이나 데이터가 모자라서가 아니었다.
	 */
	private static final int POOL_SIZE = WeightedPicker.DEFAULT_POOL_SIZE;

	/**
	 * 점수에 비례한 확률의 집중 정도. 1이면 점수에 정비례한다.
	 *
	 * <p><b>1.5에서 1.2로 내렸다(분석 검증값).</b> Pool이 셋으로 좁아졌으므로 그 안에서까지
	 * 세게 쏠릴 이유가 없다 — 이미 상위 셋만 남았는데 1등에 더 몰아주면 분산이 사라진다.
	 * 좁은 Pool에는 완만한 기울기가 맞는다.
	 *
	 * <p>⚠️ 설문 코스 생성은 여전히 자기 값을 쓴다({@code CrowdSensitivity}). 그쪽은
	 * 후보 풀의 성격이 달라(대표 관광지 100곳에서 고른다) 같은 값을 강요할 근거가 없다.
	 */
	private static final double PICK_BIAS = WeightedPicker.DEFAULT_BIAS;

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
	public Alternatives findAlternatives(Place origin, LocalDate date, int limit, Set<String> excluded) {
		if (origin == null || date == null) {
			throw new IllegalArgumentException("원래 장소와 날짜는 필수입니다.");
		}
		if (limit < 1) {
			throw new IllegalArgumentException("후보 수는 1 이상이어야 합니다. 입력값: " + limit);
		}
		Set<String> skip = excluded == null ? Set.of() : excluded;

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
			return Alternatives.of(originQuietness, 0, 0, List.of());
		}

		/*
		 * <b>두 출처를 함께 본다</b>(2026-09-01). 예전에는 연관 후보가 하나라도 있으면
		 * 지역 카탈로그를 아예 보지 않았다 — 근처에 훨씬 한적한 곳이 있어도 못 보여줬다.
		 *
		 * <p>섞지 않던 이유는 <b>"어떤 줄이 어느 출처인지 사용자가 읽어낼 방법이 없다"</b>였다.
		 * 그 전제가 사라졌다 — 이제 후보마다 자기 문장을 달고 나간다
		 * ("OO에 다녀간 사람들이 함께 찾은 곳 중에서 골랐어요" / "OO 근처의 비슷한 곳 중에서").
		 * 규칙이 막으려던 문제가 없어졌으므로 규칙도 함께 바꾼다.
		 *
		 * <p>⚠️ 지역 카탈로그를 <b>매번</b> 훑게 됐다. 공사 호출은 늘지 않는다(카탈로그는
		 * 6시간 캐시라 메모리에 있다). 대신 분류·거리로 먼저 자르는 순서가 더 중요해졌다 —
		 * 그 순서를 뒤집으면 제주시 1,271곳 전부에 이름 매칭이 돈다.
		 */
		Candidates related = scoreCandidates(origin, date, region, originQuietness);
		Candidates regional = scoreRegional(origin, date, region, originQuietness);

		/*
		 * 같은 장소가 양쪽에 들어 있으면 <b>연관 쪽을 남긴다.</b> "함께 찾는 곳"이 더 두꺼운
		 * 사실이라 그 문장을 쓰는 편이 맞고, 무엇보다 한 곳이 두 줄로 서면 안 된다.
		 */
		Set<String> relatedIds = related.qualified().stream()
				.map(scored -> scored.place().id())
				.collect(java.util.stream.Collectors.toUnmodifiableSet());

		// 중복을 먼저 걷어낸 뒤에 센다. 안 그러면 양쪽에 든 장소가 두 번 세어진다.
		List<ScoredPlace> qualified = new ArrayList<>(related.qualified());
		regional.qualified().stream()
				.filter(scored -> !relatedIds.contains(scored.place().id()))
				.forEach(qualified::add);

		List<ScoredPlace> relatedAvailable = notInCourse(related.qualified(), skip);
		List<ScoredPlace> regionalAvailable = notInCourse(regional.qualified(), skip).stream()
				.filter(scored -> !relatedIds.contains(scored.place().id()))
				.toList();

		int consideredCount = related.consideredCount() + regional.consideredCount();
		int inCourseCount = qualified.size() - relatedAvailable.size() - regionalAvailable.size();

		if (relatedAvailable.isEmpty() && regionalAvailable.isEmpty()) {
			return Alternatives.of(originQuietness, consideredCount, inCourseCount, List.of());
		}

		/*
		 * <b>출처마다 한 자리씩 보장하고, 남은 자리는 합쳐서 겨룬다.</b>
		 *
		 * <p>그냥 섞어 추천도로 자르면 <b>수가 많은 쪽이 상위권을 쓸어간다.</b> 실측에서
		 * 지역 후보가 연관 후보보다 5~6배 많았고(제주시 698 vs 125), 그 결과 연관이
		 * 상위 3에 하나도 못 드는 자리가 제주시 57%·서귀포 37%였다.
		 *
		 * <p>⚠️ <b>품질이 밀려서가 아니다.</b> 같은 실측에서 추천도 중앙값은 같거나 연관이
		 * 오히려 높았다(경주 53.5 vs 52.0 · 제주시 55 vs 55 · 서귀포 62 vs 57).
		 * 순전히 표본 크기 문제라, 크기와 무관한 장치로 풀어야 한다 —
		 * 가중치로 보정하면 배율이 지역마다 달라(4.9~6.4배) 값의 근거가 없어지고,
		 * 무엇보다 인기도를 점수에 넣는 것이 되어 과제와 어긋난다.
		 *
		 * <p>자리 보장은 <b>인기도 하한도 지킨다.</b> 지역 카탈로그에는 하한이 없어
		 * 아무도 가지 않는 곳이 올라올 수 있는데, 한 자리는 언제나 연관(=함께 가는 곳)이다.
		 */
		List<ScoredPlace> drawn = new ArrayList<>();
		reserveOne(drawn, relatedAvailable, limit);
		reserveOne(drawn, regionalAvailable, limit);

		List<ScoredPlace> rest = new ArrayList<>(relatedAvailable);
		rest.addAll(regionalAvailable);
		rest.removeAll(drawn);
		drawn.addAll(drawWithoutRepeat(rest, limit - drawn.size()));

		/*
		 * <b>뽑힌 순서를 그대로 내보낸다. 다시 정렬하지 않는다.</b>
		 *
		 * <p>예전에는 여기서 추천도 순으로 다시 세웠다. 그러면 <b>최고점이 뽑히기만 하면
		 * 언제나 1등</b>이 되어, 뽑기가 정한 순서가 통째로 덮인다. 실측(2026-08-26)에서
		 * 자격 후보가 20곳이나 되는 자리에서도 1등이 68~82% 고정이었다 —
		 * 데이터가 모자라서가 아니라 이 정렬 때문이었다.
		 *
		 * <p>화면은 <b>구간 단위까지만</b> 세운다(AlternativeSheet.tierRank). 점수로 줄
		 * 세우지 않으므로 분산이 살아 있고, 카드에 적힌 문구와 순서가 어긋나지도 않는다.
		 *
		 * <p>⚠️ 화면 문구와 <b>한 몸이다.</b> "추천도가 높은 순"이라고 적어 두면
		 * 82점 아래 79점이 선 목록이 거짓말이 된다.
		 */
		List<Alternative> picked = drawn.stream()
				.map(candidate -> candidate.withReason(reasonFor(origin,
						relatedIds.contains(candidate.place().id())
								? CandidateSource.RELATED
								: CandidateSource.REGIONAL_FALLBACK)))
				.toList();

		return Alternatives.of(originQuietness, consideredCount, inCourseCount, picked);
	}

	/**
	 * 이미 코스에 담긴 곳을 뺀다. <b>자격을 따진 뒤, 뽑기 앞이다.</b>
	 *
	 * <p>뽑기 뒤로 미루면 고를 수 없는 곳이 Pool 자리를 차지해 목록이 이유 없이 짧아진다.
	 * 반대로 자격 심사보다 앞에 두면 "이미 담긴 후보"가 몇이었는지 알 수 없어져,
	 * 더 한적한 곳을 찾고도 "찾지 못했다"고 말하게 된다.
	 */
	private static List<ScoredPlace> notInCourse(List<ScoredPlace> qualified, Set<String> skip) {
		return qualified.stream()
				.filter(scored -> !skip.contains(scored.place().id()))
				.toList();
	}

	/**
	 * 한 출처의 몫으로 한 자리를 뽑아 담는다. 후보가 없거나 자리가 다 찼으면 아무 일도 안 한다.
	 *
	 * <p>뽑기는 여기서도 <b>가중 무작위</b>다 — 그 출처의 1등을 늘 세우면 자리 보장이
	 * "출처별 1등 고정"이 되어, 분산을 지키려고 만든 장치가 분산을 죽인다.
	 */
	private void reserveOne(List<ScoredPlace> drawn, List<ScoredPlace> pool, int limit) {
		if (drawn.size() >= limit || pool.isEmpty()) {
			return;
		}
		picker.pick(pool, ScoredPlace::recommendation, PICK_BIAS, POOL_SIZE).ifPresent(drawn::add);
	}

	/**
	 * 같은 지역 카탈로그에서 후보를 고른다. <b>연관 후보가 있든 없든 늘 부른다</b>(2026-09-01).
	 *
	 * <p>예전에는 연관 후보가 하나도 없을 때만 불렀다. 그래서 근처에 훨씬 한적한 곳이 있어도
	 * 연관 목록이 비어 있지 않으면 못 보여줬다. 두 출처를 함께 보게 되면서
	 * 대안 3개를 채우는 자리가 <b>41% → 86%</b>가 됐다.
	 *
	 * <p>거르는 조건은 연관 경로와 <b>글자 그대로 같다</b> — 자기 자신·분류·거리·혼잡 자료·개선폭.
	 * 다른 것은 후보를 어디서 가져왔는지뿐이고, 그 차이는 근거 문구에서만 드러난다.
	 *
	 * <p>순서가 성능을 좌우한다. 분류와 거리로 먼저 자르면 혼잡 자료 조회가 몇십 번으로 줄어든다 —
	 * 그것을 앞에 두면 제주시 1,271곳 전부에 이름 매칭이 돈다.
	 */
	private Candidates scoreRegional(Place origin, LocalDate date, Region region, int originQuietness) {
		RegionCatalog catalog = placeClient.catalogOf(region);
		if (catalog.isEmpty()) {
			return new Candidates(List.of(), 0);
		}

		List<ScoredPlace> scored = new ArrayList<>();
		int considered = 0;

		for (Place candidate : catalog.all()) {
			if (candidate.id().equals(origin.id())) {
				continue;
			}
			if (!PlaceCategories.compatible(origin.category(), candidate.category())) {
				continue;
			}
			if (!AlternativeStandard.isWithinReach(Distances.betweenKm(origin, candidate))) {
				continue;
			}
			if (!congestionProvider.hasData(candidate.id(), date)) {
				continue;
			}
			ScoredPlace candidateScore = scorer.scoreAgainst(origin, candidate, date, ScoreWeights.DEFAULT);
			considered++;
			if (!AlternativeStandard.isWorthSuggesting(originQuietness, candidateScore.quietness())) {
				continue;
			}
			scored.add(candidateScore);
		}
		return new Candidates(scored, considered);
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
		/*
		 * ⚠️ 이미 담은 장소를 다시 담지 않는다 (2026-08-31).
		 *
		 * 이 루프는 <b>이름</b>을 도는데 여러 이름이 <b>같은 장소</b>로 이어진다. 연관 목록에
		 * "영랑호"와 "영랑호수윗길"이 따로 들어 있으면 둘 다 우리 카탈로그의 영랑호(127565)로
		 * 이어져, 같은 곳이 후보 목록에 두 번 들어간다. 7-1에서 양방향 포함 매칭을 열어 준
		 * 대가이고, 지역이 늘면서 눈에 띄었다 — 속초에서 8번 물어 8번 다 중복이 나왔다.
		 *
		 * 화면에서는 <b>대안 셋 중 둘이 같은 곳</b>으로 서서, 고를 것을 셋 준 척하며 둘만 준다.
		 * Pool이 3이라 중복 하나가 선택지의 3분의 1을 통째로 먹는다.
		 *
		 * 거르기는 {@code considered}를 세기 <b>전에</b> 한다. 같은 장소를 두 번 "따져 봤다"고
		 * 세면 "왜 대안이 비었나"를 설명하는 분모가 틀어진다.
		 */
		Set<String> alreadyTaken = new HashSet<>();
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
			if (!alreadyTaken.add(candidate.id())) {
				continue;
			}
			if (!PlaceCategories.compatible(origin.category(), candidate.category())) {
				/*
				 * 음식점 자리에 숙박을 넣지 않는다. 분류 적합성은 지금 점수가 아니라 필터다.
				 *
				 * 코드가 정확히 같아야 한다는 규칙에서 바뀌었다 — 그러면 역사 유적 자리에
				 * 박물관이 못 들어가고, 반대로 VE끼리는 전부 통과해 황리단길 자리에
				 * 리조트가 올라왔다. 판단은 {@code PlaceCategories}가 중분류까지 보고 한다.
				 */
				continue;
			}
			if (!AlternativeStandard.isWithinReach(Distances.betweenKm(origin, candidate))) {
				/*
				 * 너무 멀다. 점수를 매기기 전에 자른다 — 근접도는 거리를 깎을 뿐 막지 못해서,
				 * 아주 한적한 곳은 38km 밖에서도 총점이 높게 나온다.
				 */
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
	 * 추천 근거. <b>후보를 어디서 가져왔느냐에 따라 할 수 있는 말이 다르다.</b>
	 *
	 * <pre>
	 * 연관    "불국사에 다녀간 사람들이 함께 찾은 곳 중에서 골랐어요."
	 * 지역    "불국사 근처의 비슷한 곳 중에서 골랐어요."
	 * </pre>
	 *
	 * <p><b>문장은 {@link CandidateSource#noteFor}가 만든다.</b> 여기서 따로 지으면
	 * 같은 말이 두 벌이 되어 한쪽만 고쳐진다 — 실제로 그랬다.
	 *
	 * <p>⚠️ <b>혼잡 문구를 뒤에 붙이지 않는다</b>(2026-09-01에 걷어냈다). 한때
	 * "… · 예상 혼잡 낮음"으로 끝났는데, <b>바로 윗줄에 한적도 배지가 이미 서 있다</b>
	 * ("한적 73"). 같은 사실을 숫자로 한 번, 말로 한 번 말하는 셈이라 줄만 길어졌다.
	 * 이 문장이 할 일은 <b>어디서 왔는지</b>이고 얼마나 한적한지는 배지가 맡는다.
	 *
	 * <p>둘 다 <b>장소 이름 뒤에 조사가 오지 않게</b> 지었다. 한국어의 "와/과"는 앞 글자의
	 * 받침에 따라 갈리는데, 장소 이름은 무엇으로 끝날지 알 수 없다 — 실제로
	 * "경주엑스포대공원와"라는 틀린 말이 나왔다. 조사를 붙이려면 받침을 판별하는 코드가
	 * 하나 더 필요하고, 괄호나 숫자로 끝나는 이름에서는 그것도 답을 못 낸다.
	 *
	 * <p>지역 카탈로그에서 고른 후보에게 "함께 많이 찾는 곳"이라고 하면 <b>계산하지 않은 것을
	 * 근거로 말하는 것</b>이다. 우리가 실제로 본 것은 분류와 거리와 한적도뿐이므로 그것만 말한다.
	 *
	 * <p>"비슷한 분류"가 아니라 <b>"비슷한 곳"</b>이다(2026-09-01). "분류"는 우리가 나눈
	 * 체계의 이름이지 사용자가 쓰는 말이 아니다 — 카드에 이미 분류명이 적혀 있어서
	 * (역사·유적) 그 말을 문장에서 또 할 이유도 없다. 무엇이 비슷한지는 화면이 보여준다.
	 *
	 * <p>"같은"이 아니라 "비슷한"인 것은 그대로다: 역사 유적 자리에 박물관이 올 수 있게
	 * 호환 범위를 넓혔으므로({@code PlaceCategories.compatible}) "같은"이라고 하면
	 * 화면에 뜬 분류명과 어긋나 사용자가 우리 말을 믿지 않게 된다.
	 *
	 * <p>기술 용어는 쓰지 않는다. 사용자에게 필요한 것은 "fallback"이 아니라
	 * 그 장소가 왜 나왔는지다.
	 */
	private static String reasonFor(Place origin, CandidateSource source) {
		return source.noteFor(origin.name());
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
