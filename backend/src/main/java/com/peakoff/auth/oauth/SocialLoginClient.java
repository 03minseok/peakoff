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
	 * 사용자를 보낼 로그인 창 주소를 만든다.
	 *
	 * <p>화면이 이 주소를 직접 조립하지 않게 하려고 서버가 만든다. 주소에는 {@code client_id}와
	 * {@code redirect_uri}가 들어가는데, 화면에서 조립하면 <b>같은 값이 두 곳에 존재</b>하게 된다.
	 * 배포하면서 한쪽만 바꾸면 카카오가 KOE006(Redirect URI 불일치)으로 거절하고,
	 * 원인이 설정 파일과 화면 코드 중 어디인지 찾느라 시간을 쓴다. 값은 한 곳에만 둔다.
	 *
	 * @param state 화면이 만든 임의의 값. 돌아올 때 같은 값인지 확인해
	 *              <b>남이 시작한 로그인</b>이 아님을 가린다
	 */
	String authorizeUrl(String state);

	/**
	 * 인가 코드를 사용자 정보로 바꾼다.
	 *
	 * <p>두 번의 통신이 이 안에서 끝난다. 코드를 토큰으로 바꾸고, 토큰으로 사용자를 조회한다.
	 * 밖에서는 그 과정을 알 필요가 없어 한 메서드로 묶었다 — 중간의 access token이
	 * 바깥으로 새어 나가지 않게 하려는 뜻도 있다. 그 토큰은 여기서 쓰고 버린다.
	 *
	 * @param code  제공자가 redirect로 돌려준 <b>한 번만 쓸 수 있는</b> 인가 코드
	 * @param state 로그인을 시작할 때 화면이 만든 값. <b>네이버는 토큰 요청에도 이 값을 요구한다</b> —
	 *              카카오는 쓰지 않으므로 받고 버린다. 쓰지 않는 쪽에 맞춰 빼면 네이버가 붙지 않고,
	 *              네이버만 다른 메서드를 두면 서비스가 제공자를 구분해 부르게 된다
	 */
	SocialProfile fetchProfile(String code, String state);
}
