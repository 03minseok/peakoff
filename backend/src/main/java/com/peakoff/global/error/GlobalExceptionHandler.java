package com.peakoff.global.error;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.peakoff.external.kto.support.KtoApiException;
import com.peakoff.global.response.ApiResponse;
import com.peakoff.global.response.ApiResponse.FieldError;

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

	@ExceptionHandler(UnauthorizedException.class)
	public ResponseEntity<ApiResponse<Void>> handleUnauthorized(UnauthorizedException e) {
		return toResponse(ErrorCode.UNAUTHORIZED, e.getMessage());
	}

	@ExceptionHandler(ConflictException.class)
	public ResponseEntity<ApiResponse<Void>> handleConflict(ConflictException e) {
		return toResponse(ErrorCode.CONFLICT, e.getMessage());
	}

	/**
	 * 요청 본문(@RequestBody)의 검증 실패.
	 *
	 * <p>어떤 필드가 왜 틀렸는지 함께 내려준다.
	 */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiResponse<Void>> handleBodyValidation(
			MethodArgumentNotValidException e) {

		List<FieldError> fields = e.getBindingResult().getFieldErrors().stream()
				.map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
				.toList();

		// 대표 메시지는 첫 오류를 쓴다. 전부 이어붙이면 화면에 그대로 띄우기 어렵다.
		String message = fields.isEmpty() ? "요청 값이 올바르지 않습니다." : fields.get(0).message();
		return ResponseEntity.status(ErrorCode.INVALID_REQUEST.status())
				.body(ApiResponse.failWithFields(ErrorCode.INVALID_REQUEST, message, fields));
	}

	/**
	 * 쿼리 파라미터·경로 변수의 검증 실패.
	 *
	 * <p>본문 검증과 예외 타입이 다르다. 스프링이 메서드 인자를 직접 검사할 때 던진다.
	 */
	@ExceptionHandler(HandlerMethodValidationException.class)
	public ResponseEntity<ApiResponse<Void>> handleParameterValidation(
			HandlerMethodValidationException e) {

		List<FieldError> fields = e.getParameterValidationResults().stream()
				.flatMap(result -> result.getResolvableErrors().stream()
						.map(error -> new FieldError(
								result.getMethodParameter().getParameterName(),
								error.getDefaultMessage())))
				.toList();

		String message = fields.isEmpty() ? "요청 값이 올바르지 않습니다." : fields.get(0).message();
		return ResponseEntity.status(ErrorCode.INVALID_REQUEST.status())
				.body(ApiResponse.failWithFields(ErrorCode.INVALID_REQUEST, message, fields));
	}

	/**
	 * 잘못된 요청. 도메인 생성자가 던지는 {@link IllegalArgumentException}도 여기로 모인다.
	 *
	 * <p>덕분에 "1박 2일 일정에 5일차 슬롯이 있습니다" 같은 도메인 검증 메시지가
	 * 별도 변환 없이 그대로 400 응답이 된다. 여러 필드를 함께 봐야 하는 규칙은
	 * 검증 애노테이션으로 표현되지 않으므로 이 경로가 계속 필요하다.
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
	 * 공사 OpenAPI에 닿지 못했다. <b>500이 아니라 503이고, 스택을 남기지 않는다.</b>
	 *
	 * <h3>왜 따로 잡는가</h3>
	 * 예전에는 맨 아래 {@code Exception} 핸들러가 받아 "처리하지 못한 예외"로 <b>전체 스택</b>을
	 * 찍었다. 남의 서버가 잠깐 막힌 것을 우리 버그처럼 기록하는 셈이라, 실제로 사고가 났을 때
	 * 로그가 스택 수백 줄로 뒤덮여 <b>진짜 원인을 찾을 수 없었다</b>(2026-08-26, 1,912건).
	 *
	 * <p>예상 가능한 실패다 — 한도 초과, 공사 점검, 네트워크. 한 줄로 남기고 503으로 답한다.
	 * 503은 "지금은 안 되지만 기다리면 된다"는 뜻이라 화면이 다른 말을 할 수 있다.
	 *
	 * <p>⚠️ <b>메시지를 그대로 내보내지 않는다.</b> 공사 응답에 인증키가 섞여 나올 수 있다.
	 */
	@ExceptionHandler(KtoApiException.class)
	public ResponseEntity<ApiResponse<Void>> handleExternalUnavailable(KtoApiException e) {
		log.warn("공사 OpenAPI에 닿지 못했습니다: {}", e.getMessage());
		return toResponse(ErrorCode.EXTERNAL_UNAVAILABLE,
				"공공데이터를 불러오지 못했어요.\n잠시 후 다시 시도해 주세요.");
	}

	/**
	 * 그런 경로가 없다.
	 *
	 * <p><b>예전에는 500이었다.</b> 이 예외를 잡는 곳이 없어 아래 {@code Exception} 처리기로
	 * 떨어졌고, 화면에는 "일시적인 오류가 발생했습니다"가 떴다. 주소를 잘못 친 것뿐인데
	 * <b>서버가 깨진 것처럼 보인다</b> — 실제로 개발 중에 이것 때문에
	 * "새 엔드포인트가 있는지"를 판별하지 못해 한참 헤맸다.
	 *
	 * <p>로그도 남기지 않는다. 없는 주소를 부르는 것은 <b>우리 잘못이 아니라</b>
	 * 흔한 일이고, 로그에 쌓이면 정작 봐야 할 오류가 묻힌다.
	 *
	 * <p>화면 주소({@code /course} 같은 것)는 여기까지 오지 않는다. 프론트는 Vercel이
	 * 서빙하고 그쪽이 SPA 라우팅을 맡는다 — 이 서버는 API만 답한다.
	 */
	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException e) {
		return toResponse(ErrorCode.NOT_FOUND, "요청하신 주소를 찾을 수 없습니다.");
	}

	/**
	 * 예상 못한 오류. <b>원인은 로그에만 남기고 밖으로는 알리지 않는다.</b>
	 * 스택트레이스나 내부 메시지가 그대로 나가면 서버 구조가 노출된다.
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
		log.error("처리하지 못한 예외", e);
		return toResponse(ErrorCode.INTERNAL_ERROR, "일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.");
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
