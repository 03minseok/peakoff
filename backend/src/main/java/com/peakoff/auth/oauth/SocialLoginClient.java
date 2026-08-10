package com.peakoff.auth.oauth;

import com.peakoff.member.domain.SocialProvider;

/**
 * 소셜 제공자와 대화하는 창구.
 *
 * <p>인터페이스로 둔 이유는 {@code CongestionProvider}·{@code PlaceProvider}와 같다 —
 * 바깥 서비스와 통신하는 방법은 그쪽 사정이고, 우리 로그인 로직이 요구하는 것은
 * "인가 코드를 주면 누구인지 알려준다" 하나뿐이다. 네이버를 붙일 때 이 인터페이스를
 * 하나 더 구현하면 되고, 회원을 찾고 만드는 코드는 손대지 않는다.
 */
public interface SocialLoginClient {

	/** 이 클라이언트가 맡는 제공자. 서비스가 여러 구현체 중 하나를 고를 때 쓴다. */
	SocialProvider provider();

	/**
	 * 인증키가 채워져 있는가.
	 *
	 * <p>배포에 키를 안 넣은 채 버튼만 살아 있으면, 사용자는 제공자 쪽 오류 화면을 본다.
	 * 그건 사용자가 어떻게 해볼 수 있는 문제가 아니므로 미리 갈라 우리 말로 알린다.
	 */
	boolean isConfigured();

	/**
	 * 인가 코드를 사용자 정보로 바꾼다.
	 *
	 * <p>두 번의 통신이 이 안에서 끝난다. 코드를 토큰으로 바꾸고, 토큰으로 사용자를 조회한다.
	 * 밖에서는 그 과정을 알 필요가 없어 한 메서드로 묶었다 — 중간의 access token이
	 * 바깥으로 새어 나가지 않게 하려는 뜻도 있다. 그 토큰은 여기서 쓰고 버린다.
	 *
	 * @param code 제공자가 redirect로 돌려준 <b>한 번만 쓸 수 있는</b> 인가 코드
	 */
	SocialProfile fetchProfile(String code);
}
