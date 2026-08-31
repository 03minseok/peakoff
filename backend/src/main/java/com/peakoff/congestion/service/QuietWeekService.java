package com.peakoff.congestion.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.QuietSpot;
import com.peakoff.congestion.domain.QuietSpotProvider;
import com.peakoff.congestion.dto.QuietSpotResponse;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * "이번 주 한적한 곳" — 지역을 가리지 않고, 이번 주에 한적할 곳 몇 군데.
 *
 * <h2>이 화면이 하는 일</h2>
 * 홈은 지금까지 <b>지역을 하나 골라야</b> 무엇이든 보여줄 수 있었다. 지역이 일곱이 되면서
 * 그 방식은 "일곱 중 하나만 보여주고 나머지는 숨기는" 화면이 됐다. 여기서는 반대로
 * <b>전 지역을 한 번에 훑어</b> 한적한 곳을 건져 올린다 — 어디로 갈지 안 정한 사람에게
 * 서비스가 먼저 말을 거는 자리다.
 *
 * <h2>⚠️ 순서를 지킨다 — 거르기가 먼저, 뽑기가 마지막</h2>
 * CLAUDE.md "추천 분산"의 규칙이 이 자리에도 그대로 걸린다. 홈에 뜨는 곳이 늘 같으면
 * <b>그곳이 새로운 혼잡지가 된다</b> — 그것도 이 서비스가 가장 많이 노출하는 화면에서.
 *
 * <ol>
 *   <li>지역마다 예측을 훑어 <b>한적(QUIET) 등급인 곳만</b> 남긴다</li>
 *   <li>지역별로 가중 무작위 하나씩 — 같은 지역이 목록을 독차지하지 않게</li>
 *   <li>그 지역 대표들 중에서 다시 가중 무작위로 {@code limit}개</li>
 * </ol>
 *
 * <p><b>뽑은 뒤 점수순으로 다시 정렬하지 않는다.</b> 2026-08-26에 대안 추천에서 겪은 그
 * 고장이다 — 값은 전부 맞게 들어 있었는데 마지막에 다시 줄을 세워서, 분산 장치가
 * 오래도록 아무 일도 하지 않았다.
 *
 * <h2>⚠️ 완성된 목록을 캐시하지 않는다</h2>
 * 서버가 이 목록을 캐시해 모든 사용자에게 돌려주면 분산이 통째로 죽는다.
 * 캐시는 <b>원자료 층</b>(지역별 집중률·관광지 카탈로그, TTL 6시간)에만 있고,
 * 고르는 일은 요청마다 새로 한다. 공사 호출이 늘지 않는 것은 그 캐시 덕이지
 * 결과를 재사용해서가 아니다.
 */
@Service
@RequiredArgsConstructor
public class QuietWeekService {

	/**
	 * "이번 주"의 길이. 오늘부터 7일이다.
	 *
	 * <p>예측 창(24~30일) 전체를 보지 않는 이유: 3주 뒤에 한적한 곳을 "이번 주 한적한 곳"이라
	 * 부를 수는 없다. 화면이 날짜를 함께 적으므로 그 날짜가 손에 닿는 거리여야 한다.
	 */
	private static final int FORECAST_DAYS = 7;

	/**
	 * 지역마다 몇 곳까지 후보로 받아 올지.
	 *
	 * <p>이 값이 <b>지역 안에서의 분산</b>을 정한다. 1이면 그 지역의 1등이 언제나 나오고,
	 * 너무 크면 이름 잇기 비용만 늘면서 한적하지도 않은 곳까지 후보에 든다.
	 */
	private static final int PER_REGION_CANDIDATES = 6;

	/**
	 * 뽑기 후보군 크기와 쏠림 정도. 대안 추천이 실측으로 정한 값과 같다
	 * (Pool 3 · 지수 1.2, 2026-08-26).
	 *
	 * <p>⚠️ Pool이 요청 수보다 커야 뽑기가 일한다. 후보가 셋인데 셋을 달라고 하면
	 * "다 가져가라"와 같아 뽑기가 고를 것이 없다 — 화면이 3개를 요청하고
	 * 지역 대표가 일곱까지 모이는 지금 구조가 그 조건을 지킨다.
	 */
	private static final int POOL_SIZE = 3;
	private static final double PICK_BIAS = 1.2;

	private final QuietSpotProvider quietSpotProvider;
	private final WeightedPicker picker;
	private final Clock clock;

	/** 지역과 그 지역에서 건진 한 곳. 뽑기가 끝난 뒤에도 어느 지역인지 알아야 한다. */
	private record RegionalSpot(SupportedRegion region, QuietSpot spot) {
	}

	/**
	 * @param limit 화면에 세울 곳 수
	 * @return 한적한 곳들. <b>점수순이 아니라 뽑힌 순서다.</b>
	 *         자료가 모자라면 요청보다 적게 담긴다 — 채우려고 붐비는 곳을 섞지 않는다
	 */
	public List<QuietSpotResponse> thisWeek(int limit) {
		LocalDate from = LocalDate.now(clock);

		/*
		 * 1단계 — 지역마다 후보를 모으고, <b>한적 등급만</b> 남긴다.
		 *
		 * ⚠️ 등급으로 거르는 것이 핵심이다. 점수 순으로 위에서 몇 개를 자르면 그 지역에서
		 * 가장 한적한 곳이 뽑히기는 하지만, 그 곳이 실제로는 "보통"일 수 있다.
		 * 화면이 "이번 주 한적한 곳"이라 이름 붙인 목록에 보통인 곳을 올릴 수는 없다.
		 */
		List<RegionalSpot> representatives = new ArrayList<>();
		for (SupportedRegion region : SupportedRegion.values()) {
			List<QuietSpot> quiet = quietSpotProvider
					.quietestWithin(region.toRegion(), from, FORECAST_DAYS, PER_REGION_CANDIDATES)
					.stream()
					.filter(spot -> spot.level() == CongestionLevel.QUIET)
					.toList();

			// 2단계 — 지역 안에서 한 곳. 지역 하나가 목록을 독차지하지 않게 여기서 좁힌다.
			picker.pick(quiet, QuietSpot::quietness, PICK_BIAS, POOL_SIZE)
					.ifPresent(spot -> representatives.add(new RegionalSpot(region, spot)));
		}

		// 3단계 — 지역 대표들 중에서 중복 없이 뽑는다.
		return drawWithoutRepeat(representatives, limit).stream()
				.map(picked -> QuietSpotResponse.of(picked.spot(), picked.region()))
				.toList();
	}

	/**
	 * 뽑은 것을 후보에서 빼 가며 {@code limit}개를 채운다.
	 *
	 * <p>한 번에 여러 개를 뽑는 대신 한 개씩 빼면서 뽑는 이유: 가중 무작위는 같은 후보를
	 * 두 번 고를 수 있다. 같은 곳이 카드 두 장으로 서면 목록이 고장으로 읽힌다.
	 */
	private List<RegionalSpot> drawWithoutRepeat(List<RegionalSpot> candidates, int limit) {
		List<RegionalSpot> remaining = new ArrayList<>(candidates);
		List<RegionalSpot> drawn = new ArrayList<>();
		while (drawn.size() < limit && !remaining.isEmpty()) {
			Optional<RegionalSpot> picked =
					picker.pick(remaining, item -> item.spot().quietness(), PICK_BIAS, POOL_SIZE);
			if (picked.isEmpty()) {
				break;
			}
			drawn.add(picked.get());
			remaining.remove(picked.get());
		}
		return drawn;
	}
}
