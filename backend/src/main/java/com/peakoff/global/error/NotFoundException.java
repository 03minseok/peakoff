package com.peakoff.global.error;

/** 요청한 대상이 없을 때. 404로 변환된다. */
public class NotFoundException extends RuntimeException {

	public NotFoundException(String message) {
		super(message);
	}
}
