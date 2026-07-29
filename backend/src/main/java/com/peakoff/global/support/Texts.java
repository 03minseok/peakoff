package com.peakoff.global.support;

/**
 * 외부 데이터에서 넘어온 문자열을 도메인에 들이기 전 다듬는다.
 *
 * <p>공공데이터 응답에는 앞뒤 공백이 섞여 오는 필드가 흔하다.
 * 값을 그대로 두면 화면 정렬이 어긋나거나 비교가 빗나가므로 경계에서 한 번 정리한다.
 */
public final class Texts {

	private Texts() {
	}

	public static String requireNotBlank(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("%s는 비어 있을 수 없습니다.".formatted(fieldName));
		}
		return value.trim();
	}

	/** 값이 없을 수 있는 필드용. 공백만 있는 값은 없는 것으로 취급한다. */
	public static String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
