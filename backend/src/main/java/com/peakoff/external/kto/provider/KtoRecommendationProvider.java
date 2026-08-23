package com.peakoff.external.kto.provider;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.client.KtoRelatedClient;
import com.peakoff.external.kto.client.RegionCatalog;
import com.peakoff.external.kto.client.RelatedPlaces;
import com.peakoff.external.kto.support.PlaceNameMatcher;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.Alternative;
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
@RequiredArgsConstructor
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

	@Override
	public List<Alternative> findAlternatives(Place origin, LocalDate date, int limit) {
		if (origin == null || date == null) {
			throw new IllegalArgumentException("원래 장소와 날짜는 필수입니다.");
		}
		if (limit < 1) {
			throw new IllegalArgumentException("후보 수는 1 이상이어야 합니다. 입력값: " + limit);
		}

		Region region = region();
		List<ScoredPlace> scored = scoreCandidates(origin, date, region);
		if (scored.isEmpty()) {
			return List.of();
		}

		return drawWithoutRepeat(scored, limit).stream()
				.map(candidate -> candidate.withReason(reasonFor(origin, candidate)))
				// 화면에 보이는 값으로 줄을 세운다. 뽑기는 끝났고 여기서는 보기 좋게 정렬만 한다.
				.sorted(Comparator.comparingInt(Alternative::recommendation).reversed())
				.toList();
	}

	/** 1~3단계: 후보를 모으고, 거르고, 점수를 매긴다. */
	private List<ScoredPlace> scoreCandidates(Place origin, LocalDate date, Region region) {
		RelatedPlaces related = relatedClient.relatedOf(region);
		RegionCatalog catalog = placeClient.catalogOf(region);
		if (related.isEmpty() || catalog.isEmpty()) {
			return List.of();
		}

		/*
		 * 연관 데이터는 "불국사"라고 부르고 우리 장소는 "경주 불국사 [유네스코 세계유산]"이다.
		 * 기준 장소를 그쪽 이름으로 먼저 옮겨야 연관 목록을 찾을 수 있다.
		 */
		Optional<String> originName = nameMatcher.match(origin.name(), region, related.originNames());
		if (originName.isEmpty()) {
			return List.of();
		}

		Map<String, Place> byName = catalog.byName();
		List<ScoredPlace> scored = new ArrayList<>();

		for (String relatedName : related.relatedTo(originName.get())) {
			Place candidate = nameMatcher.match(relatedName, region, byName.keySet())
					.map(byName::get)
					.orElse(null);
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
			scored.add(scorer.scoreAgainst(origin, candidate, date, ScoreWeights.DEFAULT));
		}
		return scored;
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

	/** v1은 파일럿 한 지역이라 경주로 고정한다. 지역을 늘릴 때 손댈 자리를 남겨 둔다. */
	private static Region region() {
		return SupportedRegion.GYEONGJU.toRegion();
	}
}
