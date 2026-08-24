package com.peakoff.auth.oauth;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.SocialProvider;

/**
 * 네이버와의 통신.
 *
 * <p>흐름은 카카오와 같다 — 인가 코드를 토큰으로 바꾸고, 토큰으로 사용자를 조회한다.
 * 서버가 이 일을 맡는 이유도 같아서 {@link KakaoLoginClient}의 설명을 그대로 따른다.
 * 여기서는 <b>네이버라서 다른 것</b>만 적는다.
 *
 * <h3>네이버라서 다른 것 셋</h3>
 * <ol>
 *   <li><b>Client Secret이 필수다.</b> 카카오는 콘솔에서 켠 경우에만 보내지만,
 *       네이버는 없으면 토큰 교환 자체가 되지 않는다</li>
 *   <li><b>토큰 요청에도 {@code state}를 실어야 한다.</b> 그래서 인가 코드만으로는 부족하고,
 *       화면이 만든 state가 서버까지 와야 한다</li>
 *   <li><b>실패해도 HTTP 200으로 답한다.</b> 상태 코드만 보면 성공으로 읽힌다 —
 *       본문을 열어봐야 실패인 줄 안다. 아래 두 메서드가 그것을 확인한다</li>
 * </ol>
 */
@Component
public class NaverLoginClient implements SocialLoginClient {

	private static final Logger log = LoggerFactory.getLogger(NaverLoginClient.class);

	/** 사용자를 보내는 로그인·동의 화면. */
	private static final String AUTHORIZE_URI = "https://nid.naver.com/oauth2.0/authorize";
	/** 인가 코드를 토큰으로 바꾸는 곳. 로그인 창과 같은 도메인(nid)이다. */
	private static final String TOKEN_URI = "https://nid.naver.com/oauth2.0/token";
	/** 토큰으로 사용자를 조회하는 곳. 오픈API 도메인이라 주소가 다르다. */
	private static final String USER_URI = "https://openapi.naver.com/v1/nid/me";

	/** 사용자 조회가 성공했을 때의 결과 코드. 이 값이 아니면 실패다. */
	private static final String RESULT_OK = "00";

	/** 이름을 못 받았을 때 쓸 값. 빈 이름으로 계정을 만들면 화면 곳곳이 빈자리가 된다. */
	private static final String FALLBACK_NICKNAME = "네이버 사용자";

	private final RestClient restClient;
	private final OAuthProperties.Registration registration;

	public NaverLoginClient(RestClient.Builder builder, OAuthProperties properties) {
		this.restClient = builder.build();
		this.registration = properties.naver();
	}

	@Override
	public SocialProvider provider() {
		return SocialProvider.NAVER;
	}

	/**
	 * 네이버는 <b>Client Secret까지 있어야</b> 시작할 수 있다.
	 *
	 * <p>카카오와 달리 선택 항목이 아니라, 없으면 토큰 교환에서 반드시 막힌다.
	 * 그 실패는 사용자 화면에서 "로그인 실패"로만 보여 원인을 짐작할 수 없으므로,
	 * 나가기 전에 여기서 걸러 우리 설정 문제임을 로그에 남긴다.
	 */
	@Override
	public boolean isConfigured() {
		return registration.isConfigured() && registration.hasClientSecret();
	}

	/**
	 * 로그인 창 주소.
	 *
	 * <p>{@code scope}를 적지 않는 것도 카카오와 같다. 무엇을 받을지는 <b>네이버 개발자센터의
	 * 제공 정보 설정</b>이 정하고 있어, 여기 또 적으면 두 곳이 어긋난다.
	 */
	@Override
	public String authorizeUrl(String state) {
		return UriComponentsBuilder.fromUriString(AUTHORIZE_URI)
				.queryParam("client_id", registration.clientId())
				.queryParam("redirect_uri", registration.redirectUri())
				.queryParam("response_type", "code")
				.queryParam("state", state)
				.encode(StandardCharsets.UTF_8)
				.build()
				.toUriString();
	}

	@Override
	public SocialProfile fetchProfile(String code, String state) {
		String accessToken = exchangeCodeForToken(code, state);
		return fetchUser(accessToken);
	}

	/**
	 * 1단계 — 인가 코드를 access token으로 바꾼다.
	 *
	 * <p>카카오와 달리 {@code redirect_uri}가 아니라 {@code state}를 함께 보낸다.
	 * 네이버가 요구하는 값이 그렇다 — 로그인을 시작할 때 실어 보낸 값과 같은지 대조한다.
	 *
	 * <p>네이버는 <b>실패를 200으로 답한다.</b> 본문에 {@code error}가 들어오는 식이라,
	 * 상태 코드만 확인하면 토큰이 {@code null}인 채로 다음 단계까지 흘러가 엉뚱한 곳에서 터진다.
	 * 상태 코드와 본문을 둘 다 본다.
	 */
	private String exchangeCodeForToken(String code, String state) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("grant_type", "authorization_code");
		form.add("client_id", registration.clientId());
		form.add("client_secret", registration.clientSecret());
		form.add("code", code);
		form.add("state", state);

		NaverTokenResponse response = restClient.post()
				.uri(TOKEN_URI)
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.body(form)
				.retrieve()
				.onStatus(HttpStatusCode::isError, (request, res) -> {
					/*
					 * 원인은 로그에만 남긴다. 사용자에게 네이버의 오류 코드를 보여줘도 할 수 있는
					 * 일이 없고, 우리 설정 상태를 밖에 알릴 이유도 없다.
					 */
					log.warn("네이버 토큰 교환 실패 status={} body={}", res.getStatusCode(), readBody(res));
					throw fail();
				})
				.body(NaverTokenResponse.class);

		if (response == null || response.accessToken() == null) {
			// 200으로 온 실패가 여기 걸린다. 본문의 error를 함께 남겨야 원인을 알 수 있다.
			log.warn("네이버 토큰 응답에 access_token이 없다 error={} description={}",
					response == null ? null : response.error(),
					response == null ? null : response.errorDescription());
			throw fail();
		}
		return response.accessToken();
	}

	/**
	 * 2단계 — 토큰으로 "이 사람이 누구인지" 묻는다.
	 *
	 * <p>여기서도 실패가 200으로 온다. 본문의 {@code resultcode}가 "00"이 아니면 실패다.
	 *
	 * <h3>이메일을 확인된 값으로 취급하는 이유</h3>
	 * 카카오는 {@code is_email_verified}를 함께 주지만 네이버는 그런 표시가 없다.
	 * 네이버는 <b>가입 단계에서 이메일을 인증</b>하기 때문에 따로 표시할 것이 없어서다.
	 *
	 * <p>이 판단이 틀렸다고 해도 계정을 빼앗기는 길은 열리지 않는다. 이메일이 같아 기존 계정을
	 * 찾더라도 곧바로 잇지 않고 <b>비밀번호를 묻기</b> 때문이다({@code SocialLoginService} 참고).
	 * 남는 위험은 "우리가 남의 주소를 대신 차지할 수 있다"는 것뿐인데, 그 대가로 네이버 사용자도
	 * 이미 쓰던 계정에 로그인 수단을 붙일 수 있게 된다.
	 */
	private SocialProfile fetchUser(String accessToken) {
		NaverUserResponse user = restClient.get()
				.uri(USER_URI)
				.header("Authorization", "Bearer " + accessToken)
				.retrieve()
				.onStatus(HttpStatusCode::isError, (request, res) -> {
					log.warn("네이버 사용자 조회 실패 status={} body={}", res.getStatusCode(), readBody(res));
					throw fail();
				})
				.body(NaverUserResponse.class);

		if (user == null || !RESULT_OK.equals(user.resultCode()) || user.response() == null
				|| user.response().id() == null) {
			log.warn("네이버 사용자 응답이 온전하지 않다 resultcode={} message={}",
					user == null ? null : user.resultCode(),
					user == null ? null : user.message());
			throw fail();
		}

		NaverAccount account = user.response();
		String nickname = account.nickname();

		return new SocialProfile(
				SocialProvider.NAVER,
				account.id(),
				nickname == null || nickname.isBlank() ? FALLBACK_NICKNAME : nickname,
				account.email(),
				// 위 주석 참고. 네이버가 준 이메일은 가입 때 인증을 거친 주소로 본다.
				account.email() != null && !account.email().isBlank());
	}

	/**
	 * 사용자에게 나갈 말은 어디서 실패했든 하나다.
	 *
	 * <p>단계별로 다르게 말해봐야 사용자가 할 일은 "다시 시도"뿐이고,
	 * 어디서 막혔는지는 우리 설정을 알려주는 정보가 된다. 원인은 로그가 들고 있다.
	 */
	private static UnauthorizedException fail() {
		return new UnauthorizedException("네이버 로그인에 실패했어요.\n다시 시도해 주세요.");
	}

	/** 오류 본문을 로그용 문자열로. 읽다 실패해도 원래 오류를 덮지 않도록 삼킨다. */
	private static String readBody(org.springframework.http.client.ClientHttpResponse response) {
		try {
			return new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException e) {
			return "(본문을 읽지 못함)";
		}
	}

	/**
	 * 네이버 응답 중 <b>우리가 쓰는 것만</b> 적는다.
	 *
	 * <p>{@code error}까지 담는 이유는 성공 응답에 없는 값이라서다 — 200으로 온 실패를
	 * 로그에서 구분하려면 이 두 칸이 있어야 한다.
	 */
	private record NaverTokenResponse(
			@JsonProperty("access_token") String accessToken,
			String error,
			@JsonProperty("error_description") String errorDescription) {
	}

	/**
	 * 사용자 조회 응답. 실제 정보는 {@code response} 안에 한 겹 들어 있다.
	 *
	 * <p>바깥의 {@code resultcode}·{@code message}는 성공 여부를 알리는 자리다.
	 */
	private record NaverUserResponse(
			@JsonProperty("resultcode") String resultCode,
			String message,
			NaverAccount response) {
	}

	/**
	 * 네이버가 매긴 고유 식별자는 <b>문자열</b>이다(카카오는 숫자다).
	 *
	 * <p>이름(name)은 받지 않는다. 화면에 쓸 이름은 별명이면 충분하고,
	 * 실명을 담아둘 자리를 만들면 그만큼 샐 자리도 생긴다.
	 */
	private record NaverAccount(String id, String nickname, String email) {
	}
}
