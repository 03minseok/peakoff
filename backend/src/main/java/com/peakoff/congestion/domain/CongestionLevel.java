package com.peakoff.congestion.domain;

/**
 * 한적도를 3단계로 묶은 등급. 화면의 배지 표시에 쓴다.
 *
 * <p>숫자 대신 등급을 함께 내려보내는 이유: 임계값이 서버 한 곳에만 있어야
 * 나중에 분석 결과로 기준이 바뀔 때 프론트를 건드리지 않는다.
 *
 * <p><b>아래 임계값은 화면 확인용 임시 기준이다.</b> 실제 데이터 검증 후 확정해야 한다.
 */
public enum CongestionLevel {

	/** 붐빌 것으로 예상. */
	CROWDED("붐빔", "예상 혼잡 다소 높음"),

	MODERATE("보통", "예상 혼잡 보통"),

	/** 한적할 것으로 예상. */
	QUIET("한적", "예상 혼잡 낮음");

	public static final int QUIET_THRESHOLD = 70;
	public static final int MODERATE_THRESHOLD = 40;

	private final String label;
	private final String congestionPhrase;

	CongestionLevel(String label, String congestionPhrase) {
		this.label = label;
		this.congestionPhrase = congestionPhrase;
	}

	public static CongestionLevel fromQuietness(int quietness) {
		if (quietness >= QUIET_THRESHOLD) {
			return QUIET;
		}
		if (quietness >= MODERATE_THRESHOLD) {
			return MODERATE;
		}
		return CROWDED;
	}

	/** 배지에 쓰는 짧은 말: 한적 / 보통 / 붐빔 */
	public String label() {
		return label;
	}

	/**
	 * 추천 근거 문구에 쓰는 표현: "예상 혼잡 낮음" 등.
	 *
	 * <p>예측·통계값이므로 "실시간"이라는 표현을 쓰지 않는다.
	 */
	public String congestionPhrase() {
		return congestionPhrase;
	}
}
