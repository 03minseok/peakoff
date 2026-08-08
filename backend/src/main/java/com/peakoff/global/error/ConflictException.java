package com.peakoff.global.error;

/** 이미 있는 값과 부딪힐 때. 409로 변환된다. */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}
}
