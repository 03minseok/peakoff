package com.peakoff.global.error;

/**
 * 너무 잦은 호출. 429로 변환된다.
 *
 * <p>다른 오류들과 달리 <b>언제 다시 되는지</b>를 함께 들고 간다. "잠시 후"만 말하면
 * 사용자는 계속 눌러 보는 수밖에 없고, 그 누름이 다시 제한에 걸린다.
 */
public class TooManyRequestsException extends RuntimeException {

	private final long retryAfterSeconds;

	public TooManyRequestsException(String message, long retryAfterSeconds) {
		super(message);
		this.retryAfterSeconds = retryAfterSeconds;
	}

	public long retryAfterSeconds() {
		return retryAfterSeconds;
	}
}
