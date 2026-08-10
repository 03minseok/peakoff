package com.peakoff.auth.dto;

import com.peakoff.member.domain.Member;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 닉네임 변경 요청.
 *
 * <p><b>현재 비밀번호를 받지 않는다.</b> 비밀번호 변경·탈퇴와 달리 닉네임은 언제든 되돌릴 수 있고,
 * 남이 몰래 바꿔도 계정을 잃지 않는다. 되돌릴 수 없는 일에만 재확인을 건다 —
 * 모든 변경에 비밀번호를 물으면 사용자는 그 창을 읽지 않고 넘기는 법을 배운다.
 */
public record ChangeNicknameRequest(

		@NotBlank(message = "닉네임을 입력해 주세요.")
		@Size(max = Member.NICKNAME_MAX_LENGTH,
				message = "닉네임은 " + Member.NICKNAME_MAX_LENGTH + "자 이하여야 합니다.")
		String nickname) {
}
