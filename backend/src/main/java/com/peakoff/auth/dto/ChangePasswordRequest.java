package com.peakoff.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 변경 요청.
 *
 * <p><b>현재 비밀번호를 함께 받는다.</b> 토큰만으로 통과시키면, 자리를 비운 사이 브라우저를
 * 만진 사람이 비밀번호를 바꿔 계정을 통째로 가져갈 수 있다. 토큰은 "이 브라우저가 로그인했다"는
 * 증거일 뿐 "지금 앉아 있는 사람이 본인이다"는 증거가 아니다.
 *
 * <p>길이 규칙을 여기 다시 적지 않고 {@link SignupRequest}의 상수를 가리킨다.
 * 같은 값을 두 곳에 적으면 정책이 바뀔 때 한쪽만 고쳐져, 가입은 되는데 변경은 막히는
 * (또는 그 반대의) 상태가 만들어진다.
 *
 * @param newPasswordConfirm 오타로 모르는 비밀번호가 저장되는 것을 막는 용도. 저장하지 않는다
 */
public record ChangePasswordRequest(

		@NotBlank(message = "현재 비밀번호를 입력해 주세요.")
		String currentPassword,

		@NotBlank(message = "새 비밀번호를 입력해 주세요.")
		@Size(min = SignupRequest.PASSWORD_MIN_LENGTH, max = SignupRequest.PASSWORD_MAX_LENGTH,
				message = "비밀번호는 " + SignupRequest.PASSWORD_MIN_LENGTH + "자 이상이어야 합니다.")
		String newPassword,

		@NotBlank(message = "새 비밀번호를 한 번 더 입력해 주세요.")
		String newPasswordConfirm) {

	public boolean newPasswordMatchesConfirm() {
		return newPassword != null && newPassword.equals(newPasswordConfirm);
	}
}
