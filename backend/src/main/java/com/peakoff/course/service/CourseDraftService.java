package com.peakoff.course.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.random.RandomGenerator;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.course.domain.CourseDraft;
import com.peakoff.course.domain.CourseDraft.DraftedSlot;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.course.domain.survey.SurveyAnswers;
import com.peakoff.course.domain.survey.TravelStyle;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.RecommendationScorer;
import com.peakoff.recommendation.domain.ScoredPlace;
import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * 설문 답으로 코스 초안을 만든다.
 *
 * <p>경주를 모르는 사용자의 진입점이다. 지금 흐름은 "어디를 갈지 이미 아는 사람"만 쓸 수 있다.
 *
 * <p><b>사후 교정이 아니라 사전 분산이다.</b> 붐비는 코스를 짠 뒤 고치라고 하는 대신,
 * 처음부터 덜 붐비는 코스를 쥐여 준다. 과제 해결 측면에서 이쪽이 더 강하다.
 *
 * <h2>새 점수를 만들지 않는다</h2>
 * 슬롯을 채울 때 쓰는 점수는 교체 추천과 <b>같은</b> 추천도다({@link RecommendationScorer}).
 * 한적도·동선 근접도를 같은 계산식으로 합치고, 설문의 혼잡 민감도가 그 반영 비율만 바꾼다.
 *
 * <h2>하루를 채우는 방식</h2>
 * <ol>
 *   <li><b>첫 장소</b> — 비교 대상이 없어 한적도만 보고 뽑는다.</li>
 *   <li><b>이후 장소</b> — 직전 장소를 기준으로 추천도를 매긴다.
 *       그 날 첫 장소로부터의 반경과 직전 장소로부터의 이동거리로 후보를 먼저 거른다.</li>
 * </ol>
 *
 * <p><b>슬롯 순서를 따로 정렬하지 않는다.</b> 직전 장소와의 근접도가 추천도에 들어 있어
 * 채워지는 순서 자체가 이미 가까운 곳끼리 이어진 사슬이다. 최단 경로 최적화는 하지 않는다 —
 * 근접도 기반 정렬로 충분하고, 그 이상은 이 서비스의 범위가 아니다.
 */
@Service
@RequiredArgsConstructor
public class CourseDraftService {

	private final PlaceProvider placeProvider;
	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;
	private final WeightedPicker picker;
	private final RandomGenerator random;

	/** 요청의 모양(필수값·범위)은 컨트롤러의 {@code @Valid}가 이미 걸렀다. */
	public CourseDraft draft(SupportedRegion region, LocalDate startDate, int nights, SurveyAnswers answers) {
		List<Place> pool = candidatePool(region, answers);
		if (pool.isEmpty()) {
			throw new NotFoundException("고른 여행 스타일에 맞는 장소를 찾지 못했습니다. 스타일을 더 골라 보세요.");
		}

		Set<String> used = new HashSet<>();
		List<DraftedSlot> slots = new ArrayList<>();

		for (int day = 1; day <= nights + 1; day++) {
			slots.addAll(fillDay(day, startDate.plusDays(day - 1L), pool, used, answers));
		}

		if (slots.isEmpty()) {
			throw new NotFoundException("설문 조건에 맞는 코스를 만들지 못했습니다. 조건을 넓혀 보세요.");
		}
		return CourseDraft.of(region.toRegion(), startDate, nights, slots);
	}

	/**
	 * 코스에 올릴 수 있는 장소 전체.
	 *
	 * <p>거르는 기준은 둘이다 — <b>고른 스타일에 맞는 분류</b>인지, 그리고
	 * <b>혼잡 예측 데이터가 있는지</b>. 데이터가 없는 곳을 0점으로 뭉개면 화면에서 "붐빔"으로
	 * 잘못 읽히므로, 애초에 후보로 올리지 않는다.
	 *
	 * <p>숙박은 어떤 스타일에도 매핑돼 있지 않아 여기서 자연히 빠진다.
	 */
	private List<Place> candidatePool(SupportedRegion region, SurveyAnswers answers) {
		return placeProvider.findByRegion(region.toRegion()).stream()
				.filter(place -> TravelStyle.anyMatches(answers.styles(), place.category()))
				.filter(place -> congestionProvider.hasData(place.id()))
				.toList();
	}

	private List<DraftedSlot> fillDay(int day, LocalDate visitDate, List<Place> pool,
			Set<String> used, SurveyAnswers answers) {

		int target = slotCountFor(answers);
		List<DraftedSlot> daySlots = new ArrayList<>();

		Optional<ScoredPlace> seed = pickSeed(visitDate, pool, used, answers);
		if (seed.isEmpty()) {
			// 남은 후보가 없다. 억지로 채우느니 빈 날로 두고 사용자가 직접 채우게 한다.
			return daySlots;
		}

		ScoredPlace current = seed.get();
		Place dayOrigin = current.place();
		used.add(dayOrigin.id());
		daySlots.add(toDraftedSlot(day, 1, current, reasonFor(current, null, 0)));

		for (int order = 2; order <= target; order++) {
			Optional<ScoredPlace> next = pickNext(current.place(), dayOrigin, visitDate, pool, used, answers);
			if (next.isEmpty()) {
				break;
			}
			ScoredPlace picked = next.get();
			used.add(picked.place().id());
			daySlots.add(toDraftedSlot(day, order, picked,
					reasonFor(picked, current.place(), Distances.betweenKm(current.place(), picked.place()))));
			current = picked;
		}

		return daySlots;
	}

	/**
	 * 그 날의 첫 장소. <b>한적도만 보고 뽑는다.</b>
	 *
	 * <p>앞에 놓인 것이 없으면 "무엇에 가까운가"를 잴 수 없다. 없는 항목을 0점으로 채우면
	 * 화면에 "동선 근접도 0"이 찍혀, 계산하지 않은 것을 계산한 것처럼 말하게 된다.
	 *
	 * <p>날마다 자유롭게 뽑는다. 전날 마지막 장소에 이어붙이면 여행 내내 한 방향으로 밀려나
	 * 지역의 한쪽만 보게 된다. 날이 바뀌면 숙소에서 다시 출발하는 것이 자연스럽다.
	 */
	private Optional<ScoredPlace> pickSeed(LocalDate visitDate, List<Place> pool,
			Set<String> used, SurveyAnswers answers) {

		List<ScoredPlace> candidates = pool.stream()
				.filter(place -> !used.contains(place.id()))
				.map(place -> scorer.scoreAlone(place, visitDate))
				.filter(scored -> answers.sensitivity().allows(scored.quietness()))
				.toList();

		return pickOne(candidates, answers);
	}

	/**
	 * 직전 장소에 이어붙일 다음 장소.
	 *
	 * <p>거리 제한이 둘인 이유: 이동거리만 막으면 짧은 이동이 이어져 하루 동안 한 방향으로
	 * 계속 밀려날 수 있다. 5km씩 네 번이면 20km다. 날 단위 반경이 그 표류를 막는다.
	 */
	private Optional<ScoredPlace> pickNext(Place previous, Place dayOrigin, LocalDate visitDate,
			List<Place> pool, Set<String> used, SurveyAnswers answers) {

		List<Place> reachable = pool.stream()
				.filter(place -> !used.contains(place.id()))
				.filter(place -> Distances.betweenKm(previous, place) <= answers.transport().maxHopKm())
				.filter(place -> Distances.betweenKm(dayOrigin, place) <= answers.transport().dayRadiusKm())
				.toList();

		List<ScoredPlace> candidates = reachable.stream()
				.filter(place -> !place.category().code().equals(previous.category().code()))
				.map(place -> scorer.scoreAgainst(previous, place, visitDate, answers.sensitivity().weights()))
				.filter(scored -> answers.sensitivity().allows(scored.quietness()))
				.toList();

		/*
		 * 같은 분류를 연달아 넣지 않는다. 카페 다음에 카페, 유적 다음에 유적이 이어지면
		 * 하루가 단조로워진다.
		 *
		 * 이걸 점수가 아니라 규칙으로 둔 이유: 교체 추천에서 "카테고리 적합성"은
		 * 같은 분류일수록 높은 점수다(음식점 자리에 숙박을 넣지 않으려고). 코스를 짤 때는 반대다.
		 * 같은 이름의 항목이 화면마다 반대 의미를 가지면 근거를 설명할 수 없다.
		 *
		 * 다만 후보가 남지 않으면 규칙을 풀어 준다. 같은 분류가 이어지는 편이 빈 자리보다 낫다.
		 */
		if (candidates.isEmpty()) {
			candidates = reachable.stream()
					.map(place -> scorer.scoreAgainst(previous, place, visitDate, answers.sensitivity().weights()))
					.filter(scored -> answers.sensitivity().allows(scored.quietness()))
					.toList();
		}

		return pickOne(candidates, answers);
	}

	/**
	 * 추천도 상위 후보군에서 <b>가중 무작위 추출</b>로 하나를 고른다.
	 *
	 * <p>1등을 그대로 쓰지 않는 이유: 같은 장소가 모든 사용자에게 추천되면 그곳이 새로운
	 * 혼잡지가 된다. 붐비는 곳을 피하라고 안내해 놓고 한 곳으로 몰아주면 서비스가 직접
	 * 2차 오버투어리즘을 만드는 셈이다.
	 */
	private Optional<ScoredPlace> pickOne(List<ScoredPlace> candidates, SurveyAnswers answers) {
		return picker.pick(
				candidates,
				ScoredPlace::recommendation,
				answers.sensitivity().pickBias(),
				answers.sensitivity().candidatePoolSize());
	}

	/**
	 * 그 날 채울 슬롯 수. 밀도가 정한 범위 안에서 날마다 뽑는다.
	 *
	 * <p>범위 안에서 흔드는 이유: 장소만 분산하고 코스 골격이 늘 같으면 결국 같은 동선이 된다.
	 */
	private int slotCountFor(SurveyAnswers answers) {
		return random.nextInt(
				answers.density().minSlotsPerDay(), answers.density().maxSlotsPerDay() + 1);
	}

	private static DraftedSlot toDraftedSlot(int day, int order, ScoredPlace scored, String reason) {
		return new DraftedSlot(
				// 설문 생성은 애초에 한적도가 있는 후보만 고른다. 진단 불가 칸이 생길 수 없다.
				CourseSlot.diagnosed(day, order, scored.place(), scored.quietness()),
				scored.recommendation(),
				scored.factors(),
				reason);
	}

	/**
	 * 근거 문구. 예: {@code "역사·유적 선호 · 예상 혼잡 낮음 · 대릉원에서 1.2km"}
	 *
	 * <p><b>실제로 계산에 쓴 것만 말한다.</b> "함께 많이 찾는 곳"은 연관 관광지 데이터가
	 * 있어야 할 수 있는 말이라 지금은 쓰지 않는다.
	 *
	 * <p>스타일 이름을 사용자가 고른 답에서 가져오지 않고 <b>장소의 분류에서</b> 되짚는다.
	 * 고른 답을 그대로 붙이면, 맛집이라서 뽑힌 곳에 "역사·유적 선호"라고 적히는 일이 생긴다.
	 */
	private static String reasonFor(ScoredPlace scored, Place previous, double km) {
		String style = TravelStyle.of(scored.place().category())
				.map(TravelStyle::label)
				.orElse(scored.place().category().name());

		String base = "%s 선호 · %s".formatted(style, scored.level().congestionPhrase());
		if (previous == null) {
			return base;
		}
		return "%s · %s에서 %.1fkm".formatted(base, previous.name(), km);
	}
}
