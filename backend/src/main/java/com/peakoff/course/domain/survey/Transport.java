package com.peakoff.course.domain.survey;

/**
 * 설문 4번 — 이동수단. 후보 반경과 슬롯 간 이동거리를 정한다.
 *
 * <p>거리는 <b>좌표 기반 직선거리</b>다. 실제 도로·환승 시간이 아니다. 최단 경로 최적화는
 * 이 서비스의 범위가 아니고, "걸어갈 만한가 / 차로 옮길 거리인가"만 가리면 충분하다.
 *
 * <p>경주 기준으로 시내권(대릉원·첨성대·황리단길 반경 2km 안)과 외곽(감포항 30km)이
 * 갈리는 지점에 값을 맞췄다. 대중교통 8km는 시내권과 보문단지까지, 자차 25km는
 * 불국사·석굴암·양동마을까지 닿는다.
 *
 * <p><b>분석 검증 전 임시값이다.</b>
 */
public enum Transport {

	CAR("자차", 25.0, 15.0),

	/** 반경을 좁힌다. 버스 배차가 드문 외곽으로 보내면 실행할 수 없는 코스가 된다. */
	TRANSIT("대중교통·도보", 8.0, 5.0);

	private final String label;
	private final double dayRadiusKm;
	private final double maxHopKm;

	Transport(String label, double dayRadiusKm, double maxHopKm) {
		this.label = label;
		this.dayRadiusKm = dayRadiusKm;
		this.maxHopKm = maxHopKm;
	}

	/**
	 * 그 날 첫 장소로부터의 최대 반경.
	 *
	 * <p>슬롯 간 거리만 제한하면 짧은 이동이 이어져 하루 동안 한 방향으로 계속 밀려날 수 있다.
	 * 5km씩 네 번이면 20km다. 날 단위 반경이 그 표류를 막는다.
	 */
	public double dayRadiusKm() {
		return dayRadiusKm;
	}

	/** 직전 장소에서 다음 장소까지의 최대 이동거리. */
	public double maxHopKm() {
		return maxHopKm;
	}

	public String label() {
		return label;
	}
}
