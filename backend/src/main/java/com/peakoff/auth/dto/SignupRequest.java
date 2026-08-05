package com.peakoff.auth.dto;

import com.peakoff.member.domain.Member;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청.
 *
 * <p>애노테이션은 <b>필드 하나만 보고 판단할 수 있는 것</b>만 검사한다.
 * "비밀번호와 확인이 같은가"처럼 두 필드를 함께 봐야 하는 규칙은 {@code AuthService}가 맡는다.
 *
 * @param password        최소 길이만 강제한다. 대문자·기호 조합까지 요구하면 사용자는 규칙을
 *                        통과하는 가장 짧은 비밀번호를 만들 뿐이고 그게 더 안전하지도 않다.
 *                        강도는 화면에서 막대로 안내한다
 * @param passwordConfirm 오타로 잘못된 비밀번호가 저장되는 것을 막는 용도. 저장하지 않는다
 * @param termsAgreed     필수 약관 동의. {@code @AssertTrue}라 false면 요청이 거절된다
 */
public record SignupRequest(

		@NotBlank(message = "이메일을 입력해 주세요.")
		@Email(message = "이메일 형식이 올바르지 않습니다.")
		@Size(max = 320, message = "이메일이 너무 깁니다.")
		String email,

		@NotBlank(message = "비밀번호를 입력해 주세요.")
		@Size(min = PASSWORD_MIN_LENGTH, max = PASSWORD_MAX_LENGTH,
				message = "비밀번호는 " + PASSWORD_MIN_LENGTH + "자 이상이어야 합니다.")
		String password,

		@NotBlank(message = "비밀번호를 한 번 더 입력해 주세요.")
		String passwordConfirm,

		@NotBlank(message = "닉네임을 입력해 주세요.")
		@Size(max = Member.NICKNAME_MAX_LENGTH,
				message = "닉네임은 " + Member.NICKNAME_MAX_LENGTH + "자 이하여야 합니다.")
		String nickname,

		@AssertTrue(message = "필수 약관에 동의해야 가입할 수 있습니다.")
		boolean termsAgreed) {

	public static final int PASSWORD_MIN_LENGTH = 8;

	/**
	 * BCrypt는 72바이트를 넘는 부분을 잘라낸다.
	 *
	 * <p>상한을 두지 않으면 73자와 100자 비밀번호가 같은 것으로 취급되는데,
	 * 사용자는 더 긴 쪽이 더 안전하다고 믿는다. 그 착각이 생기지 않게 미리 막는다.
	 */
	public static final int PASSWORD_MAX_LENGTH = 72;

	public boolean passwordMatchesConfirm() {
		return password != null && password.equals(passwordConfirm);
	}
}
