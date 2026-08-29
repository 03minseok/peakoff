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
import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
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

	/** 코스를 채울 후보를 어디까지 볼지. 실데이터에서는 중심 관광지가 이 목록을 준다(지역당 100곳 안팎). */
	private static final int POOL_SIZE = 100;

	/**
	 * 그 날 첫 장소로부터의 최대 반경.
	 *
	 * <p>슬롯 간 거리만 제한하면 짧은 이동이 이어져 하루 동안 한 방향으로 계속 밀려날 수 있다.
	 * 5km씩 네 번이면 20km다. 날 단위 반경이 그 표류를 막는다.
	 *
	 * <h3>⚠️ 이동수단 문항을 걷어내고 남긴 값이다 (2026-08-27)</h3>
	 * 자차(25km)와 대중교통(8km) 중 <b>넓은 쪽</b>을 남겼다. 좁은 쪽으로 두면
	 * 이번에 고치려던 "추천이 안 뜬다"가 그대로 다시 생긴다 — 특히 제주에서
	 * 8km 반경은 후보를 크게 잘라낸다.
	 *
	 * <p>거리는 <b>좌표 기반 직선거리</b>다. 실제 도로·환승 시간이 아니다.
	 * 최단 경로 최적화는 이 서비스의 범위가 아니고, "하루에 다닐 만한가"만 가리면 충분하다.
	 * 경주 기준으로 시내권(대릉원·첨성대 반경 2km)에서 불국사·석굴암·양동마을까지 닿는다.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b>
	 */
	public static final double DAY_RADIUS_KM = 25.0;

	/** 직전 장소에서 다음 장소까지의 최대 이동거리. 근거는 {@link #DAY_RADIUS_KM}과 같다. */
	public static final double MAX_HOP_KM = 15.0;

	private final PlaceProvider placeProvider;
	private final CongestionProvider congestionProvider;
	private final RecommendationScorer scorer;
	private final WeightedPicker picker;
	private final RandomGenerator random;

	/** 요청의 모양(필수값·범위)은 컨트롤러의 {@code @Valid}가 이미 걸렀다. */
	public CourseDraft draft(SupportedRegion region, LocalDate startDate, int nights, SurveyAnswers answers) {
		List<Place> pool = candidatePool(region);
		if (pool.isEmpty()) {
			throw new NotFoundException("이 지역에서 예상 혼잡을 계산할 수 있는 장소를 찾지 못했습니다.\n다른 날짜로 시도해 보세요.");
		}

		Set<String> used = new HashSet<>();
		List<DraftedSlot> slots = new ArrayList<>();

		for (int day = 1; day <= nights + 1; day++) {
			slots.addAll(fillDay(day, startDate.plusDays(day - 1L), pool, used, answers));
		}

		if (slots.isEmpty()) {
			throw new NotFoundException("설문 조건에 맞는 코스를 만들지 못했습니다.\n조건을 넓혀 보세요.");
		}
		return CourseDraft.of(region.toRegion(), startDate, nights, slots);
	}

	/**
	 * 코스에 올릴 수 있는 장소 전체.
	 *
	 * <p>거르는 기준은 둘이다 — <b>코스 슬롯에 어울리는 분류</b>인지, 그리고
	 * <b>혼잡 예측 데이터가 있는지</b>. 데이터가 없는 곳을 0점으로 뭉개면 화면에서 "붐빔"으로
	 * 잘못 읽히므로, 애초에 후보로 올리지 않는다.
	 *
	 * <h3>⚠️ 스타일로 고르게 하던 것을 걷어냈다 (2026-08-27)</h3>
	 * 예전에는 설문 1번의 여행 스타일(역사·자연·문화)이 여기서 후보를 걸렀다.
	 * <b>하나만 고르면 후보가 통째로 쪼그라들었다</b> — 실측 기준 제주시에서 역사만 고르면
	 * 3곳, 서귀포는 2곳이다. 1박 2일에 네댓 칸을 채워야 하는데 거기서 이미 못 채운다.
	 *
	 * <p>골라 남기는 대신 <b>빼는 쪽으로 뒤집었다.</b> 예측이 있으면 기본적으로 후보이고,
	 * 코스에 어울리지 않는 것만 {@link PlaceCategories#isCourseCandidate}가 뺀다
	 * (음식점·숙박·축제, 그리고 VE에 섞여 있는 리조트·도서관·수련관).
	 *
	 * <p>후보가 넓어진 만큼 <b>같은 곳으로 몰릴 위험은 오히려 줄어든다</b> — 뽑기는 그대로
	 * 가중 무작위라, Pool이 클수록 사람마다 다른 코스가 나온다.
	 *
	 * <p>지역 전체(경주 621곳)를 훑지 않고 대표 관광지까지만 본다. 대부분이 음식점·숙박이고,
	 * 코스의 뼈대가 될 만한 곳은 앞쪽에 몰려 있다. <b>그 순서는 인기 순이라 추천 점수에는
	 * 쓰지 않는다</b> — 여기서는 "아무도 모르는 곳만 뽑히지 않게" 하는 하한으로만 쓴다.
	 */
	private List<Place> candidatePool(SupportedRegion region) {
		return placeProvider.representatives(region.toRegion(), POOL_SIZE).stream()
				.filter(place -> PlaceCategories.isCourseCandidate(place.category()))
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
	 * <p>거리 제한이 둘인 이유는 {@link #DAY_RADIUS_KM}에 적어 두었다.
	 */
	private Optional<ScoredPlace> pickNext(Place previous, Place dayOrigin, LocalDate visitDate,
			List<Place> pool, Set<String> used, SurveyAnswers answers) {

		List<Place> reachable = pool.stream()
				.filter(place -> !used.contains(place.id()))
				.filter(place -> Distances.betweenKm(previous, place) <= MAX_HOP_KM)
				.filter(place -> Distances.betweenKm(dayOrigin, place) <= DAY_RADIUS_KM)
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
	 * 근거 문구. 예: {@code "대릉원에서 1.2km"}
	 *
	 * <p><b>실제로 계산에 쓴 것만 말한다.</b> "함께 많이 찾는 곳"은 연관 관광지 데이터가
	 * 있어야 할 수 있는 말이라 지금은 쓰지 않는다.
	 *
	 * <h3>⚠️ 화면이 이미 말하는 것을 되풀이하지 않는다 (2026-08-29)</h3>
	 * 예전에는 {@code "역사·유적 · 예상 혼잡 낮음 · 대릉원에서 1.2km"}였다. 앞의 둘을 뺐다 —
	 * 카드가 <b>분류를 글자로, 한적도를 배지로</b> 이미 보여주고 있어서, 같은 말이 한 카드에
	 * 두 번씩 섰다. 여기서만 알 수 있는 것은 <b>앞 장소에서 얼마나 떨어졌는가</b>뿐이다.
	 *
	 * <p>그 날 <b>첫 장소</b>는 앞에 놓인 것이 없어 잴 거리가 없다. 그렇다고 비워 두지는
	 * 않는다 — {@code DraftedSlot}이 "모든 슬롯에 근거가 있다"를 보장하고 있고(그 불변식을
	 * 시험이 지킨다), CLAUDE.md 필수 기능 4도 <b>모든 추천에 이유를 함께 표시</b>하라고 한다.
	 *
	 * <p>대신 그 자리에 <b>참인 다른 말</b>을 준다. 첫 장소는 우리가 그 날의 기준점으로
	 * 고른 곳이고 나머지가 그로부터 이어 붙는다 — 지어낸 말이 아니라 실제로 한 일이다.
	 *
	 * <p>⚠️ 예전에는 {@code "역사·유적 선호"}이기도 했다. 스타일을 묻지 않게 된 뒤로는 할 수
	 * 없는 말이다 — 고른 적 없는 것을 선호한다고 적으면 계산하지 않은 것을 근거로 삼는 셈이다.
	 */
	private static String reasonFor(ScoredPlace scored, Place previous, double km) {
		if (previous == null) {
			return "하루를 시작하는 곳";
		}
		return "%s에서 %.1fkm".formatted(previous.name(), km);
	}
}
