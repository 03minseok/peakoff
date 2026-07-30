package com.peakoff.congestion.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.dto.DateAlternativeResponse;
import com.peakoff.congestion.dto.DateAlternativeResponse.DateOption;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.service.PlaceService;

/**
 * 선택한 날짜보다 한적한 날짜를 찾아준다.
 *
 * <p>장소를 바꾸지 않고도 혼잡을 피할 수 있는 경로다. "가고 싶은 곳을 포기하라"가 아니라
 * "같은 곳을 덜 붐빌 때 가라"는 제안이라, 핵심 명소를 배제하지 않는다는 서비스 철학과 맞는다.
 *
 * <p>여러 장소를 한 번에 받는 이유: 코스 전체를 놓고 "이 코스는 언제 가는 게 나은가"를
 * 물을 수 있어야 하기 때문이다. 장소 하나만 넘기면 그 장소 기준 답이 나온다.
 */
@Service
public class DateAlternativeService {

	private static final int MAX_OPTIONS = 5;

	private final PlaceService placeService;
	private final CongestionProvider congestionProvider;

	public DateAlternativeService(PlaceService placeService, CongestionProvider congestionProvider) {
		this.placeService = placeService;
		this.congestionProvider = congestionProvider;
	}

	/** 목록이 비어 있지 않은지와 기간 범위는 컨트롤러의 검증 애노테이션이 이미 걸렀다. */
	public DateAlternativeResponse suggest(List<String> placeIds, LocalDate selectedDate, int rangeDays) {
		placeIds.forEach(this::ensureHasData);

		int selectedQuietness = averageQuietness(placeIds, selectedDate);

		List<DateOption> better = selectedDate.datesUntil(selectedDate.plusDays(rangeDays))
				.filter(date -> !date.equals(selectedDate))
				.map(date -> DateOption.of(date, averageQuietness(placeIds, date), selectedQuietness))
				// 더 한적한 날만 제안한다. 더 붐비는 날을 보여줄 이유가 없다.
				.filter(option -> option.improvement() > 0)
				.sorted(Comparator.comparingInt(DateOption::improvement).reversed()
						.thenComparing(DateOption::date))
				.limit(MAX_OPTIONS)
				.toList();

		return DateAlternativeResponse.of(selectedDate, selectedQuietness, better);
	}

	/** 코스 전체를 물었을 때는 장소들의 평균으로 그 날짜를 대표한다. */
	private int averageQuietness(List<String> placeIds, LocalDate date) {
		return (int) Math.round(placeIds.stream()
				.mapToInt(placeId -> congestionProvider.quietnessOf(placeId, date))
				.average()
				.orElseThrow());
	}

	private void ensureHasData(String placeId) {
		// 장소 자체가 없으면 404가 먼저 난다.
		placeService.getById(placeId);
		if (!congestionProvider.hasData(placeId)) {
			throw new NotFoundException("혼잡 예측 데이터가 없는 장소입니다: " + placeId);
		}
	}

}
