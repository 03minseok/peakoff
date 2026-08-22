package com.peakoff.external.kto;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 공사 OpenAPI 설정. {@code application.yaml}의 {@code peakoff.kto} 아래 값을 받는다.
 *
 * <p>인증키는 <b>코드나 저장소에 두지 않는다.</b> 환경변수나
 * {@code application-local.yml}(.gitignore 대상)로 넣는다.
 *
 * @param serviceKey 공공데이터포털 "일반 인증키(Encoding)". <b>이미 URL 인코딩된 값</b>이라
 *                   주소에 그대로 실어 보낸다. 코드에서 한 번 더 인코딩하면 {@code %2B}가
 *                   {@code %252B}가 되어 공사가 다른 키로 읽고 거절한다
 * @param baseUrl    API 호스트. 바꿀 일은 거의 없지만, 공사가 도메인을 옮겼을 때
 *                   코드를 고치지 않고 설정만으로 따라갈 수 있게 열어 둔다
 * @param congestion 한적도를 어디서 가져올지. {@code mock} 또는 {@code real}.
 *                   <b>이 값을 읽는 코드는 없다</b> — {@code @ConditionalOnProperty}가
 *                   빈 등록 단계에서 본다. 여기 적어 두는 것은 설정 항목을 한곳에 모으고
 *                   IDE 자동완성이 듣게 하기 위해서다
 */
@ConfigurationProperties(prefix = "peakoff.kto")
public record KtoProperties(String serviceKey, String baseUrl, String congestion) {

	private static final String DEFAULT_BASE_URL = "https://apis.data.go.kr";

	public KtoProperties {
		if (baseUrl == null || baseUrl.isBlank()) {
			baseUrl = DEFAULT_BASE_URL;
		}
	}

	/**
	 * 인증키가 들어왔는지.
	 *
	 * <p>키가 없을 때 호출을 시도하면 공사는 인증 오류를 돌려주는데, 그 메시지만 보면
	 * "키가 틀렸다"인지 "키를 안 넣었다"인지 구분되지 않는다. 부르기 전에 걸러
	 * <b>우리 설정 문제</b>라고 말할 수 있게 한다.
	 */
	public boolean isConfigured() {
		return serviceKey != null && !serviceKey.isBlank();
	}
}
