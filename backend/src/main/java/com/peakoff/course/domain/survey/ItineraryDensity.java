package com.peakoff.course.domain.survey;

/**
 * 설문 2번 — 일정 밀도. 일자별 슬롯 개수를 정한다.
 *
 * <p>개수를 하나로 못 박지 않고 <b>범위</b>로 둔 이유: 같은 설문 답에서 늘 똑같은 모양의 코스가
 * 나오면 추천 분산이 무의미해진다. 장소만 흩어놓고 코스 골격이 같으면 결국 같은 동선이 된다.
 * 일자마다 범위 안에서 뽑아 하루는 3곳, 다음 날은 4곳처럼 갈리게 한다.
 *
 * <p>후보가 모자라면 최소값보다 적게 나올 수 있다. 억지로 채우려고 반경을 넘기거나
 * 스타일에 안 맞는 곳을 넣는 것보다, 적은 코스를 주고 사용자가 직접 채우게 두는 편이 낫다.
 */
public enum ItineraryDensity {

	RELAXED("여유", 2, 3),
	BALANCED("적당", 3, 4),
	PACKED("알차게", 4, 5);

	private final String label;
	private final int minSlotsPerDay;
	private final int maxSlotsPerDay;

	ItineraryDensity(String label, int minSlotsPerDay, int maxSlotsPerDay) {
		this.label = label;
		this.minSlotsPerDay = minSlotsPerDay;
		this.maxSlotsPerDay = maxSlotsPerDay;
	}

	public String label() {
		return label;
	}

	public int minSlotsPerDay() {
		return minSlotsPerDay;
	}

	public int maxSlotsPerDay() {
		return maxSlotsPerDay;
	}
}
