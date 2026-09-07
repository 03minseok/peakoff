package com.peakoff.chat.domain;

/**
 * 질문에서 의도를 읽는 자리. <b>바깥에 무엇이 있는지는 이 인터페이스가 모른다.</b>
 *
 * <p>다른 도메인과 같은 배치다({@code PlaceProvider} · {@code CongestionProvider}) —
 * 규칙은 안쪽에, 바깥 연동은 바깥쪽에. LLM 제공자가 바뀌어도 이 인터페이스는 그대로다.
 *
 * <p>⚠️ <b>실패를 예외로 알리지 않는다.</b> 못 읽었으면 빈 값이고, 부르는 쪽은 폴백한다.
 * LLM은 자주 실패하는 종류의 의존이라, 실패를 <b>정상적인 답</b>으로 다루는 편이
 * 부르는 쪽 코드를 정직하게 만든다.
 */
public interface IntentReader {

	/** 지금 챗봇을 켤 수 있는가. 인증키가 없으면 거짓이고, 화면은 기존 설문으로 안내한다. */
	boolean isAvailable();

	/**
	 * @param question 사용자가 친 질문 원문
	 * @return 읽어낸 의도. <b>못 읽으면 빈 값</b> — 인증키 없음 · 시간 초과 · 할당량 초과 ·
	 *         모양이 어긋난 답이 전부 여기로 모인다
	 */
	java.util.Optional<QuestionIntent> read(String question);
}
