package com.peakoff.global.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.peakoff.global.response.ApiResponse;

/**
 * 모든 컨트롤러의 예외를 한 곳에서 응답으로 바꾼다.
 *
 * <p>컨트롤러마다 try-catch를 흩뿌리지 않기 위한 장치다.
 * 서비스는 상황에 맞는 예외를 던지기만 하고, 어떤 상태 코드로 나갈지는 여기서 결정한다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(NotFoundException.class)
	public ResponseEntity<ApiResponse<Void>> handleNotFound(NotFoundException e) {
		return toResponse(ErrorCode.NOT_FOUND, e.getMessage());
	}

	/**
	 * 잘못된 요청. 도메인 생성자가 던지는 {@link IllegalArgumentException}도 여기로 모인다.
	 *
	 * <p>덕분에 "한적도는 0~100 범위여야 합니다" 같은 도메인 검증 메시지가
	 * 별도 변환 없이 그대로 400 응답이 된다.
	 */
	@ExceptionHandler({
			IllegalArgumentException.class,
			HttpMessageNotReadableException.class,
			MissingServletRequestParameterException.class,
			MethodArgumentTypeMismatchException.class })
	public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception e) {
		return toResponse(ErrorCode.INVALID_REQUEST, readableMessage(e));
	}

	/**
	 * 예상 못한 오류. <b>원인은 로그에만 남기고 밖으로는 알리지 않는다.</b>
	 * 스택트레이스나 내부 메시지가 그대로 나가면 서버 구조가 노출된다.
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
		log.error("처리하지 못한 예외", e);
		return toResponse(ErrorCode.INTERNAL_ERROR, "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
	}

	private static String readableMessage(Exception e) {
		if (e instanceof HttpMessageNotReadableException) {
			// 파싱 실패 원문에는 자바 타입명이 섞여 있어 사용자에게 보여줄 수 없다.
			return "요청 형식이 올바르지 않습니다.";
		}
		if (e instanceof MethodArgumentTypeMismatchException mismatch) {
			return "%s 값의 형식이 올바르지 않습니다.".formatted(mismatch.getName());
		}
		if (e instanceof MissingServletRequestParameterException missing) {
			return "%s 값이 필요합니다.".formatted(missing.getParameterName());
		}
		return e.getMessage();
	}

	private static ResponseEntity<ApiResponse<Void>> toResponse(ErrorCode code, String message) {
		return ResponseEntity.status(code.status()).body(ApiResponse.fail(code, message));
	}
}
