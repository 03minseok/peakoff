package com.peakoff.external.kto.support;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
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

	/**
	 * 연결을 기다리는 시간. <b>공사가 침묵할 때 걸리는 자물쇠다.</b>
	 *
	 * <h3>왜 필요한가 — 있는 장치가 안 돌았다 (2026-09-06)</h3>
	 * {@link TtlCache}에는 <b>갱신에 실패하면 옛 값을 돌려주는</b> 장치가 이미 있다.
	 * 그런데 그 장치는 {@code catch}에 걸려 있어서 <b>예외가 나야</b> 돈다.
	 *
	 * <p>이날 공사({@code apis.data.go.kr})가 <b>오류를 주는 대신 아무 대답도 하지 않았다</b> —
	 * TCP 연결조차 받지 않았다. 타임아웃이 없으니 호출이 실패로 판정되지 않고 그대로 매달렸고,
	 * 그래서 <b>옛 값을 돌려주는 길도 60초 백오프도 한 줄도 실행되지 않았다.</b>
	 * 화면은 빈 채로 하염없이 기다렸다.
	 *
	 * <p>2026-08-26 사고 때 만든 장치는 "오류를 주는" 실패만 잡았다. <b>침묵하는 실패</b>는
	 * 종류가 다르고, 그것을 실패로 바꿔 주는 것이 이 값이다.
	 *
	 * <p>3초는 <b>연결</b>에 주는 시간이다. 정상일 때 국내 서버와의 TCP 연결은 수십 ms면
	 * 끝나므로, 3초를 넘긴다는 것은 느린 것이 아니라 <b>안 되는 것</b>이다.
	 */
	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);

	/**
	 * 응답을 기다리는 시간.
	 *
	 * <p>연결보다 넉넉하다. 지역 카탈로그는 한 번에 최대 5,000건이라 <b>정상일 때도</b>
	 * 몇 초가 걸린다 — 짧게 잡으면 공사가 멀쩡한데 우리가 먼저 끊어 버린다.
	 *
	 * <p>8초를 넘기면 옛 값으로 넘어간다. 사용자에게는 <b>6시간 지난 값</b>이
	 * 8초 더 기다린 끝의 빈 화면보다 낫다 — 공사 자료는 하루 한 번 갱신된다.
	 */
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(8);

	private static final String SUCCESS_CODE = "0000";

	/** 오류 응답을 로그·메시지에 실을 때 자르는 길이. 응답 전체가 통째로 실리는 것을 막는다. */
	private static final int SNIPPET_LENGTH = 200;

	private final RestClient restClient;
	private final KtoProperties properties;

	/**
	 * 오늘 몇 번 불렀는지 센다.
	 *
	 * <p><b>여기서 세는 이유</b>: 이 메서드가 공사로 나가는 <b>유일한 길목</b>이다.
	 * 클라이언트 넷이 각자 세면 새 클라이언트를 붙일 때 한 곳이 빠지고,
	 * 그러면 "한도를 넘겼나"에 틀린 답을 하게 된다.
	 */
	private final KtoCallLog callLog;

	public KtoApiCaller(RestClient.Builder builder, KtoProperties properties, KtoCallLog callLog) {
		/*
		 * ⚠️ <b>이 클라이언트에만 건다.</b> 전역 설정(spring.http.client.*)으로 걸면
		 * 소셜 로그인 클라이언트까지 함께 바뀐다 — 그쪽은 사용자가 버튼을 누르고 기다리는
		 * 자리라 견디는 시간이 다르고, 무엇보다 여기서 정한 값의 근거가 저기에는 없다.
		 */
		this.restClient = builder
				.requestFactory(ClientHttpRequestFactoryBuilder.detect()
						.build(HttpClientSettings.defaults()
								.withTimeouts(CONNECT_TIMEOUT, READ_TIMEOUT)))
				.build();
		this.properties = properties;
		this.callLog = callLog;
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

		/*
		 * 실제로 나간 호출만 센다. 인증키가 없어 위에서 되돌아간 경우는 공사에 닿지도 않았다.
		 *
		 * ⚠️ 실패도 센다. 2026-08-26 사고에서 드러난 것이 <b>실패한 호출도 한도를 먹는다</b>는
		 * 사실이었다 — 429가 나는 동안 재시도를 계속해 다음 날 치까지 태웠다.
		 */
		String raw;
		try {
			raw = restClient.get().uri(uriOf(path, params)).retrieve().body(String.class);
		}
		catch (RestClientException e) {
			callLog.record(path, false);
			throw new KtoApiException("공사 OpenAPI 호출에 실패했습니다: " + e.getMessage(), e);
		}

		/*
		 * <b>응답이 200으로 와도 내용이 오류일 수 있다</b> — 한도 초과·키 미등록이 그렇게 온다.
		 * 그런 호출도 한도를 먹으므로 성공으로 세면 안 된다. 무엇보다 한도 초과 응답이야말로
		 * 이 기록을 남기는 이유라, 그것을 "성공"으로 적으면 보고 싶은 신호를 스스로 지운다.
		 *
		 * ⚠️ 실패도 <b>센다</b>(빼지 않는다). 2026-08-26 사고에서 드러난 것이 실패한 호출도
		 * 한도를 먹는다는 사실이었다 — 429가 나는 동안 재시도를 계속해 다음 날 치까지 태웠다.
		 */
		boolean ok = false;
		try {
			JsonNode root = readTree(raw);
			failIfAuthError(root);
			failIfParameterError(root);

			JsonNode header = root.path("response").path("header");
			String resultCode = header.path("resultCode").asText("");
			if (!SUCCESS_CODE.equals(resultCode)) {
				throw new KtoApiException("공사 OpenAPI가 오류를 돌려줬습니다. resultCode=%s, resultMsg=%s"
						.formatted(resultCode, header.path("resultMsg").asText("")));
			}
			ok = true;
			return root.path("response").path("body");
		}
		finally {
			callLog.record(path, ok);
		}
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
