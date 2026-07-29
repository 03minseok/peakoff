package com.peakoff.recommendation.mock;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.RecommendationProvider;

/**
 * 목업 대안 추천 공급자.
 *
 * <p><b>추천도를 인기도로 계산하지 않는다.</b> 인기 있는 곳은 곧 붐비는 곳이므로,
 * 인기도를 가점으로 쓰면 오버투어리즘을 줄이겠다는 서비스 목적과 정면으로 어긋난다.
 *
 * <p>목업이 실제로 계산하는 추천도 항목은 두 가지다.
 * <ul>
 *   <li><b>카테고리 적합성</b> — 같은 분류끼리만 후보로 삼는다. 음식점 자리에 숙박을 넣지 않는다.</li>
 *   <li><b>동선 근접도</b> — 원래 장소에서 멀수록 점수가 깎인다.</li>
 * </ul>
 *
 * <p>남은 항목인 <b>연관성</b>("함께 많이 방문되는 곳")은 연관 관광지 데이터가 있어야 계산할 수 있다.
 * 목업에서는 같은 분류·가까운 거리로 대신했고, 실제 구현에서 이 자리에 연관성 점수가 들어간다.
 */
@Component
@Profile(DataSourceProfiles.MOCK)
public class MockRecommendationProvider implements RecommendationProvider {

	/**
	 * 정렬용 총점 가중치. 한적도 쪽을 더 높게 두어야 서비스 정체성이 유지된다.
	 * <b>구체적인 값은 분석 검증 후 확정할 임시값이다.</b>
	 */
	private static final double QUIETNESS_WEIGHT = 0.7;
	private static final double RECOMMENDATION_WEIGHT = 0.3;

	/** 1km 멀어질 때마다 깎는 점수. 20km를 넘으면 근접도 점수는 0이 된다. */
	private static final double PENALTY_PER_KM = 5.0;

	private final CongestionProvider congestionProvider;

	public MockRecommendationProvider(CongestionProvider congestionProvider) {
		this.congestionProvider = congestionProvider;
	}

	@Override
	public List<Alternative> findAlternatives(Place origin, LocalDate date, int limit) {
		if (origin == null || date == null) {
			throw new IllegalArgumentException("원래 장소와 날짜는 필수입니다.");
		}
		if (limit < 1) {
			throw new IllegalArgumentException("후보 수는 1 이상이어야 합니다. 입력값: " + limit);
		}

		return GyeongjuMockCatalog.places().stream()
				.filter(candidate -> !candidate.id().equals(origin.id()))
				.filter(candidate -> sameCategory(candidate, origin))
				.filter(candidate -> congestionProvider.hasData(candidate.id()))
				.map(candidate -> toAlternative(origin, candidate, date))
				.sorted(Comparator.comparingDouble(MockRecommendationProvider::totalScore).reversed())
				.limit(limit)
				.toList();
	}

	private Alternative toAlternative(Place origin, Place candidate, LocalDate date) {
		int quietness = congestionProvider.quietnessOf(candidate.id(), date);
		int recommendation = proximityScore(origin, candidate);
		return new Alternative(candidate, quietness, recommendation, reasonFor(origin, quietness));
	}

	private static boolean sameCategory(Place candidate, Place origin) {
		return candidate.category().code().equals(origin.category().code());
	}

	/** 동선 근접도. 가까울수록 높다. */
	private static int proximityScore(Place origin, Place candidate) {
		double km = Distances.betweenKm(origin, candidate);
		double score = Scores.MAX - km * PENALTY_PER_KM;
		return (int) Math.round(Math.clamp(score, Scores.MIN, Scores.MAX));
	}

	/**
	 * 정렬 기준. 한적도에 더 큰 가중치를 둔다.
	 *
	 * <p>그래서 조금 멀더라도 훨씬 한적한 곳이 위로 올라온다. 이것이 이 서비스가
	 * 일반 여행 추천과 다른 지점이다.
	 */
	private static double totalScore(Alternative alternative) {
		return alternative.quietness() * QUIETNESS_WEIGHT
				+ alternative.recommendation() * RECOMMENDATION_WEIGHT;
	}

	/** 예: "불국사 방문객이 함께 많이 찾는 곳 · 예상 혼잡 낮음" */
	private static String reasonFor(Place origin, int quietness) {
		String phrase = CongestionLevel.fromQuietness(quietness).congestionPhrase();
		return "%s 방문객이 함께 많이 찾는 곳 · %s".formatted(origin.name(), phrase);
	}
}
