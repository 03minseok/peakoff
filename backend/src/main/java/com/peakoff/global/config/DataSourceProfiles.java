package com.peakoff.global.config;

/**
 * 데이터 출처를 가르는 스프링 프로파일 이름.
 *
 * <p>{@code @Profile("mock")}처럼 문자열을 직접 쓰면 오타가 나도 컴파일은 통과한다.
 * 그런데 프로파일 이름이 틀리면 그 빈은 <b>조용히 등록되지 않고</b>, 나중에
 * "주입할 빈이 없다"는 엉뚱한 에러로 나타난다. 상수로 묶어 그 사고를 막는다.
 */
public final class DataSourceProfiles {

	/** 목업 데이터. 공공데이터 API 없이 전체 흐름을 확인할 때. */
	public static final String MOCK = "mock";

	/** 실제 공공데이터 API 호출. */
	public static final String REAL = "real";

	private DataSourceProfiles() {
	}
}
