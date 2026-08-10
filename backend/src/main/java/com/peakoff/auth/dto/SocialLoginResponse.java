package com.peakoff.auth.dto;

import com.peakoff.member.domain.SocialProvider;

/**
 * 소셜 로그인 결과.
 *
 * <p>끝이 둘이라 상태를 함께 내려보낸다. 로그인이 끝났거나, 기존 계정과 이을지 물어야 하거나.
 * 상태를 두지 않고 "{@code auth}가 있으면 로그인, 없으면 연결"처럼 <b>값의 유무로 추측하게</b>
 * 만들면, 나중에 상태가 하나 늘 때 화면의 판단 기준이 조용히 어긋난다.
 *
 * @param status 아래 {@link Status} 중 하나
 * @param auth   로그인이 끝났을 때의 토큰과 회원 정보. 연결이 필요한 경우엔 {@code null}
 * @param link   연결을 물어야 할 때 화면이 쓸 정보. 로그인이 끝났으면 {@code null}
 */
public record SocialLoginResponse(Status status, AuthResponse auth, LinkCandidate link) {

	public enum Status {
		/** 로그인이 끝났다. 화면은 이메일 로그인과 똑같이 처리하면 된다. */
		LOGGED_IN,
		/** 같은 이메일의 기존 계정이 있다. 비밀번호를 확인해야 이을 수 있다. */
		LINK_REQUIRED
	}

	/**
	 * 연결 확인 화면이 쓰는 정보.
	 *
	 * @param email        기존 계정의 이메일. 화면에 보여 "어느 계정과 잇는지" 알게 한다.
	 *                     제공자가 확인해 준 이메일과 같은 값이라 이 사람이 이미 아는 주소다
	 * @param provider     어느 소셜로 들어왔는가. 문구에 쓴다
	 * @param linkTicket   비밀번호와 함께 돌려보낼 <b>5분짜리</b> 티켓.
	 *                     이것만으로는 로그인되지 않는다 — 비밀번호가 있어야 연결이 성립한다
	 */
	public record LinkCandidate(String email, String provider, String linkTicket) {
	}

	public static SocialLoginResponse loggedIn(AuthResponse auth) {
		return new SocialLoginResponse(Status.LOGGED_IN, auth, null);
	}

	public static SocialLoginResponse linkRequired(String email, SocialProvider provider, String linkTicket) {
		return new SocialLoginResponse(
				Status.LINK_REQUIRED, null, new LinkCandidate(email, provider.displayName(), linkTicket));
	}
}
