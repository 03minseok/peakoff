package com.peakoff.recommendation.mock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.congestion.mock.MockCongestionProvider;
import com.peakoff.place.domain.Place;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.PlaceOffStatus;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoreFactor;

class MockRecommendationProviderTest {

	private static final MockCongestionProvider CONGESTION = new MockCongestionProvider();

	private final MockRecommendationProvider provider =
			new MockRecommendationProvider(CONGESTION, new RecommendationScorer(CONGESTION));

	private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 16);

	private static Place place(String id) {
		return GyeongjuMockCatalog.findById(id).place();
	}

	@Test
	@DisplayName("후보에는 자기 자신이 들어가지 않는다")
	void excludesOrigin() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 5, Set.of()).picked();

		assertThat(alternatives).extracting(a -> a.place().id()).doesNotContain("mock-bulguksa");
	}

	@Test
	@DisplayName("같은 분류끼리만 추천한다 — 음식점 자리에 숙박을 넣지 않는다")
	void keepsCategoryConsistent() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-gyorigimbap"), WEDNESDAY, 5, Set.of()).picked();

		assertThat(alternatives).isNotEmpty();
		assertThat(alternatives)
				.allSatisfy(a -> assertThat(a.place().category().name()).isEqualTo("음식점"));
	}

	@Test
	@DisplayName("붐비는 곳을 물으면 더 한적한 대안이 맨 위에 온다")
	void surfacesQuieterAlternativeFirst() {
		Place crowded = place("mock-hwangnidan");
		int crowdedQuietness = new MockCongestionProvider().quietnessOf(crowded.id(), WEDNESDAY);

		List<Alternative> alternatives = provider.findAlternatives(crowded, WEDNESDAY, 3, Set.of()).picked();

		assertThat(alternatives).isNotEmpty();
		assertThat(alternatives.get(0).quietness()).isGreaterThan(crowdedQuietness);
	}

	@Test
	@DisplayName("추천 근거 문구는 실제로 계산한 것만 말한다")
	void buildsReasonPhrase() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 1, Set.of()).picked();

		// "함께 많이 찾는 곳"은 연관 관광지 데이터가 있어야 할 수 있는 말이다.
		// 목업은 같은 분류·가까운 거리로 뽑으므로 그렇게만 말한다.
		assertThat(alternatives.get(0).reason()).isEqualTo("불국사 근처의 비슷한 곳 중에서 골랐어요.");

		/*
		 * 혼잡 문구는 이 문장에 붙지 않는다. 화면에서 바로 윗줄에 한적도 배지가 이미 서 있어
		 * 같은 사실을 숫자로 한 번, 말로 한 번 말하는 꼴이었다.
		 * 한적도는 여전히 항목(ScoreFactor)의 근거로 남아 있다.
		 */
		assertThat(alternatives.get(0).reason()).doesNotContain("예상 혼잡");
	}

	@Test
	@DisplayName("추천도는 항목별 내역과 함께 오고, 한적도의 반영 비율이 가장 높다")
	void explainsRecommendationWithQuietnessWeighedMost() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 5, Set.of()).picked();

		assertThat(alternatives).allSatisfy(alternative -> {
			List<ScoreFactor> factors = alternative.factors();
			assertThat(factors).isNotEmpty();

			// 비율의 합이 100이 아니면 추천도가 0~100 척도를 벗어난다.
			assertThat(factors.stream().mapToInt(ScoreFactor::weightPercent).sum()).isEqualTo(100);

			/*
			 * 이 서비스의 정체성이 걸린 규칙이다. 한적도보다 다른 항목의 비율이 높아지면
			 * 붐비는 곳을 "좋은 대안"으로 밀게 되어 오버투어리즘 과제와 어긋난다.
			 */
			ScoreFactor quietness = factors.stream()
					.filter(factor -> factor.label().equals("한적도"))
					.findFirst()
					.orElseThrow();
			assertThat(factors).allSatisfy(factor ->
					assertThat(factor.weightPercent()).isLessThanOrEqualTo(quietness.weightPercent()));

			// 화면에 보이는 항목으로 계산한 값이 곧 추천도여야 한다.
			int expected = (int) Math.round(factors.stream()
					.mapToDouble(factor -> factor.score() * factor.weightPercent())
					.sum() / 100);
			assertThat(alternative.recommendation()).isEqualTo(expected);
		});
	}

	@Test
	@DisplayName("추천도가 높은 순으로 정렬된다 — 정렬 기준이 곧 화면에 보이는 값이다")
	void sortsByRecommendation() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 10, Set.of()).picked();

		assertThat(alternatives).isSortedAccordingTo(
				Comparator.comparingInt(Alternative::recommendation).reversed());
	}

	@Test
	@DisplayName("근거 문구는 '실시간'이 아니라 '예상'으로 표현한다")
	void neverClaimsRealtime() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 5, Set.of()).picked();

		assertThat(alternatives).allSatisfy(a -> assertThat(a.reason()).doesNotContain("실시간"));
	}

	@Test
	@DisplayName("요청한 개수만큼만 돌려준다")
	void respectsLimit() {
		assertThat(provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 2, Set.of()).picked()).hasSize(2);
	}

	@Test
	@DisplayName("한적도 가중치가 더 높아, 조금 멀어도 훨씬 한적한 곳이 위로 올라온다")
	void weighsQuietnessOverProximity() {
		List<Alternative> alternatives = provider.findAlternatives(place("mock-cheomseongdae"), WEDNESDAY, 10, Set.of()).picked();

		// 정렬이 근접도만 따랐다면 첫 후보가 가장 가까운 곳이어야 한다.
		// 한적도 가중치가 더 크므로, 첫 후보의 한적도는 평균 이상이어야 한다.
		double averageQuietness = alternatives.stream().mapToInt(Alternative::quietness).average().orElseThrow();

		assertThat(alternatives.get(0).quietness()).isGreaterThan((int) averageQuietness);
	}

	/**
	 * 이미 코스에 담긴 곳은 고를 수 없다. 뽑아 봐야 Pool 자리만 차지하고 화면에서 걸러진다.
	 *
	 * <p>거르기가 <b>뽑기 앞</b>에 있어야 하는 이유이기도 하다. 뽑은 뒤에 빼면
	 * 자격 있는 후보가 남아 있는데도 목록이 그만큼 짧아진다.
	 */
	@Test
	@DisplayName("이미 코스에 담긴 장소는 후보에서 빠진다")
	void excludesPlacesAlreadyInCourse() {
		Place origin = place("mock-bulguksa");
		List<Alternative> all = provider.findAlternatives(origin, WEDNESDAY, 5, Set.of()).picked();
		assertThat(all).isNotEmpty();

		String taken = all.get(0).place().id();
		List<Alternative> without =
				provider.findAlternatives(origin, WEDNESDAY, 5, Set.of(taken)).picked();

		assertThat(without).extracting(a -> a.place().id()).doesNotContain(taken);
	}

	/**
	 * 자격을 갖춘 후보를 전부 코스에 담아 둔 경우.
	 *
	 * <p>"더 나은 곳이 없다"고 말하면 <b>거짓말</b>이다 — 우리는 찾았고 사용자가 갖고 있다.
	 * 그렇게 말하면 사용자는 자기 코스가 최선이라고 잘못 결론짓거나 우리가 못 찾았다고 오해한다.
	 */
	@Test
	@DisplayName("더 한적한 곳을 전부 코스에 담았으면 그렇다고 말한다")
	void saysSoWhenEveryCandidateIsAlreadyInCourse() {
		Place origin = place("mock-bulguksa");
		Alternatives all = provider.findAlternatives(origin, WEDNESDAY, 20, Set.of());
		assertThat(all.picked()).isNotEmpty();

		Set<String> everything = all.picked().stream()
				.map(a -> a.place().id())
				.collect(java.util.stream.Collectors.toSet());
		Alternatives none = provider.findAlternatives(origin, WEDNESDAY, 20, everything);

		assertThat(none.picked()).isEmpty();
		assertThat(none.status()).isEqualTo(PlaceOffStatus.ALL_CANDIDATES_IN_COURSE);
	}

	@Test
	@DisplayName("제외 목록을 주지 않아도 동작한다")
	void toleratesMissingExclusions() {
		assertThat(provider.findAlternatives(place("mock-bulguksa"), WEDNESDAY, 5, null).picked())
				.isNotEmpty();
	}

	@Test
	@DisplayName("잘못된 인자는 즉시 거부한다")
	void rejectsInvalidArguments() {
		Place origin = place("mock-bulguksa");

		assertThatThrownBy(() -> provider.findAlternatives(origin, WEDNESDAY, 0, Set.of()))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> provider.findAlternatives(null, WEDNESDAY, 3, Set.of()))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
