package com.peakoff.congestion.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.domain.DiagnosisGap;
import com.peakoff.congestion.domain.PlannedVisit;
import com.peakoff.congestion.domain.TimeOffStatus;
import com.peakoff.congestion.dto.DateAlternativeResponse;
import com.peakoff.congestion.dto.DateAlternativeResponse.DateOption;
import com.peakoff.place.service.PlaceService;

/**
 * 선택한 날짜보다 한적한 날짜를 찾아준다.
 *
 * <p>장소를 바꾸지 않고도 혼잡을 피할 수 있는 경로다. "가고 싶은 곳을 포기하라"가 아니라
 * "같은 곳을 덜 붐빌 때 가라"는 제안이라, 핵심 명소를 배제하지 않는다는 서비스 철학과 맞는다.
 *
 * <p>여러 방문을 한 번에 받는 이유: 코스 전체를 놓고 "이 코스는 언제 가는 게 나은가"를
 * 물을 수 있어야 하기 때문이다. 장소 하나만 넘기면 그 장소 기준 답이 나온다.
 */
@Service
@RequiredArgsConstructor
public class DateAlternativeService {

	/**
	 * 날짜를 옮기라고 권하는 최소 개선폭.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b> 여행 날짜를 옮기는 것은 숙소·교통까지 딸린 큰 결정이라,
	 * 1~2점 차이로 권하면 서비스가 쓸데없이 참견하는 것이 된다.
	 *
	 * <p>이 값을 응답에 실어 보낸다. 화면에 숫자를 적어두면 여기서 바뀔 때 한쪽만 고쳐진다.
	 */
	private static final int MIN_IMPROVEMENT = 5;

	private final PlaceService placeService;
	private final CongestionProvider congestionProvider;
	private final Clock clock;


	/**
	 * 기준 시작일 <b>앞뒤</b>로 살펴 그 창 안의 모든 날짜를 돌려준다.
	 *
	 * <h3>왜 앞뒤인가</h3>
	 * 앞으로만 보면 사용자가 날짜를 옮긴 뒤 <b>원래 날짜로 돌아갈 수 없다.</b> 옮긴 날짜를
	 * 기준으로 다시 물으면 이전 날짜는 창 밖(과거)이라 목록에 영영 나오지 않는다.
	 * 앞뒤로 열어두면 되돌아갈 날짜가 늘 목록 안에 있다.
	 *
	 * <h3>왜 더 붐비는 날과 못 고르는 날도 주는가</h3>
	 * 화면이 <b>날짜를 고르는 표</b>로 쓰인다. 되돌아갈 날짜와 비교 대상이 함께 있어야
	 * "왜 이 날이 나은지"가 성립한다. 자료가 없는 날도 빼지 않고 사유와 함께 남긴다 —
	 * 목록에서 사라지면 칸 수가 날짜마다 달라져 달력으로 읽히지 않고,
	 * "왜 이 날은 없지"에 답할 수 없다.
	 *
	 * <h3>자료가 없어도 죽지 않는다</h3>
	 * 예전에는 자료 없는 장소가 하나라도 있으면 404로 요청 전체를 죽였다. 공사 집중률에
	 * 음식점이 통째로 없어서, 밥집이 낀 코스는 날짜 대안 자체가 불가능했다.
	 * 이제는 그런 장소를 <b>계산에서만 빼고</b> 나머지로 답한다.
	 *
	 * <p><b>날짜순으로 나간다.</b> 개선폭 순으로 주면 화면이 달력처럼 읽히지 않고,
	 * 어느 날이 어제이고 내일인지 매번 다시 헤아려야 한다.
	 */
	public DateAlternativeResponse suggest(List<PlannedVisit> visits, LocalDate startDate, int rangeDays) {
		// 장소가 존재하는지는 여전히 확인한다. 없는 장소를 물은 것은 요청이 잘못된 것이다.
		visits.stream().map(PlannedVisit::placeId).distinct().forEach(placeService::getById);

		/*
		 * 예측 대상이 아닌 장소(음식점·카페·숙박)는 계산에서 뺀다. 날짜를 옮겨도 이들의
		 * 혼잡도는 알 수 없으므로, 넣어봐야 어느 날짜가 나은지 판단에 기여하지 못한다.
		 */
		List<PlannedVisit> scorable = visits.stream()
				.filter(visit -> congestionProvider.hasData(visit.placeId()))
				.toList();

		if (scorable.isEmpty()) {
			return insufficient(startDate, rangeDays);
		}

		OptionalInt selected = averageQuietness(scorable, startDate);
		List<DateOption> options = buildOptions(scorable, startDate, rangeDays, selected);

		if (selected.isEmpty()) {
			/*
			 * 기준일 자체를 계산할 수 없으면 개선폭의 기준이 없다. 후보에 점수가 있어도
			 * "얼마나 나은지"를 말할 수 없으므로 자료 부족으로 다룬다.
			 */
			return DateAlternativeResponse.of(
					TimeOffStatus.INSUFFICIENT_DATA, startDate, null, null, null, MIN_IMPROVEMENT, options);
		}

		int selectedQuietness = selected.getAsInt();
		Optional<DateOption> best = bestOption(options, startDate);

		TimeOffStatus status = decide(selectedQuietness, best, options);

		return DateAlternativeResponse.of(
				status,
				startDate,
				selectedQuietness,
				best.map(DateOption::date).orElse(null),
				best.map(DateOption::improvement).orElse(null),
				MIN_IMPROVEMENT,
				options);
	}

	/**
	 * 상태를 정한다. <b>위에서부터 먼저 들어맞는 것을 쓴다.</b>
	 *
	 * <p>조건을 병렬로 두면 둘이 동시에 참일 때 어느 쪽이 보일지가 코드 순서로 우연히 정해진다.
	 * 순서 자체가 규칙이라 여기 한 곳에 모아 둔다.
	 */
	private static TimeOffStatus decide(int selectedQuietness, Optional<DateOption> best,
			List<DateOption> options) {

		// 비교할 수 있는 후보가 하나도 없으면 판단 자체가 성립하지 않는다.
		if (options.stream().noneMatch(option -> option.improvement() != null)) {
			return TimeOffStatus.INSUFFICIENT_DATA;
		}
		/*
		 * 이미 한적하면 권하지 않는다. 개별 장소가 붐비는 문제는 장소 교체가 맡는다 —
		 * 코스 하나가 붐빈다고 여행 날짜 전체를 옮기라고 할 일은 아니다.
		 */
		if (CongestionLevel.fromQuietness(selectedQuietness) == CongestionLevel.QUIET) {
			return TimeOffStatus.ALREADY_QUIET;
		}
		if (best.isEmpty()) {
			return TimeOffStatus.CURRENT_BEST;
		}
		if (best.get().improvement() < MIN_IMPROVEMENT) {
			return TimeOffStatus.MARGINAL;
		}
		return TimeOffStatus.RECOMMENDED;
	}

	/**
	 * 가장 나은 후보. 없으면 빈 값.
	 *
	 * <p>고를 수 있고(지난 날짜가 아니고) 실제로 더 한적한 날만 후보다.
	 * 동점이면 <b>기준일에 가까운 날</b>을, 그래도 같으면 <b>이른 날</b>을 고른다 —
	 * 이미 잡아둔 일정에서 덜 움직이는 쪽이 실행 가능성이 높다.
	 */
	private static Optional<DateOption> bestOption(List<DateOption> options, LocalDate startDate) {
		return options.stream()
				.filter(DateOption::selectable)
				.filter(option -> option.improvement() != null && option.improvement() > 0)
				.min(Comparator
						.comparingInt((DateOption option) -> -option.improvement())
						.thenComparingLong(option -> Math.abs(
								option.date().toEpochDay() - startDate.toEpochDay()))
						.thenComparing(DateOption::date));
	}

	private List<DateOption> buildOptions(List<PlannedVisit> scorable, LocalDate startDate,
			int rangeDays, OptionalInt selected) {

		Integer selectedQuietness = selected.isPresent() ? selected.getAsInt() : null;
		LocalDate today = LocalDate.now(clock);

		List<DateOption> options = new ArrayList<>();
		// datesUntil이 이미 날짜 오름차순이다. 따로 정렬할 것이 없다.
		startDate.minusDays(rangeDays)
				.datesUntil(startDate.plusDays(rangeDays + 1))
				.filter(candidate -> !candidate.equals(startDate))
				.forEach(candidate -> {
					OptionalInt quietness = averageQuietness(scorable, candidate);
					if (quietness.isEmpty()) {
						options.add(DateOption.unavailable(candidate, DiagnosisGap.DATE_OUT_OF_FORECAST));
						return;
					}
					// 지난 날짜는 비교 맥락으로 남기되 고를 수는 없다.
					boolean past = candidate.isBefore(today);
					options.add(DateOption.of(candidate, quietness.getAsInt(), selectedQuietness, past));
				});
		return List.copyOf(options);
	}

	/**
	 * 후보 시작일 하나에 대한 코스 전체의 한적도.
	 *
	 * <p><b>날짜 하나로 모든 장소를 조회하지 않는다.</b> 방문마다 일차를 더해 실제 방문일을
	 * 구한 뒤 그 날짜의 자료를 쓴다. 시작일을 9월 14일로 옮기면 2일차는 9월 15일이 된다 —
	 * 후보 시작일이 바뀔 때마다 코스 전체가 통째로 밀리는 것이 이 기능의 핵심이다.
	 *
	 * <p>한 방문이라도 그 날짜의 자료가 없으면 <b>그 후보 날짜 전체를 포기한다.</b>
	 * 일부만 평균 내면 날짜마다 계산 대상이 달라져 점수를 공정하게 비교할 수 없다.
	 *
	 * <p>모든 방문에 같은 비중을 준다. 일차별로 가중치를 두면 "어느 날이 더 중요한가"라는,
	 * 우리가 계산한 적 없는 판단이 점수에 섞인다.
	 */
	private OptionalInt averageQuietness(List<PlannedVisit> visits, LocalDate candidateStartDate) {
		int sum = 0;
		for (PlannedVisit visit : visits) {
			LocalDate visitDate = visit.dateFrom(candidateStartDate);
			if (!congestionProvider.hasData(visit.placeId(), visitDate)) {
				return OptionalInt.empty();
			}
			sum += congestionProvider.quietnessOf(visit.placeId(), visitDate);
		}
		return OptionalInt.of(Math.round((float) sum / visits.size()));
	}

	/**
	 * 계산할 수 있는 장소가 하나도 없을 때. 창은 그대로 그리되 점수 자리를 비운다.
	 *
	 * <p>코스가 음식점·카페로만 이루어졌을 때 여기로 온다. 목록을 통째로 비우지 않는 이유는
	 * 화면이 날짜 표를 계속 그릴 수 있어야 하고, 빈 화면보다 "왜 못 보여주는지"가 나아서다.
	 */
	private DateAlternativeResponse insufficient(LocalDate startDate, int rangeDays) {
		List<DateOption> options = startDate.minusDays(rangeDays)
				.datesUntil(startDate.plusDays(rangeDays + 1))
				.filter(candidate -> !candidate.equals(startDate))
				.map(candidate -> DateOption.unavailable(candidate, DiagnosisGap.NO_FORECAST_FOR_PLACE))
				.toList();

		return DateAlternativeResponse.of(
				TimeOffStatus.INSUFFICIENT_DATA, startDate, null, null, null, MIN_IMPROVEMENT, options);
	}
}
