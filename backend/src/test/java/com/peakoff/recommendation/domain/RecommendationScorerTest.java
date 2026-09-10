package com.peakoff.recommendation.domain;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 추천도 = 한적도 × 70% + 동선 근접도 × 30%.
 *
 * <p>여기서 잠그는 것은 식의 <b>모양</b>이다 — 항목이 둘뿐인 것, 한적도 비중이 큰 것,
 * 근접도가 1km당 5점씩 깎여 20km에서 0이 되는 것, 그리고 화면에 내려보내는 {@code factors}로
 * 합계를 계산하는 것. 가중치 값(70:30)은 {@code ScoreWeights}가 소유하고 분석이 정하므로
 * 여기서는 <b>기본값을 통해</b> 확인만 한다.
 *
 * <p>마감 직전에 근접도 감점이나 반올림 자리를 건드리면 대안 목록이 조용히 뒤바뀐다 —
 * 순서가 가중 무작위라 눈으로는 고장을 못 가른다. 그래서 숫자로 잠근다.
 */
class RecommendationScorerTest {

	private static final LocalDate DATE = LocalDate.of(2026, 9, 20);

	/** 경주 첨성대 근처. 좌표는 한국 범위 안이면 된다 */
	private static final Place ANCHOR = place("anchor", 35.8347, 129.2190);

	private static Place place(String id, double lat, double lng) {
		return new Place(id, "장소 " + id, lat, lng, new PlaceCategory("NA", "자연/명소"), null);
	}

	/** 장소 id → 한적도. 없는 곳은 묻지 않으므로 예외로 둔다 */
	private static RecommendationScorer scorerWith(Map<String, Integer> quietness) {
		return new RecommendationScorer(new CongestionProvider() {
			@Override
			public int quietnessOf(String placeId, LocalDate date) {
				Integer value = quietness.get(placeId);
				if (value == null) {
					throw new IllegalStateException("한적도가 없는 장소를 물었다: " + placeId);
				}
				return value;
			}

			@Override
			public boolean hasData(String placeId) {
				return quietness.containsKey(placeId);
			}

			@Override
			public boolean hasData(String placeId, LocalDate date) {
				return quietness.containsKey(placeId);
			}

			@Override
			public Optional<LocalDate> lastForecastDate() {
				return Optional.of(DATE.plusDays(10));
			}
		});
	}

	@Test
	@DisplayName("비교 대상이 없으면 한적도가 전부다 — 근접도 항목을 0점으로 만들지 않는다")
	void aloneIsQuietnessOnly() {
		ScoredPlace scored = scorerWith(Map.of("a", 78)).scoreAlone(place("a", 35.79, 129.33), DATE);

		assertThat(scored.recommendation()).isEqualTo(78);
		assertThat(scored.quietness()).isEqualTo(78);
		assertThat(scored.level()).isEqualTo(CongestionLevel.QUIET);
		// 항목이 하나뿐이다. "동선 근접도 0"이 화면에 찍히면 계산하지 않은 것을 계산한 척이 된다
		assertThat(scored.factors()).hasSize(1);
		assertThat(scored.factors().get(0).label()).isEqualTo("한적도");
		assertThat(scored.factors().get(0).weightPercent()).isEqualTo(100);
	}

	@Test
	@DisplayName("같은 자리면 근접도가 100이다 — 기본 비율로 0.7×한적도 + 30")
	void sameSpotScoresFullProximity() {
		Place candidate = place("c", ANCHOR.latitude(), ANCHOR.longitude());
		ScoredPlace scored = scorerWith(Map.of("c", 80))
				.scoreAgainst(ANCHOR, candidate, DATE, ScoreWeights.DEFAULT);

		// 80×70 + 100×30 = 8,600 → 86
		assertThat(scored.recommendation()).isEqualTo(86);
		assertThat(scored.factors()).extracting(ScoreFactor::label).containsExactly("한적도", "동선 근접도");
		assertThat(scored.factors()).extracting(ScoreFactor::weightPercent).containsExactly(70, 30);
		assertThat(scored.factors().get(1).score()).isEqualTo(100);
	}

	@Test
	@DisplayName("20km 밖이면 근접도가 0이다 — 그래도 음수로 내려가지 않는다")
	void farAwayScoresZeroProximity() {
		// 위도 0.3도 ≈ 33km
		Place candidate = place("c", ANCHOR.latitude() + 0.3, ANCHOR.longitude());
		assertThat(Distances.betweenKm(ANCHOR, candidate)).isGreaterThan(20);

		ScoredPlace scored = scorerWith(Map.of("c", 80))
				.scoreAgainst(ANCHOR, candidate, DATE, ScoreWeights.DEFAULT);

		// 80×70 + 0×30 = 5,600 → 56
		assertThat(scored.recommendation()).isEqualTo(56);
		assertThat(scored.factors().get(1).score()).isEqualTo(0);
	}

	@Test
	@DisplayName("근접도는 1km당 5점씩 깎인다")
	void proximityDropsFivePerKm() {
		// 위도 0.036도 ≈ 4.0km. 실제 거리로 기대값을 세워 반올림 자리를 함께 잠근다
		Place candidate = place("c", ANCHOR.latitude() + 0.036, ANCHOR.longitude());
		double km = Distances.betweenKm(ANCHOR, candidate);
		int expectedProximity = (int) Math.round(100 - km * 5);

		ScoredPlace scored = scorerWith(Map.of("c", 60))
				.scoreAgainst(ANCHOR, candidate, DATE, ScoreWeights.DEFAULT);

		assertThat(scored.factors().get(1).score()).isEqualTo(expectedProximity);
		assertThat(scored.recommendation()).isEqualTo((int) Math.round((60 * 70 + expectedProximity * 30) / 100.0));
	}

	@Test
	@DisplayName("한적도 비중이 커질수록 가까운 붐빔보다 먼 한적이 앞선다")
	void quietnessWeightDecidesNearCrowdedVersusFarQuiet() {
		Place nearButCrowded = place("near", ANCHOR.latitude() + 0.009, ANCHOR.longitude()); // ≈1km
		Place farButQuiet = place("far", ANCHOR.latitude() + 0.09, ANCHOR.longitude());      // ≈10km
		RecommendationScorer scorer = scorerWith(Map.of("near", 40, "far", 85));

		ScoreWeights quietFirst = new ScoreWeights(85, 15);
		int near = scorer.scoreAgainst(ANCHOR, nearButCrowded, DATE, quietFirst).recommendation();
		int far = scorer.scoreAgainst(ANCHOR, farButQuiet, DATE, quietFirst).recommendation();

		// 한적한 곳으로 보내는 것이 추천의 목적이다. 가깝다는 이유로 붐비는 곳이 앞서면 과제와 어긋난다
		assertThat(far).isGreaterThan(near);
	}

	@Test
	@DisplayName("합계는 화면에 내려보내는 factors로 계산한다 — 적힌 근거와 점수가 어긋날 수 없다")
	void totalIsDerivedFromTheFactorsShown() {
		Place candidate = place("c", ANCHOR.latitude() + 0.02, ANCHOR.longitude());
		ScoredPlace scored = scorerWith(Map.of("c", 72))
				.scoreAgainst(ANCHOR, candidate, DATE, ScoreWeights.DEFAULT);

		double recomputed = scored.factors().stream()
				.mapToDouble(factor -> factor.score() * factor.weightPercent())
				.sum() / 100;
		assertThat(scored.recommendation()).isEqualTo((int) Math.round(recomputed));
	}
}
