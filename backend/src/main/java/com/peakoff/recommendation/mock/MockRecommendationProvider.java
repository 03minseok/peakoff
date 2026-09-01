package com.peakoff.recommendation.mock;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.AlternativeStandard;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.CandidateSource;
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
@ConditionalOnProperty(name = "peakoff.kto.recommendation", havingValue = "mock", matchIfMissing = true)
public class MockRecommendationProvider implements RecommendationProvider {

	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;

	public MockRecommendationProvider(CongestionProvider congestionProvider, RecommendationScorer scorer) {
		this.congestionProvider = congestionProvider;
		this.scorer = scorer;
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

		// 원래 장소의 한적도를 모르면 "얼마나 나아지는가"를 잴 기준이 없다.
		if (!congestionProvider.hasData(origin.id(), date)) {
			return Alternatives.originNotForecasted();
		}
		int originQuietness = congestionProvider.quietnessOf(origin.id(), date);

		List<ScoredPlace> considered = GyeongjuMockCatalog.places().stream()
				.filter(candidate -> !candidate.id().equals(origin.id()))
				.filter(candidate -> sameCategory(candidate, origin))
				// 코스의 한 칸을 대신하기에 너무 멀면 점수를 매기기 전에 자른다.
				.filter(candidate -> AlternativeStandard.isWithinReach(
						Distances.betweenKm(origin, candidate)))
				.filter(candidate -> congestionProvider.hasData(candidate.id(), date))
				.map(candidate -> scorer.scoreAgainst(origin, candidate, date, ScoreWeights.DEFAULT))
				.toList();

		// 원래 장소보다 뚜렷하게 한적하지 않으면 대안이 아니다.
		// 하한이 없으면 더 붐비는 곳도 "대안"으로 나간다.
		List<ScoredPlace> qualified = considered.stream()
				.filter(scored -> AlternativeStandard.isWorthSuggesting(originQuietness, scored.quietness()))
				.toList();

		/*
		 * 이미 코스에 담긴 곳을 뺀다. <b>자격을 따진 뒤, 뽑기 앞이다.</b>
		 *
		 * 자격 심사보다 앞에 두면 "이미 담긴 후보"가 몇이었는지 알 수 없어져,
		 * 더 한적한 곳을 찾고도 "찾지 못했다"고 말하게 된다.
		 */
		List<ScoredPlace> available = qualified.stream()
				.filter(scored -> !skip.contains(scored.place().id()))
				.toList();

		List<Alternative> picked = available.stream()
				.map(scored -> scored.withReason(reasonFor(origin)))
				// 정렬 기준이 곧 화면에 보이는 추천도다. 화면에 없는 값으로 줄을 세우면
				// "왜 이게 1등인지"를 사용자에게도 심사에서도 설명할 수 없다.
				.sorted(Comparator.comparingInt(Alternative::recommendation).reversed())
				.limit(limit)
				.toList();

		/*
		 * 목업은 연관 관광지 데이터가 없다. 지역 카탈로그에서 고르므로 출처는 지역이고,
		 * 근거 문구도 "함께 많이 찾는 곳"이라고 말하지 않는다.
		 */
		return Alternatives.of(originQuietness, considered.size(),
				qualified.size() - available.size(), CandidateSource.REGIONAL_FALLBACK, picked);
	}

	private static boolean sameCategory(Place candidate, Place origin) {
		return PlaceCategories.compatible(origin.category(), candidate.category());
	}

	/**
	 * 예: "불국사 근처의 비슷한 분류 · 예상 혼잡 낮음"
	 *
	 * <p><b>계산한 것만 말한다.</b> "함께 많이 찾는 곳"은 연관 관광지 데이터가 있어야
	 * 할 수 있는 말이라 목업에서는 쓰지 않는다.
	 *
	 * <p>"같은 분류"가 아니라 "비슷한 분류"인 이유: 역사 유적 자리에 박물관이 올 수 있게
	 * 호환 범위를 넓혔다({@code PlaceCategories.compatible}). "같은"이라고 하면
	 * 화면에 뜬 분류명과 어긋난다.
	 *
	 * <p>장소 이름 뒤에 <b>조사를 붙이지 않는다.</b> "와/과"는 앞 글자의 받침에 따라 갈리는데
	 * 장소 이름이 무엇으로 끝날지 알 수 없다 — "경주엑스포대공원와"가 그래서 나왔다.
	 *
	 * <p>실데이터 공급자의 지역 후보 문구와 같은 말을 쓴다 — 같은 성격의 추천에
	 * 화면마다 다른 말이 붙으면 사용자가 규칙이 바뀐 줄 안다.
	 */
	private static String reasonFor(Place origin) {
		return "%s 근처의 비슷한 곳".formatted(origin.name());
	}
}
