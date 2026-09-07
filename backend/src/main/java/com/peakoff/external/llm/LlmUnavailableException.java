package com.peakoff.external.llm;

/**
 * LLM에 닿지 못했다. <b>이 예외는 화면까지 올라가지 않는다.</b>
 *
 * <p>다른 예외들과 쓰임이 다르다. {@code KtoApiException}은 화면에 "잠시 후 다시"라고
 * 말해 주지만, 이쪽은 <b>부르는 쪽이 받아서 조용히 폴백한다.</b> 사용자는 챗봇이
 * 실패했다는 사실을 알 필요가 없다 — 서버가 만든 문장이나 기존 설문으로 넘어가면 된다.
 *
 * <p>그래서 {@code GlobalExceptionHandler}에 이것을 위한 자리를 두지 않았다.
 * 자리를 두면 언젠가 이 예외가 500이나 503으로 화면에 뜨게 된다.
 */
public class LlmUnavailableException extends RuntimeException {

	public LlmUnavailableException(String message) {
		super(message);
	}

	public LlmUnavailableException(String message, Throwable cause) {
		super(message, cause);
	}
}
