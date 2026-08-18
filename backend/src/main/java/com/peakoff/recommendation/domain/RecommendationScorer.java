package com.peakoff.recommendation.domain;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;

/**
 * 추천도를 계산하는 유일한 곳.
 *
 * <p>이 클래스가 따로 있는 이유는 <b>추천도를 쓰는 화면이 둘이 됐기 때문이다.</b>
 * 장소 교체 추천과 설문 기반 코스 생성이 같은 점수를 쓴다. 각자 계산식을 들고 있으면
 * 분석 결과로 가중치가 바뀔 때 한쪽만 고쳐지고, 화면마다 다른 점수가 나온다.
 * 그건 사실상 <b>셋째 점수를 만드는 것</b>과 같다.
 *
 * <p>계산하는 항목은 지금 둘이다.
 * <ul>
 *   <li><b>한적도</b> — 집중률 예측에서 온다. 반영 비율이 가장 높다.</li>
 *   <li><b>동선 근접도</b> — 기준 장소에서 멀수록 깎인다.</li>
 * </ul>
 *
 * <p>아직 없는 항목이 둘 있다.
 * <ul>
 *   <li><b>연관성</b>("함께 많이 방문되는 곳") — 연관 관광지 데이터가 있어야 한다.
 *       그때 {@link ScoreWeights}에 필드가 하나 늘고 여기에 항목이 하나 늘어난다.</li>
 *   <li><b>카테고리 적합성</b> — 지금은 점수가 아니라 후보를 고르는 쪽의 <b>필터</b>다.</li>
 * </ul>
 *
 * <p><b>후보를 어디서 가져올지는 이 클래스가 정하지 않는다.</b> 교체 추천은 연관 관광지 목록에서,
 * 설문 생성은 스타일에 맞는 장소에서 후보를 고른다. 여기는 "주어진 후보가 몇 점인가"만 답한다.
 */
@Component
public class RecommendationScorer {

	/**
	 * 1km 멀어질 때마다 깎는 근접도 점수. 20km를 넘으면 근접도는 0이 된다.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b> 경주 시내(반경 2km)와 외곽(감포항 30km)이
	 * 화면에서 구분되는 수준으로 잡았다.
	 */
	private static final double PENALTY_PER_KM = 5.0;

	private final CongestionProvider congestionProvider;

	public RecommendationScorer(CongestionProvider congestionProvider) {
		this.congestionProvider = congestionProvider;
	}

	/**
	 * 비교 대상이 없는 자리의 점수. <b>한적도가 전부다.</b>
	 *
	 * <p>코스의 첫 장소처럼 앞에 놓인 것이 없으면 "무엇에 가까운가"를 잴 수 없다.
	 * 없는 항목을 0점으로 채워 넣으면 화면에 "동선 근접도 0"이 찍혀, 계산하지 않은 것을
	 * 계산한 것처럼 말하게 된다. 그래서 항목 자체를 만들지 않는다.
	 */
	public ScoredPlace scoreAlone(Place candidate, LocalDate date) {
		int quietness = congestionProvider.quietnessOf(candidate.id(), date);
		CongestionLevel level = CongestionLevel.fromQuietness(quietness);

		List<ScoreFactor> factors = List.of(quietnessFactor(quietness, level, ScoreWeights.QUIETNESS_ONLY));

		return new ScoredPlace(candidate, quietness, level, weightedScore(factors), factors);
	}

	/**
	 * 기준 장소를 놓고 매기는 점수. 한적도 + 동선 근접도.
	 *
	 * @param anchor    기준 장소. 교체 추천에서는 "원래 가려던 곳",
	 *                  코스 생성에서는 "직전에 배치된 장소"다
	 * @param candidate 점수를 매길 후보
	 * @param date      방문 예정일. 같은 후보라도 날짜에 따라 한적도가 다르다
	 * @param weights   항목별 반영 비율. 설문의 혼잡 민감도가 이 값을 바꾼다
	 */
	public ScoredPlace scoreAgainst(Place anchor, Place candidate, LocalDate date, ScoreWeights weights) {
		int quietness = congestionProvider.quietnessOf(candidate.id(), date);
		CongestionLevel level = CongestionLevel.fromQuietness(quietness);

		double km = Distances.betweenKm(anchor, candidate);

		List<ScoreFactor> factors = List.of(
				quietnessFactor(quietness, level, weights),
				new ScoreFactor("동선 근접도", proximityScore(km), weights.proximity(),
						"%s에서 직선거리 %.1fkm".formatted(anchor.name(), km)));

		return new ScoredPlace(candidate, quietness, level, weightedScore(factors), factors);
	}

	private static ScoreFactor quietnessFactor(int quietness, CongestionLevel level, ScoreWeights weights) {
		return new ScoreFactor("한적도", quietness, weights.quietness(), level.congestionPhrase());
	}

	/** 동선 근접도. 가까울수록 높다. */
	private static int proximityScore(double km) {
		double score = Scores.MAX - km * PENALTY_PER_KM;
		return (int) Math.round(Math.clamp(score, Scores.MIN, Scores.MAX));
	}

	/**
	 * 항목별 점수를 반영 비율대로 합쳐 추천도를 만든다.
	 *
	 * <p>화면에 내려보내는 항목 목록을 그대로 써서 계산한다. 계산과 표시가 같은 값을 보므로,
	 * "화면에 적힌 근거"와 "실제 점수"가 어긋날 수 없다.
	 *
	 * <p>비율의 합이 100이라는 것은 {@link ScoreWeights} 생성자가 이미 보장한다.
	 */
	private static int weightedScore(List<ScoreFactor> factors) {
		double sum = factors.stream()
				.mapToDouble(factor -> factor.score() * factor.weightPercent())
				.sum();
		return (int) Math.round(sum / 100);
	}
}
