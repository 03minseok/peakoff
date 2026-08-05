package com.peakoff.auth.dto;

import java.time.Instant;

import com.peakoff.member.domain.Member;

/**
 * 화면에 보여줄 회원 정보.
 *
 * <p>엔티티를 그대로 내보내지 않는다. {@code Member}에는 비밀번호 해시가 들어 있어
 * 직렬화 대상이 되는 순간 응답에 섞여 나갈 수 있다. 나갈 값을 여기에 <b>명시적으로 적어두면</b>
 * 엔티티에 필드가 늘어도 응답은 그대로다.
 *
 * <p>이메일을 담는 이유: 설정 화면에서 "어느 계정으로 로그인했는지" 보여줘야 한다.
 * 토큰 안에는 넣지 않았지만(누구나 열어볼 수 있으므로) 인증된 응답 본문에는 담아도 된다.
 */
public record MemberResponse(
		Long id,
		String email,
		String nickname,
		Instant createdAt,
		Instant termsAgreedAt) {

	public static MemberResponse from(Member member) {
		return new MemberResponse(
				member.id(),
				member.email(),
				member.nickname(),
				member.createdAt(),
				member.termsAgreedAt());
	}
}
