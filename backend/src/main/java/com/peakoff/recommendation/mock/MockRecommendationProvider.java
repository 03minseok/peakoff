package com.peakoff.recommendation.mock;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.place.domain.Place;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.RecommendationProvider;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoreWeights;
import com.peakoff.recommendation.domain.ScoredPlace;

/**
 * 목업 대안 추천 공급자.
 *
 * <p>이 클래스가 하는 일은 <b>후보를 고르는 것</b>이다. 점수 계산은
 * {@link RecommendationScorer}가 맡는다 — 설문 기반 코스 생성도 같은 점수를 쓰기 때문에,
 * 계산식이 여기 있으면 가중치 표가 두 벌이 된다.
 *
 * <p>후보를 고르는 규칙은 셋이다.
 * <ul>
 *   <li>자기 자신은 뺀다.</li>
 *   <li><b>같은 분류만 남긴다.</b> 음식점 자리에 숙박을 넣지 않기 위해서다.
 *       카테고리 적합성이 지금은 점수가 아니라 필터인 셈인데, 신분류 코드의 계층(대·중·소)이
 *       붙으면 "얼마나 비슷한 분류인가"를 점수로 바꿀 수 있다.</li>
 *   <li>혼잡 예측 데이터가 있는 곳만 남긴다. 없는 것을 0점으로 뭉개면 "매우 붐빔"으로 잘못 읽힌다.</li>
 * </ul>
 *
 * <p>실제 구현에서는 이 자리에 <b>연관 관광지 API</b>가 들어간다. "함께 많이 방문되는 곳"이
 * 후보의 출발점이 되고, 그때 추천 근거 문구도 그 데이터로 뒷받침된다.
 */
@Component
@Profile(DataSourceProfiles.MOCK)
public class MockRecommendationProvider implements RecommendationProvider {

	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;

	public MockRecommendationProvider(CongestionProvider congestionProvider, RecommendationScorer scorer) {
		this.congestionProvider = congestionProvider;
		this.scorer = scorer;
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
				.map(candidate -> scorer.scoreAgainst(origin, candidate, date, ScoreWeights.DEFAULT))
				.map(scored -> scored.withReason(reasonFor(origin, scored)))
				// 정렬 기준이 곧 화면에 보이는 추천도다. 화면에 없는 값으로 줄을 세우면
				// "왜 이게 1등인지"를 사용자에게도 심사에서도 설명할 수 없다.
				.sorted(Comparator.comparingInt(Alternative::recommendation).reversed())
				.limit(limit)
				.toList();
	}

	private static boolean sameCategory(Place candidate, Place origin) {
		return candidate.category().code().equals(origin.category().code());
	}

	/**
	 * 예: "불국사에서 가까운 같은 분류(관광지) · 예상 혼잡 낮음"
	 *
	 * <p><b>계산한 것만 말한다.</b> "함께 많이 찾는 곳"은 연관 관광지 데이터가 있어야
	 * 할 수 있는 말이라 지금은 쓰지 않는다.
	 */
	private static String reasonFor(Place origin, ScoredPlace scored) {
		return "%s에서 가까운 같은 분류(%s) · %s".formatted(
				origin.name(), scored.place().category().name(), scored.level().congestionPhrase());
	}
}
