package com.peakoff.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그인 요청.
 *
 * <p>비밀번호에 <b>길이 규칙을 걸지 않는다.</b> 규칙이 바뀌기 전에 가입한 사람이
 * 자기 비밀번호를 맞게 넣고도 "8자 이상이어야 합니다"에 막히면 로그인할 방법이 사라진다.
 * 비었는지만 보고, 맞고 틀림은 해시 비교가 판단한다.
 */
public record LoginRequest(

		@NotBlank(message = "이메일을 입력해 주세요.")
		String email,

		@NotBlank(message = "비밀번호를 입력해 주세요.")
		String password) {
}
