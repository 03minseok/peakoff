package com.peakoff.external.kto;

/**
 * 공사 OpenAPI를 부르지 못했거나, 부르긴 했는데 쓸 수 없는 답이 왔을 때.
 *
 * <p><b>이 예외를 삼켜서 빈 결과로 바꾸지 않는다.</b> 외부 API가 잠깐 죽은 것과
 * "그 장소는 예측 자료가 없다"는 전혀 다른 사실인데, 빈 결과로 뭉개면 화면에서 같아 보인다.
 * 사용자에게는 "지금 자료를 불러오지 못했다"고 말해야 다시 시도할 수 있다.
 *
 * <p>공모전 규칙과도 닿아 있다 — 호출이 실패했다고 임의의 값으로 추천을 만들어 내면
 * 계산하지 않은 것을 근거로 말하게 된다.
 *
 * <p>도메인 오류가 아니라 바깥 세계의 사고이므로 {@code global/error}의 예외들과 섞지 않는다.
 * 처리되지 않으면 공통 예외 처리기가 500으로 답한다.
 */
public class KtoApiException extends RuntimeException {

	public KtoApiException(String message) {
		super(message);
	}

	public KtoApiException(String message, Throwable cause) {
		super(message, cause);
	}
}
