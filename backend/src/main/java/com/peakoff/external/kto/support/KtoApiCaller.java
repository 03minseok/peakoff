package com.peakoff.external.kto.support;

import java.net.URI;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 공사 OpenAPI를 부르고 응답 본문을 꺼내는 공통 창구.
 *
 * <p>API가 넷이고 전부 같은 함정을 갖고 있어서 한 곳으로 모았다. 클라이언트마다
 * 이 처리를 다시 쓰면 셋 중 하나만 고쳐지는 사고가 난다.
 *
 * <h3>함정 하나 — 인증키를 다시 인코딩하면 안 된다</h3>
 * 포털이 주는 "일반 인증키(Encoding)"는 이미 URL 인코딩된 값이다. 빌더가 한 번 더
 * 인코딩하면 {@code %2B}가 {@code %252B}가 되어 공사가 다른 키로 읽는다.
 * {@code build(true)}가 "이미 인코딩돼 있다"는 선언이다.
 *
 * <h3>함정 둘 — 응답이 세 가지 모양으로 온다</h3>
 * 성공과 실패의 JSON 뿌리가 서로 다르다. 그래서 타입에 바로 매핑하지 않고 트리로 읽는다.
 * <ul>
 *   <li>정상 — {@code response.header.resultCode = "0000"}</li>
 *   <li>파라미터 오류 — 최상위 {@code resultCode} (예: 필수값 누락, 모르는 파라미터)</li>
 *   <li>인증 오류 — {@code OpenAPI_ServiceResponse.cmmMsgHeader.errMsg}</li>
 * </ul>
 * 셋을 구분하지 않으면 "설정을 안 했다"와 "공사가 죽었다"가 같은 오류로 보인다.
 *
 * <h3>함정 셋 — 결과가 없으면 items가 객체가 아니다</h3>
 * 빈 문자열로 오는 경우가 있다(공사 API의 오래된 습관). 트리로 읽으면 예외 없이
 * 빈 노드가 되어, 반복문이 그냥 돌지 않는다.
 */
@Component
public class KtoApiCaller {

	/**
	 * 설정 없는 순수 파서.
	 *
	 * <p>스프링에서 주입받지 않는다. 부트 4에서는 웹 스타터만으로 {@code ObjectMapper} 빈이
	 * 생기지 않고, 무엇보다 남의 응답을 읽는 데 우리 직렬화 설정이 끼어들 이유가 없다.
	 */
	private static final ObjectMapper JSON = new ObjectMapper();

	private static final String SUCCESS_CODE = "0000";

	/** 오류 응답을 로그·메시지에 실을 때 자르는 길이. 응답 전체가 통째로 실리는 것을 막는다. */
	private static final int SNIPPET_LENGTH = 200;

	private final RestClient restClient;
	private final KtoProperties properties;

	public KtoApiCaller(RestClient.Builder builder, KtoProperties properties) {
		this.restClient = builder.build();
		this.properties = properties;
	}

	/**
	 * 호출하고 {@code response.body}를 돌려준다.
	 *
	 * @param path   {@code /B551011/…} 로 시작하는 경로
	 * @param params 인증키와 공통 파라미터를 뺀 나머지.
	 *               <b>값은 ASCII여야 한다</b> — {@code build(true)} 때문에 한글은 미리 인코딩해야 한다
	 */
	public JsonNode body(String path, Map<String, String> params) {
		if (!properties.isConfigured()) {
			throw new KtoApiException("공사 OpenAPI 인증키가 설정되지 않았습니다. "
					+ "환경변수 KTO_SERVICE_KEY 또는 application-local.yml의 peakoff.kto.service-key를 확인하세요.");
		}

		String raw;
		try {
			raw = restClient.get().uri(uriOf(path, params)).retrieve().body(String.class);
		}
		catch (RestClientException e) {
			throw new KtoApiException("공사 OpenAPI 호출에 실패했습니다: " + e.getMessage(), e);
		}

		JsonNode root = readTree(raw);
		failIfAuthError(root);
		failIfParameterError(root);

		JsonNode header = root.path("response").path("header");
		String resultCode = header.path("resultCode").asText("");
		if (!SUCCESS_CODE.equals(resultCode)) {
			throw new KtoApiException("공사 OpenAPI가 오류를 돌려줬습니다. resultCode=%s, resultMsg=%s"
					.formatted(resultCode, header.path("resultMsg").asText("")));
		}
		return root.path("response").path("body");
	}

	/** {@code response.body.items.item}. 결과가 없으면 배열이 아닌 빈 노드다. */
	public JsonNode items(String path, Map<String, String> params) {
		return body(path, params).path("items").path("item");
	}

	private URI uriOf(String path, Map<String, String> params) {
		UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(properties.baseUrl() + path)
				.queryParam("serviceKey", properties.serviceKey())
				.queryParam("MobileOS", "ETC")
				.queryParam("MobileApp", "PEAKOFF")
				.queryParam("_type", "json");
		params.forEach(builder::queryParam);
		return builder.build(true).toUri();
	}

	private static JsonNode readTree(String body) {
		if (body == null || body.isBlank()) {
			throw new KtoApiException("공사 OpenAPI 응답이 비어 있습니다.");
		}
		try {
			return JSON.readTree(body);
		}
		catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException e) {
			// _type=json을 넣어도 오류일 때는 XML로 답하는 경우가 있다. 앞부분을 함께 실어 보낸다.
			throw new KtoApiException("공사 OpenAPI 응답을 JSON으로 읽지 못했습니다. 응답 앞부분: "
					+ snippet(body), e);
		}
	}

	private static String snippet(String body) {
		return body.length() > SNIPPET_LENGTH ? body.substring(0, SNIPPET_LENGTH) + "…" : body;
	}

	/** 인증 실패는 뿌리가 {@code OpenAPI_ServiceResponse}로 통째로 다르다. */
	private static void failIfAuthError(JsonNode root) {
		JsonNode header = root.path("OpenAPI_ServiceResponse").path("cmmMsgHeader");
		if (header.isMissingNode()) {
			return;
		}
		throw new KtoApiException(("공사 OpenAPI 인증에 실패했습니다: %s (%s). "
				+ "공공데이터포털에서 이 API에 활용신청이 되어 있는지 확인하세요 — "
				+ "인증키는 계정당 하나지만 승인은 API마다 따로입니다.")
				.formatted(header.path("errMsg").asText(""), header.path("returnAuthMsg").asText("")));
	}

	/** 필수 파라미터 누락 등은 최상위에 {@code resultCode}가 실려 온다. */
	private static void failIfParameterError(JsonNode root) {
		if (!root.hasNonNull("resultCode")) {
			return;
		}
		String code = root.path("resultCode").asText("");
		if (SUCCESS_CODE.equals(code)) {
			return;
		}
		throw new KtoApiException("공사 OpenAPI 요청이 거절됐습니다. resultCode=%s, resultMsg=%s"
				.formatted(code, root.path("resultMsg").asText("")));
	}
}
