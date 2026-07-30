package com.peakoff.global.response;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.peakoff.global.error.ErrorCode;

/**
 * 모든 API 응답의 겉포장.
 *
 * <p>성공이든 실패든 같은 모양으로 내려가야 프론트에서 처리 분기가 하나로 유지된다.
 * 성공 시 {@code error}가, 실패 시 {@code data}가 빠진다({@code NON_NULL}).
 *
 * <pre>
 * 성공: { "success": true,  "data": { ... } }
 * 실패: { "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
 * 검증: { "success": false, "error": { "code": "INVALID_REQUEST", "message": "...",
 *                                      "fields": [ { "field": "startDate", "message": "..." } ] } }
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, ApiError error) {

	public static <T> ApiResponse<T> ok(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static ApiResponse<Void> fail(ErrorCode code, String message) {
		return new ApiResponse<>(false, null, new ApiError(code.name(), message, null));
	}

	/**
	 * 어떤 입력이 왜 틀렸는지까지 알려주는 실패 응답.
	 *
	 * <p>화면에서 해당 입력칸을 짚어 표시할 수 있게 하려는 것이다.
	 * 메시지 하나만 내려주면 프론트가 문자열을 뜯어봐야 어느 칸인지 알 수 있다.
	 */
	public static ApiResponse<Void> failWithFields(
			ErrorCode code, String message, List<FieldError> fields) {
		return new ApiResponse<>(false, null, new ApiError(code.name(), message, fields));
	}

	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record ApiError(String code, String message, List<FieldError> fields) {
	}

	public record FieldError(String field, String message) {
	}
}
