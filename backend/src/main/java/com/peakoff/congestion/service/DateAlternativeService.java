package com.peakoff.congestion.service;

import java.time.LocalDate;
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

	private final PlaceService placeService;
	private final CongestionProvider congestionProvider;

	public DateAlternativeService(PlaceService placeService, CongestionProvider congestionProvider) {
		this.placeService = placeService;
		this.congestionProvider = congestionProvider;
	}

	/**
	 * 기준 날짜 <b>앞뒤</b>로 살펴 그 창 안의 모든 날짜를 돌려준다.
	 *
	 * <h3>왜 앞뒤인가</h3>
	 * 앞으로만 보면 사용자가 날짜를 옮긴 뒤 <b>원래 날짜로 돌아갈 수 없다.</b> 옮긴 날짜를
	 * 기준으로 다시 물으면 이전 날짜는 창 밖(과거)이라 목록에 영영 나오지 않는다.
	 * 앞뒤로 열어두면 되돌아갈 날짜가 늘 목록 안에 있다.
	 *
	 * <h3>왜 더 붐비는 날도 주는가</h3>
	 * 예전에는 {@code improvement > 0}인 날만 걸러 보냈다. 그때는 "더 나은 날 추천"이
	 * 전부였지만, 지금은 화면이 <b>날짜를 고르는 표</b>로 쓰인다 — 되돌아갈 날짜와
	 * 비교 대상이 함께 있어야 "왜 이 날이 나은지"가 성립한다.
	 * 걸러내는 판단은 화면이 한다(더 나은 날만 강조). 서버는 사실만 내려보낸다.
	 *
	 * <h3>지난 날짜</h3>
	 * 창에 걸리면 지난 날짜도 그대로 담는다. 비교 맥락으로 쓸모가 있어서다.
	 * 다만 <b>여행 날짜로 고를 수는 없다</b> — 그 판단은 화면이 한다.
	 *
	 * <p><b>날짜순으로 나간다.</b> 개선폭 순으로 주면 화면이 달력처럼 읽히지 않고,
	 * 어느 날이 어제이고 내일인지 매번 다시 헤아려야 한다.
	 * 이 순서는 {@code datesUntil}이 오름차순 스트림이라 <b>거저 얻는다</b> —
	 * 따로 정렬하지 않는다. 개선폭 순이 필요해지면 그때 정렬을 넣어야 한다.
	 *
	 * <p>목록이 비어 있지 않은지와 기간 범위는 컨트롤러의 검증 애노테이션이 이미 걸렀다.
	 */
	public DateAlternativeResponse suggest(List<String> placeIds, LocalDate selectedDate, int rangeDays) {
		placeIds.forEach(this::ensureHasData);

		int selectedQuietness = averageQuietness(placeIds, selectedDate);

		// datesUntil이 이미 날짜 오름차순이고 filter·map은 순서를 보존한다. 다시 정렬할 것이 없다.
		List<DateOption> window = selectedDate.minusDays(rangeDays)
				.datesUntil(selectedDate.plusDays(rangeDays + 1))
				.filter(date -> !date.equals(selectedDate))
				.map(date -> DateOption.of(date, averageQuietness(placeIds, date), selectedQuietness))
				.toList();

		return DateAlternativeResponse.of(selectedDate, selectedQuietness, window);
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
