package com.peakoff.external.llm;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.Part;
import com.google.genai.types.Schema;
import com.google.genai.types.ThinkingConfig;

/**
 * LLM을 부르는 유일한 자리. <b>JSON만 받는다.</b>
 *
 * <h2>왜 자유 문장을 안 받는가</h2>
 * 돌려받는 것이 문장이면 그것을 우리 값으로 옮기는 코드가 필요하고, 그 코드가 곧
 * <b>모델의 말을 해석하는 자리</b>가 된다. 모양을 스키마로 못박아 두면 모델이 할 수 있는 일이
 * "칸을 채우는 것"으로 좁혀진다.
 *
 * <h2>⚠️ 실패는 예외가 아니라 일상이다</h2>
 * 인증키 만료 · 크레딧 소진 · 할당량 초과 · 네트워크 · 모델 과부하 — 무엇이든 일어난다.
 * 그때 <b>화면이 죽으면 안 된다</b>(CLAUDE.md: LLM이 죽어도 서비스가 돌아야 한다).
 * 여기서는 어떤 실패든 {@link LlmUnavailableException} 하나로 모으고, 부르는 쪽은
 * 그것을 받아 폴백한다.
 *
 * <h2>⚠️ 시간은 우리가 잰다</h2>
 * SDK에도 타임아웃이 있지만 그것에만 기대지 않는다. 단위를 잘못 넣거나(밀리초 vs 초)
 * SDK가 다른 곳에서 붙들면 <b>요청 스레드가 영영 매달린다</b> — 화면이 멈추는 가장 나쁜 실패다.
 * 그래서 호출을 별도 스레드에 맡기고 우리가 시계를 들고 기다린다.
 *
 * <p>기다림을 포기한 호출은 백그라운드에서 계속 돌다 끝난다. 버려지는 것은 <b>답</b>이지
 * 크레딧이 아니라 이미 나간 호출은 어차피 청구된다 — 그래도 사용자를 붙잡아 두는 것보다 낫다.
 * 호출 수 자체는 위층의 제한이 이미 막고 있다.
 */
public class GeminiClient {

	private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

	/**
	 * 답의 최대 길이.
	 *
	 * <p>넉넉히 둔다. 우리가 받을 JSON은 한두 줄이지만, 모델이 <b>답하기 전에 생각하는</b>
	 * 데도 이 예산을 쓰는 세대가 있다. 빠듯하게 잡으면 생각하다 예산이 끝나 <b>빈 답</b>이 온다 —
	 * 오류도 아니고 답도 아닌, 가장 알아채기 어려운 실패다.
	 */
	private static final int MAX_OUTPUT_TOKENS = 512;

	/**
	 * 같은 질문에 같은 답이 나오게 한다.
	 *
	 * <p>여기서 LLM이 하는 일은 <b>고르기와 옮기기</b>다. 창의성이 필요한 자리가 아니고,
	 * 무엇보다 의도 추출 결과를 캐시하므로 흔들리면 <b>캐시에 걸린 사람과 아닌 사람이
	 * 다른 답</b>을 받는다.
	 */
	private static final float TEMPERATURE = 0f;

	private final Client client;
	private final LlmProperties properties;

	/**
	 * 호출을 맡길 스레드.
	 *
	 * <p>데몬으로 둔다 — 버려진 호출이 아직 돌고 있어도 서버 종료를 붙잡지 않아야 한다.
	 * 개수를 묶지 않는 이유는 위층(호출량 제한)이 이미 동시 호출 수를 눌러 두기 때문이다.
	 */
	private final ExecutorService executor = Executors.newCachedThreadPool(runnable -> {
		Thread thread = new Thread(runnable, "llm-call");
		thread.setDaemon(true);
		return thread;
	});

	public GeminiClient(LlmProperties properties) {
		this.properties = properties;
		this.client = properties.isConfigured() ? build(properties) : null;
	}

	private static Client build(LlmProperties properties) {
		return Client.builder()
				.apiKey(properties.apiKey())
				/*
				 * SDK 쪽 타임아웃도 함께 건다. 이것이 먼저 끊기면 스레드가 제때 풀려
				 * 버려지는 호출이 줄어든다 — 우리 시계는 그것이 안 들을 때를 위한 보험이다.
				 */
				/*
				 * ⚠️ HTTP 상한은 <b>가장 긴 쪽</b>에 맞춘다. 이 값은 클라이언트를 만들 때 한 번 굳는데,
				 * 짧은 쪽(카드 문장 5초)에 맞추면 의도 추출에 10초를 줘도 HTTP 층이 먼저 끊는다.
				 * 호출마다의 진짜 상한은 아래 callWithin이 우리 시계로 건다.
				 */
				.httpOptions(HttpOptions.builder()
						.timeout((int) Math.max(
								properties.timeout().toMillis(),
								properties.intentTimeout().toMillis()))
						.build())
				.build();
	}

	/** 챗봇을 켤 수 있는가. 키가 없으면 이 클래스는 아무것도 부르지 않는다. */
	public boolean isConfigured() {
		return client != null;
	}

	/**
	 * 스키마에 맞는 JSON 한 덩어리를 받아 온다.
	 *
	 * @param systemInstruction 무엇을 하는지 · 무엇을 하지 말지. <b>규칙은 전부 여기 적는다</b>
	 * @param prompt            이번에 판단할 내용
	 * @param schema            받을 JSON의 모양
	 * @return 모델이 준 JSON 문자열
	 * @throws LlmUnavailableException 키가 없거나, 늦거나, 실패했거나, 빈 답이 왔을 때 —
	 *                                 <b>부르는 쪽은 이유를 가리지 않고 폴백한다</b>
	 */
	/** 기본 상한({@code peakoff.chat.timeout})으로 부른다. */
	public String json(String systemInstruction, String prompt, Schema schema) {
		return json(systemInstruction, prompt, schema, properties.timeout());
	}

	/**
	 * 상한을 정해서 부른다. 부르는 쪽마다 <b>늦었을 때 잃는 것이 다르기</b> 때문에 값을 나눈다
	 * ({@code LlmProperties.DEFAULT_INTENT_TIMEOUT} 주석).
	 */
	public String json(String systemInstruction, String prompt, Schema schema, Duration timeout) {
		if (client == null) {
			throw new LlmUnavailableException("LLM 인증키가 설정되지 않았습니다.");
		}

		GenerateContentConfig config = GenerateContentConfig.builder()
				.systemInstruction(Content.fromParts(Part.fromText(systemInstruction)))
				.responseMimeType("application/json")
				.responseSchema(schema)
				.temperature(TEMPERATURE)
				.maxOutputTokens(MAX_OUTPUT_TOKENS)
				/*
				 * 생각하지 않게 둔다. 아홉 중 하나를 고르고 한 문장을 옮기는 일에 필요 없고,
				 * 생각한 만큼 느려지고 청구된다.
				 */
				.thinkingConfig(ThinkingConfig.builder().thinkingBudget(0).build())
				.build();

		String text = callWithin(config, prompt, timeout);
		if (text == null || text.isBlank()) {
			// 오류 없이 빈 답이 오는 경우가 있다. 조용히 넘기면 그 다음이 더 이상하게 깨진다.
			throw new LlmUnavailableException("LLM이 빈 답을 돌려줬습니다.");
		}
		return text;
	}

	/** 우리 시계로 기다린다. SDK가 안 끊어 줄 때 요청 스레드를 풀어 주는 것이 목적이다. */
	private String callWithin(GenerateContentConfig config, String prompt, Duration timeout) {
		CompletableFuture<String> call = CompletableFuture.supplyAsync(() -> {
			GenerateContentResponse response =
					client.models.generateContent(properties.model(), prompt, config);
			return response.text();
		}, executor);

		try {
			return call.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
		}
		catch (TimeoutException e) {
			// 답을 버린다. 사용자를 더 붙잡아 두는 것보다 낫다.
			call.cancel(true);
			throw new LlmUnavailableException("LLM 응답이 %d초를 넘겼습니다."
					.formatted(timeout.toSeconds()), e);
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new LlmUnavailableException("LLM 호출이 중단됐습니다.", e);
		}
		catch (Exception e) {
			/*
			 * 할당량 초과 · 인증 실패 · 모델 과부하 · 네트워크가 모두 여기로 온다.
			 * 무엇이든 우리가 할 일은 같다 — 폴백. 원인은 로그에만 남긴다.
			 */
			log.warn("LLM 호출에 실패했습니다. model={}, 원인={}", properties.model(), e.toString());
			throw new LlmUnavailableException("LLM 호출에 실패했습니다.", e);
		}
	}
}
