package com.peakoff.recommendation.mock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.congestion.mock.MockCongestionProvider;
import com.peakoff.place.domain.Place;
import com.peakoff.place.mock.GyeongjuMockCatalog;
import com.peakoff.recommendation.domain.Alternative;
import com.peakoff.recommendation.domain.AlternativeStandard;
import com.peakoff.recommendation.domain.Alternatives;
import com.peakoff.recommendation.domain.PlaceOffStatus;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoreFactor;
import com.peakoff.recommendation.domain.ScoreWeights;
import com.peakoff.recommendation.domain.WeightedPicker;

class MockRecommendationProviderTest {

	private static final MockCongestionProvider CONGESTION = new MockCongestionProvider();

	/**
	 * 씨앗을 고정한다. 뽑기가 <b>일부러 결과를 흔드는 장치</b>라, 고정하지 않으면
	 * 시험이 돌 때마다 다른 답을 보게 된다. 고정해도 호출마다 다른 값이 나오므로
	 * "여러 번 물으면 1등이 돌아간다"는 것은 그대로 확인할 수 있다.
	 */
	private final MockRecommendationProvider provider = new MockRecommendationProvider(
			CONGESTION, new RecommendationScorer(CONGESTION), new WeightedPicker(new Random(42)));

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

	/**
	 * 예전에는 "맨 위에 온다"로 물었다. 뽑기가 가중 무작위가 되면서 <b>첫 줄이 점수 1등이
	 * 아니게 됐다</b> — 그래서 첫 줄이 아니라 <b>모든 줄</b>에 물어야 한다.
	 *
	 * <p>물음이 약해진 것이 아니라 오히려 세졌다. 개선폭 하한이 목록 전체에 걸리는 보장이라,
	 * 어느 줄을 골라도 원래 자리보다 뚜렷하게 한적하다는 뜻이다.
	 */
	@Test
	@DisplayName("대안은 하나도 빠짐없이 원래 자리보다 뚜렷하게 한적하다")
	void everyAlternativeIsQuieterThanOrigin() {
		Place crowded = place("mock-hwangnidan");
		int crowdedQuietness = CONGESTION.quietnessOf(crowded.id(), WEDNESDAY);

		List<Alternative> alternatives = provider.findAlternatives(crowded, WEDNESDAY, 3, Set.of()).picked();

		assertThat(alternatives).isNotEmpty();
		assertThat(alternatives).allSatisfy(alternative -> assertThat(alternative.quietness())
				.isGreaterThanOrEqualTo(crowdedQuietness + AlternativeStandard.MIN_QUIETNESS_GAIN));
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

	/**
	 * ⚠️ <b>이 시험은 예전에 정반대를 물었다</b>("추천도가 높은 순으로 정렬된다").
	 *
	 * <p>점수로 다시 줄을 세우면 <b>최고점이 뽑히기만 하면 언제나 1등</b>이 되어, 가중 무작위가
	 * 정한 순서가 통째로 덮인다. 실데이터 공급자에서 2026-08-26에 확인된 고장이고
	 * (자격 후보가 20곳인 자리에서도 1등이 68~82% 고정) 목업에는 그 코드가 남아 있었다.
	 *
	 * <p>같은 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 된다 —
	 * 붐빔을 피하라는 서비스가 직접 2차 오버투어리즘을 만드는 셈이다.
	 *
	 * <p>목업이 기본값이라({@code peakoff.kto.recommendation=mock}) 여기가 고정되면
	 * <b>시연 화면에서 분산이 없는 서비스를 보여주게 된다.</b>
	 */
	@Test
	@DisplayName("같은 자리를 여러 번 물으면 1등이 돌아간다 — 점수순으로 고정되지 않는다")
	void spreadsPicksAcrossCalls() {
		Place origin = place("mock-bulguksa");

		Set<String> leaders = IntStream.range(0, 40)
				.mapToObj(i -> provider.findAlternatives(origin, WEDNESDAY, 3, Set.of()).picked())
				.filter(picked -> !picked.isEmpty())
				.map(picked -> picked.get(0).place().id())
				.collect(Collectors.toSet());

		// Pool이 셋이라 1등도 그 안에서 돈다. 하나로 굳으면 분산 장치가 죽은 것이다.
		assertThat(leaders).hasSizeGreaterThan(1);
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

	/**
	 * 예전에는 <b>목록의 첫 줄</b>로 이것을 물었다("첫 후보의 한적도가 평균 이상이다").
	 * 뽑기가 가중 무작위가 되면서 그 물음이 성립하지 않는다 — 첫 줄은 점수 1등이 아니다.
	 *
	 * <p>그래서 <b>순서가 아니라 규칙에 직접</b> 묻는다. 이쪽이 원래 물으려던 것에 더 가깝다:
	 * 근접도가 한적도를 넘어서면 "가깝기만 하면 붐벼도 좋다"가 되어 과제와 정면으로 어긋나는데,
	 * 그 규칙은 {@link ScoreWeights} 생성자가 강제하므로 <b>어기는 값은 아예 만들어지지 않는다.</b>
	 *
	 * <p>설문의 "유명한 곳 위주"조차 이 선은 넘지 못한다.
	 */
	@Test
	@DisplayName("한적도의 반영 비율이 근접도보다 높다 — 어기는 값은 만들 수조차 없다")
	void weighsQuietnessOverProximity() {
		assertThat(ScoreWeights.DEFAULT.quietness())
				.isGreaterThan(ScoreWeights.DEFAULT.proximity());

		assertThatThrownBy(() -> new ScoreWeights(30, 70))
				.isInstanceOf(IllegalArgumentException.class);
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
