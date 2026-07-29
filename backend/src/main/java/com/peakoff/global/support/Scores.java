package com.peakoff.global.support;

/**
 * 0~100 정수 점수 규약.
 *
 * <p>한적도·추천도·코스 총점이 전부 같은 척도를 쓰도록 범위 검증을 한 곳에 모았다.
 * 척도를 바꿀 일이 생기면 이 파일만 고치면 된다.
 */
public final class Scores {

	public static final int MIN = 0;
	public static final int MAX = 100;

	private Scores() {
	}

	public static void validate(int value, String fieldName) {
		if (value < MIN || value > MAX) {
			throw new IllegalArgumentException(
					"%s는 %d~%d 범위여야 합니다. 입력값: %d".formatted(fieldName, MIN, MAX, value));
		}
	}
}
