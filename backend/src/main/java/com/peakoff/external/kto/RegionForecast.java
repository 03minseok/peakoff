package com.peakoff.external.kto;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.Set;

/**
 * 한 지역의 집중률 예측 전체.
 *
 * <p><b>장소 하나가 아니라 지역 한 덩어리를 담는다.</b> 공사 API가 지역 단위로 답하기도 하고,
 * 무엇보다 진단 한 번에 필요한 조회가 (장소 수 × 날짜 수)라서다. 날짜 대안은 한 장소당
 * 7일을 보므로, 장소마다 부르면 호출이 수십 번으로 불어난다. 지역을 통째로 받아
 * 메모리에서 꺼내면 호출은 한 번이다.
 *
 * <p><b>집중률 원본값을 그대로 담는다.</b> 한적도로 뒤집는 일은 이 클래스가 하지 않는다 —
 * 변환식은 분석 결과로 바뀔 값이고, 여기는 "공사가 뭐라고 답했는가"만 기억하는 자리다.
 * 원본을 남겨 두면 변환이 바뀌어도 이 층은 손댈 것이 없다.
 *
 * @param ratesByName 공사가 쓰는 <b>관광지명 원문</b> → (날짜 → 집중률). 이름이 곧 키인 이유는
 *                    응답에 콘텐츠 ID가 없기 때문이다 ({@link PlaceNameMatcher} 참고)
 * @param firstDate   응답에 들어 있던 가장 이른 날짜. 자료가 없으면 {@code null}
 * @param lastDate    응답에 들어 있던 가장 늦은 날짜. 자료가 없으면 {@code null}
 */
public record RegionForecast(
		Map<String, Map<LocalDate, Double>> ratesByName,
		LocalDate firstDate,
		LocalDate lastDate) {

	public RegionForecast {
		Map<String, Map<LocalDate, Double>> copy = new HashMap<>();
		ratesByName.forEach((name, byDate) -> copy.put(name, Map.copyOf(byDate)));
		ratesByName = Collections.unmodifiableMap(copy);
	}

	public static RegionForecast empty() {
		return new RegionForecast(Map.of(), null, null);
	}

	/** 공사가 이 지역에서 예측을 제공하는 관광지 이름들. 이름 매칭의 후보 목록이 된다. */
	public Set<String> placeNames() {
		return ratesByName.keySet();
	}

	public boolean isEmpty() {
		return ratesByName.isEmpty();
	}

	/**
	 * 예측이 닿는 마지막 날. 이 날 뒤의 여행은 진단할 수 없다.
	 *
	 * <p><b>상수로 박지 않고 응답에서 꺼내 쓴다.</b> 공사 설명은 "향후 5주"인데 실측은 24일이라
	 * 서로 다르고, 앞으로 늘거나 줄 수도 있다. 관측된 값을 그대로 경계선으로 삼으면
	 * 창이 어떻게 바뀌든 코드를 고칠 일이 없다.
	 */
	public Optional<LocalDate> lastForecastDate() {
		return Optional.ofNullable(lastDate);
	}

	/**
	 * 그 이름·그 날짜의 집중률. 없으면 빈 값.
	 *
	 * <p>없는 경우가 두 가지라 <b>구분해서 물어야 한다</b>:
	 * 그 장소가 예측 대상이 아닌 것(음식점·카페처럼 목록에 아예 없다)과,
	 * 장소는 있는데 그 날짜가 예측 범위 밖인 것은 사용자에게 다르게 설명해야 한다.
	 * 이 메서드는 둘을 합쳐 "없다"로만 답하므로, 사유가 필요하면
	 * {@link #hasPlace(String)}과 {@link #lastForecastDate()}를 함께 본다.
	 */
	public OptionalDouble rateOf(String apiPlaceName, LocalDate date) {
		Map<LocalDate, Double> byDate = ratesByName.get(apiPlaceName);
		if (byDate == null) {
			return OptionalDouble.empty();
		}
		Double rate = byDate.get(date);
		return rate == null ? OptionalDouble.empty() : OptionalDouble.of(rate);
	}

	/** 그 이름이 예측 대상 목록에 있는지. 날짜와 무관하다. */
	public boolean hasPlace(String apiPlaceName) {
		return ratesByName.containsKey(apiPlaceName);
	}
}
