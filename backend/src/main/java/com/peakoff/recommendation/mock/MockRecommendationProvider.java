package com.peakoff.recommendation.mock;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
import com.peakoff.recommendation.domain.WeightedPicker;

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
 *
 * <h2>⚠️ 뽑기는 실데이터와 <b>같은 규칙</b>이어야 한다</h2>
 * 여기는 오래도록 추천도 순으로 정렬해 위에서 잘랐다. 실데이터 쪽은 2026-08-26에
 * 그 정렬을 걷어냈는데(그것이 분산 장치를 죽이고 있었다) 목업만 옛 코드로 남아 있었다.
 *
 * <p>목업이 기본값이라({@code peakoff.kto.recommendation=mock}) <b>목업으로 시연하면
 * 분산이 아예 없는 화면을 보게 된다</b> — 같은 자리를 몇 번을 물어도 1등이 고정이다.
 * 두 공급자가 다른 규칙으로 답하면 "이 서비스는 대안을 어떻게 고르나요"에 답이 둘이 된다.
 */
@Component
@Profile(DataSourceProfiles.MOCK)
@ConditionalOnProperty(name = "peakoff.kto.recommendation", havingValue = "mock", matchIfMissing = true)
public class MockRecommendationProvider implements RecommendationProvider {

	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;
	private final WeightedPicker picker;

	public MockRecommendationProvider(CongestionProvider congestionProvider,
			RecommendationScorer scorer, WeightedPicker picker) {
		this.congestionProvider = congestionProvider;
		this.scorer = scorer;
		this.picker = picker;
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

		/*
		 * 상위 후보군에서 가중 무작위로 뽑는다. <b>뽑은 뒤 다시 정렬하지 않는다.</b>
		 *
		 * 예전에는 여기서 추천도 순으로 세우고 위에서 잘랐다. 그러면 최고점이 언제나 1등이라
		 * 같은 자리를 몇 번을 물어도 목록이 바뀌지 않는다 — 분산 장치가 있으나 마나가 된다.
		 * 실데이터 공급자가 2026-08-26에 걷어낸 그 코드다.
		 */
		List<Alternative> picked = drawWithoutRepeat(available, limit).stream()
				.map(scored -> scored.withReason(reasonFor(origin)))
				.toList();

		/*
		 * 목업은 연관 관광지 데이터가 없다. 지역 카탈로그에서 고르므로 출처는 지역이고,
		 * 근거 문구도 "함께 많이 찾는 곳"이라고 말하지 않는다.
		 */
		return Alternatives.of(originQuietness, considered.size(),
				qualified.size() - available.size(), picked);
	}

	/**
	 * 상위 후보군에서 가중 무작위로, <b>중복 없이</b> 뽑는다.
	 *
	 * <p>뽑은 것을 후보에서 빼고 다시 뽑는다. 빼지 않으면 같은 곳이 목록에 두 번 오른다 —
	 * 가중 무작위는 같은 후보를 다시 고를 수 있다.
	 *
	 * <p>실데이터 공급자와 같은 절차다({@code KtoRecommendationProvider}).
	 * 값도 한 곳에서 가져온다({@link WeightedPicker#DEFAULT_POOL_SIZE}).
	 */
	private List<ScoredPlace> drawWithoutRepeat(List<ScoredPlace> candidates, int limit) {
		List<ScoredPlace> remaining = new ArrayList<>(candidates);
		List<ScoredPlace> drawn = new ArrayList<>();

		while (drawn.size() < limit && !remaining.isEmpty()) {
			Optional<ScoredPlace> picked = picker.pick(remaining, ScoredPlace::recommendation,
					WeightedPicker.DEFAULT_BIAS, WeightedPicker.DEFAULT_POOL_SIZE);
			if (picked.isEmpty()) {
				break;
			}
			drawn.add(picked.get());
			remaining.remove(picked.get());
		}
		return drawn;
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
		return CandidateSource.REGIONAL_FALLBACK.noteFor(origin.name());
	}
}
