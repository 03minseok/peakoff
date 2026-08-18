package com.peakoff.course.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.mock.MockCongestionProvider;
import com.peakoff.course.domain.CourseDraft;
import com.peakoff.course.domain.CourseDraft.DraftedSlot;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.course.domain.survey.CrowdSensitivity;
import com.peakoff.course.domain.survey.ItineraryDensity;
import com.peakoff.course.domain.survey.SurveyAnswers;
import com.peakoff.course.domain.survey.Transport;
import com.peakoff.course.domain.survey.TravelStyle;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.mock.MockPlaceProvider;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoreFactor;
import com.peakoff.recommendation.domain.WeightedPicker;

class CourseDraftServiceTest {

	private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 16);

	private final MockCongestionProvider congestion = new MockCongestionProvider();

	/** 씨앗을 고정한다. 분산은 일부러 결과를 흔드는 장치라, 고정하지 않으면 규칙을 검증할 수 없다. */
	private final CourseDraftService service = newService(new Random(42));

	private CourseDraftService newService(Random random) {
		return new CourseDraftService(
				new MockPlaceProvider(),
				congestion,
				new RecommendationScorer(congestion),
				new WeightedPicker(random),
				random);
	}

	private CourseDraft draft(int nights, SurveyAnswers answers) {
		return service.draft(SupportedRegion.GYEONGJU, WEDNESDAY, nights, answers);
	}

	private static SurveyAnswers answers(
			List<TravelStyle> styles, ItineraryDensity density,
			CrowdSensitivity sensitivity, Transport transport) {
		return new SurveyAnswers(styles, density, sensitivity, transport);
	}

	private static SurveyAnswers everyStyle(
			ItineraryDensity density, CrowdSensitivity sensitivity, Transport transport) {
		return answers(List.of(TravelStyle.values()), density, sensitivity, transport);
	}

	@Test
	@DisplayName("같은 장소가 코스에 두 번 들어가지 않는다")
	void neverRepeatsAPlace() {
		CourseDraft draft = draft(2, everyStyle(ItineraryDensity.PACKED, CrowdSensitivity.MIXED, Transport.CAR));

		List<String> placeIds = draft.slots().stream()
				.map(slot -> slot.slot().place().id())
				.toList();

		assertThat(placeIds).doesNotHaveDuplicates();
	}

	@Test
	@DisplayName("고른 스타일에 없는 분류는 코스에 오르지 않는다 — 숙박도 여기서 빠진다")
	void honoursSelectedStyles() {
		CourseDraft draft = draft(1, answers(
				List.of(TravelStyle.HISTORY), ItineraryDensity.BALANCED,
				CrowdSensitivity.MIXED, Transport.CAR));

		assertThat(draft.slots()).allSatisfy(slot ->
				assertThat(TravelStyle.HISTORY.matches(slot.slot().place().category())).isTrue());
	}

	@Test
	@DisplayName("대중교통을 고르면 슬롯 간 이동거리가 제한을 넘지 않는다")
	void respectsTransitHopLimit() {
		CourseDraft draft = draft(2, everyStyle(
				ItineraryDensity.PACKED, CrowdSensitivity.MIXED, Transport.TRANSIT));

		for (int day = 1; day <= draft.course().days(); day++) {
			List<CourseSlot> slots = draft.course().slotsOfDay(day);
			for (int i = 1; i < slots.size(); i++) {
				double km = Distances.betweenKm(slots.get(i - 1).place(), slots.get(i).place());
				assertThat(km)
						.as("%d일차 %d→%d번째 이동".formatted(day, i, i + 1))
						.isLessThanOrEqualTo(Transport.TRANSIT.maxHopKm());
			}
		}
	}

	/**
	 * 이동거리만 막으면 짧은 이동이 이어져 하루 동안 한 방향으로 계속 밀려날 수 있다.
	 * 5km씩 네 번이면 20km다.
	 */
	@Test
	@DisplayName("하루 동선이 그 날 첫 장소의 반경 안에 머문다")
	void staysWithinDayRadius() {
		CourseDraft draft = draft(2, everyStyle(
				ItineraryDensity.PACKED, CrowdSensitivity.MIXED, Transport.TRANSIT));

		for (int day = 1; day <= draft.course().days(); day++) {
			List<CourseSlot> slots = draft.course().slotsOfDay(day);
			if (slots.isEmpty()) {
				continue;
			}
			CourseSlot first = slots.get(0);
			assertThat(slots).allSatisfy(slot -> assertThat(
					Distances.betweenKm(first.place(), slot.place()))
					.isLessThanOrEqualTo(Transport.TRANSIT.dayRadiusKm()));
		}
	}

	@Test
	@DisplayName("일자별 슬롯 수가 밀도가 정한 범위를 넘지 않는다")
	void respectsDensityRange() {
		ItineraryDensity density = ItineraryDensity.RELAXED;
		CourseDraft draft = draft(2, everyStyle(density, CrowdSensitivity.MIXED, Transport.CAR));

		for (int day = 1; day <= draft.course().days(); day++) {
			assertThat(draft.course().slotsOfDay(day).size())
					.as(day + "일차 슬롯 수")
					.isLessThanOrEqualTo(density.maxSlotsPerDay());
		}
	}

	@Test
	@DisplayName("'한적한 곳 위주'를 고르면 붐빌 것으로 예측되는 곳이 코스에 없다")
	void quietAnswerExcludesCrowdedPlaces() {
		CourseDraft draft = draft(2, everyStyle(
				ItineraryDensity.PACKED, CrowdSensitivity.QUIET, Transport.CAR));

		assertThat(draft.slots()).allSatisfy(slot ->
				assertThat(CongestionLevel.fromQuietness(slot.slot().quietness()))
						.as(slot.slot().place().name())
						.isNotEqualTo(CongestionLevel.CROWDED));
	}

	/**
	 * 근거 없는 추천을 만들지 않는다는 원칙이 화면이 아니라 데이터에서 지켜지는지 본다.
	 * 데이터 활용 점수를 화면에서 증명하는 장치가 이 항목들이다.
	 */
	@Test
	@DisplayName("모든 슬롯에 근거 문구와 추천도 구성 내역이 붙는다")
	void everySlotCarriesItsReason() {
		CourseDraft draft = draft(1, everyStyle(
				ItineraryDensity.BALANCED, CrowdSensitivity.MIXED, Transport.CAR));

		assertThat(draft.slots()).allSatisfy(slot -> {
			assertThat(slot.reason()).isNotBlank();
			// 예측·통계값이므로 "실시간"이라고 말하지 않는다.
			assertThat(slot.reason()).doesNotContain("실시간");
			assertThat(slot.factors()).isNotEmpty();

			// 화면에 보이는 항목으로 계산한 값이 곧 추천도여야 한다.
			int expected = (int) Math.round(slot.factors().stream()
					.mapToDouble(factor -> factor.score() * factor.weightPercent())
					.sum() / 100);
			assertThat(slot.recommendation()).isEqualTo(expected);
		});
	}

	/**
	 * 없는 항목을 0점으로 채워 넣으면 화면에 "동선 근접도 0"이 찍혀,
	 * 계산하지 않은 것을 계산한 것처럼 말하게 된다.
	 */
	@Test
	@DisplayName("그 날 첫 장소는 비교 대상이 없어 한적도 항목만 갖는다")
	void firstSlotOfDayIsScoredByQuietnessAlone() {
		CourseDraft draft = draft(1, everyStyle(
				ItineraryDensity.BALANCED, CrowdSensitivity.MIXED, Transport.CAR));

		DraftedSlot first = draft.slots().get(0);

		assertThat(first.slot().order()).isEqualTo(1);
		assertThat(first.factors()).hasSize(1);
		assertThat(first.factors().get(0).label()).isEqualTo("한적도");
		assertThat(first.factors().get(0).weightPercent()).isEqualTo(100);
	}

	@Test
	@DisplayName("코스 총점은 슬롯 한적도의 평균이다 — 추천도가 섞이지 않는다")
	void totalIsAverageOfSlotQuietness() {
		CourseDraft draft = draft(1, everyStyle(
				ItineraryDensity.BALANCED, CrowdSensitivity.MIXED, Transport.CAR));

		int expected = (int) Math.round(draft.course().slots().stream()
				.mapToInt(CourseSlot::quietness)
				.average()
				.orElseThrow());

		assertThat(draft.course().totalQuietness()).isEqualTo(expected);
	}

	/**
	 * 같은 대안이 모든 사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 된다 — 2차 오버투어리즘.
	 */
	@Test
	@DisplayName("같은 설문 답이라도 매번 같은 코스가 나오지는 않는다")
	void spreadsAcrossUsers() {
		SurveyAnswers answers = everyStyle(
				ItineraryDensity.BALANCED, CrowdSensitivity.MIXED, Transport.CAR);
		CourseDraftService spreading = newService(new Random(7));

		Set<String> shapes = IntStream.range(0, 20)
				.mapToObj(i -> spreading.draft(SupportedRegion.GYEONGJU, WEDNESDAY, 1, answers))
				.map(draft -> draft.slots().stream()
						.map(slot -> slot.slot().place().id())
						.collect(Collectors.joining(",")))
				.collect(Collectors.toSet());

		assertThat(shapes).hasSizeGreaterThan(1);
	}

	@Test
	@DisplayName("'유명한 곳 위주'를 고르면 대표 명소도 코스에 오른다")
	void popularAnswerCanSurfaceFamousPlaces() {
		SurveyAnswers answers = everyStyle(
				ItineraryDensity.PACKED, CrowdSensitivity.POPULAR, Transport.CAR);
		CourseDraftService spreading = newService(new Random(7));

		Set<String> seen = IntStream.range(0, 30)
				.mapToObj(i -> spreading.draft(SupportedRegion.GYEONGJU, WEDNESDAY, 1, answers))
				.flatMap(draft -> draft.slots().stream())
				.map(slot -> slot.slot().place().id())
				.collect(Collectors.toSet());

		// 붐빌 것으로 예측되는 대표 명소들. 하나도 안 나오면 이 답을 고를 이유가 없다.
		assertThat(seen).containsAnyOf(
				"mock-bulguksa", "mock-daereungwon", "mock-cheomseongdae", "mock-hwangnidan");
	}

	@Test
	@DisplayName("추천도 구성 항목의 반영 비율은 설문의 혼잡 민감도를 따른다")
	void factorWeightsFollowSensitivity() {
		CourseDraft draft = draft(1, everyStyle(
				ItineraryDensity.PACKED, CrowdSensitivity.QUIET, Transport.CAR));

		// 첫 장소를 뺀 슬롯들은 한적도 + 근접도 두 항목을 갖는다.
		List<DraftedSlot> withAnchor = draft.slots().stream()
				.filter(slot -> slot.factors().size() > 1)
				.toList();

		assertThat(withAnchor).isNotEmpty();
		assertThat(withAnchor).allSatisfy(slot -> {
			ScoreFactor quietness = slot.factors().stream()
					.filter(factor -> factor.label().equals("한적도"))
					.findFirst()
					.orElseThrow();

			assertThat(quietness.weightPercent())
					.isEqualTo(CrowdSensitivity.QUIET.weights().quietness());
		});
	}
}
