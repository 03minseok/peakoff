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
 * 카카오와의 통신.
 *
 * <h3>왜 서버가 하는가</h3>
 * 인가 코드를 토큰으로 바꾸려면 <b>client secret</b>이 필요할 수 있고, 무엇보다 이 교환에
 * 성공하면 그 사람의 카카오 정보를 읽을 수 있는 열쇠가 나온다. 브라우저에서 하면
 * 그 열쇠가 사용자 화면에 남는다. 서버에서 받아 쓰고 버리면 어디에도 남지 않는다.
 *
 * <h3>인가 코드는 한 번만 쓸 수 있다</h3>
 * 같은 코드로 두 번 요청하면 카카오가 거절한다(KOE320). 화면이 콜백에서 요청을 두 번 보내면
 * 첫 번째는 성공하고 두 번째가 실패해, 사용자에게는 "로그인 실패"로 보인다.
 * 프론트에서 중복 호출을 막아야 하는 이유가 여기 있다.
 */
@Component
public class KakaoLoginClient implements SocialLoginClient {

	private static final Logger log = LoggerFactory.getLogger(KakaoLoginClient.class);

	/** 사용자를 보내는 로그인·동의 화면. */
	private static final String AUTHORIZE_URI = "https://kauth.kakao.com/oauth/authorize";
	/** 인가 코드를 토큰으로 바꾸는 곳. 로그인 창을 띄우는 도메인(kauth)이다. */
	private static final String TOKEN_URI = "https://kauth.kakao.com/oauth/token";
	/** 토큰으로 사용자를 조회하는 곳. 자료를 읽는 도메인(kapi)이라 주소가 다르다. */
	private static final String USER_URI = "https://kapi.kakao.com/v2/user/me";

	/** 이름을 못 받았을 때 쓸 값. 빈 이름으로 계정을 만들면 화면 곳곳이 빈자리가 된다. */
	private static final String FALLBACK_NICKNAME = "카카오 사용자";

	private final RestClient restClient;
	private final OAuthProperties.Registration registration;

	/**
	 * {@code RestClient.Builder}를 주입받는다.
	 *
	 * <p>{@code new RestClient()}를 직접 만들지 않는 이유: 스프링이 준비한 빌더에는
	 * 타임아웃·메시지 컨버터 같은 공통 설정이 이미 얹혀 있다. 직접 만들면 그 설정을 놓치고,
	 * 나중에 타임아웃을 넣을 때 손댈 자리가 코드 곳곳으로 흩어진다.
	 */
	public KakaoLoginClient(RestClient.Builder builder, OAuthProperties properties) {
		this.restClient = builder.build();
		this.registration = properties.kakao();
	}

	@Override
	public SocialProvider provider() {
		return SocialProvider.KAKAO;
	}

	@Override
	public boolean isConfigured() {
		return registration.isConfigured();
	}

	/**
	 * 로그인 창 주소.
	 *
	 * <p>{@code UriComponentsBuilder}로 만드는 이유: 값을 문자열로 이어 붙이면 주소에 못 들어가는
	 * 문자(콜론·슬래시 등)를 손으로 바꿔야 한다. redirect_uri에는 그런 문자가 잔뜩 들어 있어,
	 * 한 번 빠뜨리면 카카오가 다른 주소로 읽고 거절한다.
	 *
	 * <p>{@code scope}를 적지 않는다. 무엇을 받을지는 <b>콘솔의 동의항목</b>이 정하고 있어,
	 * 여기 또 적으면 두 곳이 어긋날 수 있다. 콘솔에서 닉네임만 켜뒀으므로 닉네임만 온다.
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

	/**
	 * {@code state}를 받고 쓰지 않는다.
	 *
	 * <p>카카오는 토큰 교환에 그 값을 요구하지 않는다. 인터페이스에 있는 것은 네이버 사정이다 —
	 * 자세한 이유는 {@link SocialLoginClient#fetchProfile}에 적어 두었다.
	 */
	@Override
	public SocialProfile fetchProfile(String code, String state) {
		String accessToken = exchangeCodeForToken(code);
		return fetchUser(accessToken);
	}

	/**
	 * 1단계 — 인가 코드를 access token으로 바꾼다.
	 *
	 * <p>{@code redirect_uri}를 <b>다시</b> 보내는 것이 이상해 보이지만 필요하다. 카카오는
	 * 코드를 발급할 때 쓴 주소와 지금 보낸 주소가 같은지 대조한다. 코드를 가로챈 쪽이
	 * 자기 주소로 토큰을 받아 가지 못하게 하는 장치다. 그래서 콘솔 등록값·로그인 요청·이 요청
	 * 세 곳의 주소가 <b>모두 같아야</b> 한다.
	 */
	private String exchangeCodeForToken(String code) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("grant_type", "authorization_code");
		form.add("client_id", registration.clientId());
		form.add("redirect_uri", registration.redirectUri());
		form.add("code", code);
		if (registration.hasClientSecret()) {
			// 콘솔에서 켠 경우에만 넣는다. 켜지 않았는데 보내면 카카오가 거절한다.
			form.add("client_secret", registration.clientSecret());
		}

		KakaoTokenResponse response = restClient.post()
				.uri(TOKEN_URI)
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.body(form)
				.retrieve()
				.onStatus(HttpStatusCode::isError, (request, res) -> {
					/*
					 * 카카오의 오류 본문에는 원인 코드(KOE006, KOE320 등)가 들어 있다.
					 * 로그에는 그대로 남기고 사용자에게는 짧게 말한다 — 사용자가 KOE 코드를
					 * 보고 할 수 있는 일이 없고, 우리 설정 상태를 밖에 알릴 이유도 없다.
					 */
					log.warn("카카오 토큰 교환 실패 status={} body={}", res.getStatusCode(), readBody(res));
					throw new UnauthorizedException("카카오 로그인에 실패했어요.\n다시 시도해 주세요.");
				})
				.body(KakaoTokenResponse.class);

		if (response == null || response.accessToken() == null) {
			log.warn("카카오 토큰 응답에 access_token이 없다");
			throw new UnauthorizedException("카카오 로그인에 실패했어요.\n다시 시도해 주세요.");
		}
		return response.accessToken();
	}

	/**
	 * 2단계 — 토큰으로 "이 사람이 누구인지" 묻는다.
	 *
	 * <p>돌려받는 것 중 우리가 쓰는 것은 고유 번호와 닉네임, 그리고 (있으면) 이메일뿐이다.
	 * 카카오가 더 많이 주더라도 담지 않는다 — 담을 곳이 없으면 샐 곳도 없다.
	 */
	private SocialProfile fetchUser(String accessToken) {
		KakaoUserResponse user = restClient.get()
				.uri(USER_URI)
				.header("Authorization", "Bearer " + accessToken)
				.retrieve()
				.onStatus(HttpStatusCode::isError, (request, res) -> {
					log.warn("카카오 사용자 조회 실패 status={} body={}", res.getStatusCode(), readBody(res));
					throw new UnauthorizedException("카카오 로그인에 실패했어요.\n다시 시도해 주세요.");
				})
				.body(KakaoUserResponse.class);

		if (user == null || user.id() == null) {
			log.warn("카카오 사용자 응답에 id가 없다");
			throw new UnauthorizedException("카카오 로그인에 실패했어요.\n다시 시도해 주세요.");
		}

		KakaoAccount account = user.kakaoAccount();
		String nickname = account == null || account.profile() == null ? null : account.profile().nickname();

		/*
		 * 이메일은 "받았다"와 "확인된 값이다"가 다르다.
		 *
		 * 동의항목에서 이메일을 켜지 않았으면 계정 정보 자체가 비어 온다. 켰더라도 사용자가
		 * 동의를 빼면 마찬가지다. 확인 여부(is_email_verified)까지 함께 들고 나가는 이유는,
		 * 기존 계정을 찾는 판단이 그 값에 걸려 있기 때문이다.
		 */
		String email = account == null ? null : account.email();
		boolean emailVerified = account != null && Boolean.TRUE.equals(account.emailVerified());

		return new SocialProfile(
				SocialProvider.KAKAO,
				// 카카오는 숫자로 주지만 우리는 문자열로 통일한다(네이버는 문자열을 준다).
				String.valueOf(user.id()),
				nickname == null || nickname.isBlank() ? FALLBACK_NICKNAME : nickname,
				email,
				emailVerified);
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
	 * 카카오 응답 중 <b>우리가 쓰는 것만</b> 적는다.
	 *
	 * <p>스프링 부트의 기본 설정은 모르는 필드를 무시하므로, 카카오가 필드를 더 얹어도
	 * 깨지지 않는다. 반대로 여기 다 적어두면 카카오가 필드를 하나 뺄 때마다 우리가 고쳐야 한다.
	 */
	private record KakaoTokenResponse(@JsonProperty("access_token") String accessToken) {
	}

	private record KakaoUserResponse(Long id, @JsonProperty("kakao_account") KakaoAccount kakaoAccount) {
	}

	private record KakaoAccount(
			String email,
			@JsonProperty("is_email_verified") Boolean emailVerified,
			KakaoProfile profile) {
	}

	private record KakaoProfile(String nickname) {
	}
}
