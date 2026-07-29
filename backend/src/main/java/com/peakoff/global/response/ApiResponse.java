package com.peakoff.global.response;

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
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, ApiError error) {

	public static <T> ApiResponse<T> ok(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static ApiResponse<Void> fail(ErrorCode code, String message) {
		return new ApiResponse<>(false, null, new ApiError(code.name(), message));
	}

	public record ApiError(String code, String message) {
	}
}
