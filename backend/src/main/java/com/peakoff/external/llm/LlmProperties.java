package com.peakoff.external.llm;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 챗봇이 쓰는 LLM 설정. <b>인증키는 코드에 없다.</b>
 *
 * <h3>키가 없으면 챗봇만 꺼진다</h3>
 * {@link #isConfigured()}가 거짓이면 서버는 그대로 뜨고 챗봇 자리만 조용히 폴백한다.
 * 키가 없다고 기동이 실패하면 <b>공사 연동만 확인하려는 개발 중에도 키가 필요해진다.</b>
 *
 * <h3>왜 값을 전부 밖으로 뺐는가</h3>
 * 모델 이름과 하루 상한은 <b>크레딧 사정에 따라 바뀔 값</b>이다. 배포된 서버에서
 * 환경변수만 고쳐 바꿀 수 있어야 한다 — 재빌드가 필요한 값은 심사 기간에 못 고친다.
 *
 * @param apiKey       Google AI Studio 인증키. 비어 있으면 챗봇이 꺼진다
 * @param model        모델 이름. 하는 일이 분류와 한 문장 생성뿐이라 가벼운 것으로 둔다
 * @param dailyLimit   하루 LLM 호출 상한. <b>질문 수가 아니라 호출 수다</b> (질문 하나가 최대 둘)
 * @param perKeyLimit  한 사람이 {@code window} 안에 부를 수 있는 횟수
 * @param window       위 횟수를 세는 구간
 * @param timeout      한 번의 호출을 기다리는 최대 시간. 넘으면 폴백한다
 * @param cardLines    카드 문장을 LLM에게 쓰게 할지. 끄면 서버 템플릿만 쓴다 —
 *                     <b>질문당 크레딧이 절반이 된다</b>
 */
@ConfigurationProperties(prefix = "peakoff.chat")
public record LlmProperties(
		String apiKey,
		String model,
		Integer dailyLimit,
		Integer perKeyLimit,
		Duration window,
		Duration timeout,
		Duration intentTimeout,
		Boolean cardLines) {

	/**
	 * 기본 모델.
	 *
	 * <p>가장 가벼운 등급(flash-lite)이다. 이 서비스가 LLM에 시키는 일은 <b>아홉 중 하나 고르기</b>와
	 * <b>서른 자 문장 만들기</b>뿐이라 무거운 추론이 필요 없다. 판단은 전부 서버가 한다.
	 *
	 * <p>질문 하나에 드는 값이 약 $0.0004다(입력 600 · 출력 150 토큰 기준).
	 */
	public static final String DEFAULT_MODEL = "gemini-3.1-flash-lite";

	/**
	 * 하루 호출 상한의 기본값.
	 *
	 * <p><b>돈이 모자라서 잡은 값이 아니다.</b> 크레딧 ₩10,000이면 질문 1만 8천 개분이라
	 * 심사 기간에 다 쓸 일이 없다. 이 값이 막는 것은 <b>폭주</b>다 — 화면이 실패를 되풀이
	 * 호출하거나 누군가 자동으로 두드릴 때, 하루치가 몇 분 만에 사라지는 것을 끊는다.
	 *
	 * <p>600호출은 질문 약 300개, 하루 약 $0.11이다. 마감까지 매일 다 써도 크레딧의 5분의 1이다.
	 */
	public static final int DEFAULT_DAILY_LIMIT = 600;

	/**
	 * 한 번의 호출을 기다리는 시간.
	 *
	 * <p>길면 <b>사용자가 그만큼 빈 화면을 본다.</b> 챗봇은 화면 한 칸이라 그 칸만 늦는 것이
	 * 아니라 그 칸을 기다리는 사람이 늦는다.
	 *
	 * <p>■ <b>8초에서 내렸다</b> (2026-09-06). 질문 하나에 LLM을 <b>두 번</b> 부르는데
	 * 그 둘이 <b>차례로</b> 간다 — 의도를 읽어야 지역을 고르고, 지역이 있어야 문장을 쓴다.
	 * 그래서 사용자가 기다리는 시간은 타임아웃의 <b>두 배</b>다. 첫 실측이 15.7초였고,
	 * 그만큼 기다리면 답이 오더라도 이미 늦은 것이다.
	 *
	 * <p>5초면 최악이 10초다. 넘치면 폴백이 받는다 — 의도가 늦으면 챗봇이 조용히 쉬고,
	 * 문장이 늦으면 <b>카드는 그대로 서고</b> 서버 템플릿이 문장을 쓴다.
	 */
	public static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(5);

	/**
	 * 의도 추출에만 주는 상한. <b>두 실패의 무게가 달라서 값도 다르다.</b>
	 *
	 * <p>카드 문장이 늦으면 템플릿이 그 자리를 지키므로 사용자는 잃는 것이 없다. 그런데 의도
	 * 추출이 늦으면 지역을 고를 수가 없어 <b>카드가 통째로 사라진다</b>({@code UNAVAILABLE}) —
	 * 화면은 설문으로 안내한다. 앞단 하나가 전체를 무너뜨리는 비대칭이다.
	 *
	 * <p>실측(2026-09-09)에서 의도 추출이 3.5~5.0초라 5초 상한에 <b>걸쳐 있었다.</b>
	 * 새 질문 다섯 중 둘이 정확히 5.02초에 카드 0장으로 돌아왔다. 10초로 늘려 그 경계에서
	 * 떨어뜨린다. 늦더라도 답이 나오는 편이 낫다 — 화면은 카드를 먼저 받으므로
	 * 이 시간이 곧 카드가 뜨는 시간이다.
	 */
	public static final Duration DEFAULT_INTENT_TIMEOUT = Duration.ofSeconds(10);

	/**
	 * 카드 문장을 LLM에게 맡길지의 기본값.
	 *
	 * <p>켜 둔다. 다만 <b>끌 수 있다는 것이 설계의 일부</b>다 — 이 호출로 얻는 것은
	 * "사용자가 물은 말투에 맞춘 문장"뿐이고, 같은 사실은 서버 템플릿도 말할 수 있다
	 * ({@code CardLineTemplate}). 질문당 크레딧의 절반이 여기 들어가므로,
	 * 실제 문장이 템플릿과 별로 다르지 않다면 끄는 편이 낫다.
	 *
	 * <p>판단 근거는 {@code CardLineSource}가 준다 — LLM 문장이 검증을 통과해
	 * 실제로 쓰인 비율이다.
	 */
	public static final boolean DEFAULT_CARD_LINES = true;

	public LlmProperties {
		if (model == null || model.isBlank()) {
			model = DEFAULT_MODEL;
		}
		if (dailyLimit == null || dailyLimit < 0) {
			dailyLimit = DEFAULT_DAILY_LIMIT;
		}
		if (perKeyLimit == null || perKeyLimit < 1) {
			perKeyLimit = com.peakoff.chat.domain.CallLimiter.DEFAULT_LIMIT;
		}
		if (window == null || window.isZero() || window.isNegative()) {
			window = com.peakoff.chat.domain.CallLimiter.DEFAULT_WINDOW;
		}
		if (timeout == null || timeout.isZero() || timeout.isNegative()) {
			timeout = DEFAULT_TIMEOUT;
		}
		if (intentTimeout == null || intentTimeout.isZero() || intentTimeout.isNegative()) {
			intentTimeout = DEFAULT_INTENT_TIMEOUT;
		}
		if (cardLines == null) {
			cardLines = DEFAULT_CARD_LINES;
		}
	}

	/** 챗봇을 켤 수 있는가. 키가 없으면 화면은 기존 설문으로 안내한다. */
	public boolean isConfigured() {
		return apiKey != null && !apiKey.isBlank();
	}
}
