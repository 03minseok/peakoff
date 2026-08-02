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
import com.peakoff.recommendation.domain.ScoreFactor;

/**
 * 목업 대안 추천 공급자.
 *
 * <p><b>추천도를 인기도로 계산하지 않는다.</b> 인기 있는 곳은 곧 붐비는 곳이므로,
 * 인기도를 가점으로 쓰면 오버투어리즘을 줄이겠다는 서비스 목적과 정면으로 어긋난다.
 *
 * <p>대신 <b>한적도가 추천도의 가장 큰 몫을 차지한다.</b> 한적한 곳으로 사람을 보내는 것이
 * 추천의 목적 자체라, 붐비는 곳을 "좋은 대안"이라 부를 수 없기 때문이다.
 *
 * <p>목업이 계산하는 항목은 두 가지다.
 * <ul>
 *   <li><b>한적도</b> — 집중률 예측에서 온다. 반영 비율이 가장 높다.</li>
 *   <li><b>동선 근접도</b> — 원래 장소에서 멀수록 깎인다.</li>
 * </ul>
 *
 * <p>아직 없는 항목이 둘 있다.
 * <ul>
 *   <li><b>연관성</b>("함께 많이 방문되는 곳") — 연관 관광지 데이터가 있어야 한다.
 *       실제 구현에서 이 자리에 들어가고, 그때 추천 근거 문구도 그 데이터로 뒷받침된다.</li>
 *   <li><b>카테고리 적합성</b> — 지금은 점수가 아니라 <b>필터</b>다. 같은 분류만 후보로 삼는다.
 *       신분류 코드의 계층(대·중·소)을 쓰면 "얼마나 비슷한 분류인가"를 점수로 바꿀 수 있다.</li>
 * </ul>
 */
@Component
@Profile(DataSourceProfiles.MOCK)
public class MockRecommendationProvider implements RecommendationProvider {

	/**
	 * 추천도 구성 비율(%). 모두 더해 100이 된다.
	 *
	 * <p><b>한적도를 가장 높게 두는 것이 규칙이다.</b> 이 순서가 뒤집히면 "덜 붐비는 곳으로
	 * 안내한다"는 서비스 정체성이 깨지고, 오버투어리즘 과제와도 어긋난다.
	 *
	 * <p><b>구체적인 값은 분석 검증 후 확정할 임시값이다.</b>
	 * 연관성 항목이 들어오면 셋으로 다시 나눈다(예: 한적도 50 · 연관성 30 · 근접도 20).
	 */
	private static final int QUIETNESS_WEIGHT = 70;
	private static final int PROXIMITY_WEIGHT = 30;

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
				// 정렬 기준이 곧 화면에 보이는 추천도다. 화면에 없는 값으로 줄을 세우면
				// "왜 이게 1등인지"를 사용자에게도 심사에서도 설명할 수 없다.
				.sorted(Comparator.comparingInt(Alternative::recommendation).reversed())
				.limit(limit)
				.toList();
	}

	private Alternative toAlternative(Place origin, Place candidate, LocalDate date) {
		int quietness = congestionProvider.quietnessOf(candidate.id(), date);
		CongestionLevel level = CongestionLevel.fromQuietness(quietness);

		double km = Distances.betweenKm(origin, candidate);
		int proximity = proximityScore(km);

		List<ScoreFactor> factors = List.of(
				new ScoreFactor("한적도", quietness, QUIETNESS_WEIGHT, level.congestionPhrase()),
				new ScoreFactor("동선 근접도", proximity, PROXIMITY_WEIGHT,
						"%s에서 직선거리 %.1fkm".formatted(origin.name(), km)));

		return new Alternative(
				candidate,
				quietness,
				weightedScore(factors),
				factors,
				reasonFor(origin, candidate, level));
	}

	private static boolean sameCategory(Place candidate, Place origin) {
		return candidate.category().code().equals(origin.category().code());
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
	 */
	private static int weightedScore(List<ScoreFactor> factors) {
		double sum = factors.stream()
				.mapToDouble(factor -> factor.score() * factor.weightPercent())
				.sum();
		return (int) Math.round(sum / 100);
	}

	/** 예: "불국사에서 가까운 같은 분류(사찰) · 예상 혼잡 낮음" */
	private static String reasonFor(Place origin, Place candidate, CongestionLevel level) {
		return "%s에서 가까운 같은 분류(%s) · %s".formatted(
				origin.name(), candidate.category().name(), level.congestionPhrase());
	}
}
