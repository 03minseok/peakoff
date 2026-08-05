package com.peakoff.global.error;

/** 로그인이 필요하거나 자격 증명이 맞지 않을 때. 401로 변환된다. */
public class UnauthorizedException extends RuntimeException {

	public UnauthorizedException(String message) {
		super(message);
	}
}
