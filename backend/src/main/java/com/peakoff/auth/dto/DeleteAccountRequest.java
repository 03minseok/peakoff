package com.peakoff.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 회원 탈퇴 요청.
 *
 * <p>비밀번호를 받는 이유는 두 가지다. 되돌릴 수 없는 일이라 실수로 누르는 것을 막아야 하고,
 * 자리를 비운 사이 남이 계정을 지우는 것도 막아야 한다.
 * "탈퇴"라고 타이핑하게 하는 방식은 앞의 하나만 막는다.
 *
 * <p>{@link LoginRequest}와 같은 이유로 <b>길이 규칙을 걸지 않는다.</b> 규칙이 바뀌기 전에
 * 가입한 사람이 자기 비밀번호를 맞게 넣고도 형식에 막히면 탈퇴할 방법이 사라진다.
 */
public record DeleteAccountRequest(

		@NotBlank(message = "비밀번호를 입력해 주세요.")
		String password) {
}
