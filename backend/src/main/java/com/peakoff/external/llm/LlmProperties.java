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
 */
@ConfigurationProperties(prefix = "peakoff.chat")
public record LlmProperties(
		String apiKey,
		String model,
		Integer dailyLimit,
		Integer perKeyLimit,
		Duration window,
		Duration timeout) {

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
	 * 아니라 그 칸을 기다리는 사람이 늦는다. 8초를 넘기면 답이 오더라도 이미 늦은 것이므로
	 * 폴백이 낫다.
	 */
	public static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(8);

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
	}

	/** 챗봇을 켤 수 있는가. 키가 없으면 화면은 기존 설문으로 안내한다. */
	public boolean isConfigured() {
		return apiKey != null && !apiKey.isBlank();
	}
}
