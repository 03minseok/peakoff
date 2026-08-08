package com.peakoff.auth.dto;

import com.peakoff.member.domain.Member;

/**
 * 가입·로그인 성공 응답.
 *
 * <p>토큰과 회원 정보를 함께 내려보낸다. 토큰만 주면 화면이 닉네임을 얻으려고
 * 곧바로 {@code /api/auth/me}를 한 번 더 불러야 한다.
 *
 * <p><b>이메일과 비밀번호 해시는 담지 않는다.</b> 화면이 쓰는 것은 닉네임뿐이고,
 * 응답에 담긴 값은 브라우저 개발자 도구에 그대로 남는다.
 *
 * @param expiresInSeconds 토큰 유효 기간. 화면이 만료 시점을 계산해 미리 로그아웃 처리할 수 있다
 */
public record AuthResponse(String token, long expiresInSeconds, MemberResponse member) {

	public static AuthResponse of(String token, long expiresInSeconds, Member member) {
		return new AuthResponse(token, expiresInSeconds, MemberResponse.from(member));
	}
}
