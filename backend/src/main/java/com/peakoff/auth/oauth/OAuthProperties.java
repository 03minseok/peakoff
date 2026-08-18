package com.peakoff.auth.oauth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 소셜 로그인 설정. {@code application.yaml}의 {@code peakoff.oauth} 아래 값을 받는다.
 *
 * <p>인증키는 <b>코드나 저장소에 두지 않는다.</b> 환경변수나
 * {@code application-local.yml}(.gitignore 대상)로 넣는다. 카카오 REST API 키가
 * 저장소에 올라가면 남이 우리 앱 이름으로 로그인 창을 띄울 수 있다.
 *
 * @param kakao 카카오 설정. 설정하지 않았으면 빈 값이 들어온다
 * @param naver 네이버 설정. 설정하지 않았으면 빈 값이 들어온다
 */
@ConfigurationProperties(prefix = "peakoff.oauth")
public record OAuthProperties(Registration kakao, Registration naver) {

	/**
	 * 설정 블록이 통째로 없을 때를 대비한다.
	 *
	 * <p>{@code peakoff.oauth.kakao}를 적지 않으면 {@code kakao}가 {@code null}로 들어와,
	 * 서버는 멀쩡히 뜨고 <b>로그인을 누르는 순간</b> NullPointerException이 난다.
	 * 빈 설정으로 채워두면 그 자리에서 "설정이 없다"는 말이 나온다 —
	 * 설정을 안 한 것과 코드가 깨진 것은 구분돼야 한다.
	 */
	public OAuthProperties {
		if (kakao == null) {
			kakao = Registration.empty();
		}
		if (naver == null) {
			naver = Registration.empty();
		}
	}

	/**
	 * 제공자 한 곳의 설정.
	 *
	 * <p>카카오·네이버가 요구하는 값의 모양이 같아서 하나의 타입으로 둔다.
	 * 설정 구조를 두 벌로 갈라두면 제공자가 늘 때마다 읽는 코드도 함께 늘어난다.
	 *
	 * <p>다만 <b>secret이 필수인지는 제공자마다 다르다</b> — 카카오는 선택이고 네이버는 필수다.
	 * 그 판단은 여기가 아니라 각 클라이언트의 {@code isConfigured()}가 한다.
	 * 이 record는 "무엇이 들어 있는가"만 알고, "무엇이 있어야 하는가"는 제공자 쪽 사정이다.
	 *
	 * @param clientId     카카오는 <b>REST API 키</b>(지도에 쓰는 JavaScript 키가 아니다),
	 *                     네이버는 애플리케이션의 Client ID
	 * @param clientSecret 카카오는 선택(콘솔에서 켠 경우에만), 네이버는 필수
	 * @param redirectUri  제공자가 사용자를 되돌려 보낼 주소.
	 *                     <b>콘솔에 등록한 값과 한 글자도 다르면 안 된다</b>
	 */
	public record Registration(String clientId, String clientSecret, String redirectUri) {

		static Registration empty() {
			return new Registration(null, null, null);
		}

		/**
		 * 로그인을 시도해도 되는 상태인가.
		 *
		 * <p>키가 없는 채로 카카오에 요청하면 카카오가 주는 오류 메시지를 사용자가 보게 된다.
		 * 그건 사용자가 고칠 수 있는 문제가 아니라 <b>우리 배포가 덜 된 상태</b>다.
		 * 나가기 전에 여기서 걸러 "우리 잘못"이라고 말할 수 있게 한다.
		 */
		public boolean isConfigured() {
			return isPresent(clientId) && isPresent(redirectUri);
		}

		/**
		 * Client Secret이 채워져 있는가.
		 *
		 * <p>카카오에서는 <b>선택 기능</b>이라, 콘솔에서 켜지 않았으면 토큰 요청에 넣지 않아야 한다.
		 * 빈 값을 넣어 보내면 카카오가 "설정과 다르다"며 거절한다 — 없으면 아예 빼는 것이 맞다.
		 * 네이버에서는 필수라 이 값이 없으면 로그인 자체를 시작하지 않는다.
		 */
		public boolean hasClientSecret() {
			return isPresent(clientSecret);
		}

		private static boolean isPresent(String value) {
			return value != null && !value.isBlank();
		}
	}
}
