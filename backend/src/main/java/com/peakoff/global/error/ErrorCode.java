package com.peakoff.global.error;

import org.springframework.http.HttpStatus;

/**
 * 프론트가 분기에 쓸 수 있는 오류 코드.
 *
 * <p>메시지는 사람이 읽는 용도라 언제든 바뀔 수 있다. 코드로 분기해야 문구를 고쳐도 화면이 안 깨진다.
 */
public enum ErrorCode {

	/** 요청 값이 잘못됐다. 지원하지 않는 지역, 빈 코스, 잘못된 날짜 형식 등. */
	INVALID_REQUEST(HttpStatus.BAD_REQUEST),

	/** 요청한 대상이 없다. 존재하지 않는 장소 ID 등. */
	NOT_FOUND(HttpStatus.NOT_FOUND),

	/**
	 * 로그인이 필요하거나 토큰이 유효하지 않다.
	 *
	 * <p>비밀번호가 틀린 경우도 여기로 온다. "없는 이메일"과 "틀린 비밀번호"를 나눠 알려주면
	 * 어떤 이메일이 가입돼 있는지 확인하는 통로가 된다.
	 */
	UNAUTHORIZED(HttpStatus.UNAUTHORIZED),

	/** 이미 있는 값과 부딪힌다. 가입된 이메일로 다시 가입하려는 경우. */
	CONFLICT(HttpStatus.CONFLICT),

	/** 서버 내부 오류. 원인은 로그에만 남기고 밖으로는 알리지 않는다. */
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

	private final HttpStatus status;

	ErrorCode(HttpStatus status) {
		this.status = status;
	}

	public HttpStatus status() {
		return status;
	}
}
