package com.peakoff.chat.domain;

/**
 * 질문 하나에서 읽어낸 것. <b>이게 LLM이 판단하는 전부다.</b>
 *
 * <h3>왜 이 둘뿐인가</h3>
 * LLM에게 시키는 일을 <b>고르기</b>로 좁히기 위해서다. 여기에 "추천 지역"이나
 * "추천 이유" 같은 칸을 하나만 더 만들어도, 모델은 자기 지식으로 그 칸을 채운다 —
 * 그 순간 서비스가 <b>계산하지 않은 것을 근거로</b> 말하게 된다.
 * 어느 지역인지는 서버가 자료를 보고 정한다.
 *
 * <h3>관련 없음과 관심사 없음은 다르다</h3>
 * <ul>
 *   <li>{@code relevant=false} — "파이썬 오류 좀 봐줘". 답하지 않고 정중히 물러난다</li>
 *   <li>{@code relevant=true, interest=NONE} — "이번 주 어디가 제일 한산해요?".
 *       거를 것이 없을 뿐 <b>가장 잘 답할 수 있는 질문</b>이다</li>
 * </ul>
 * 둘을 한 값으로 뭉치면 후자가 거절당한다. 이 서비스가 하려는 말에 가장 가까운 질문이
 * 하필 거절당하는 셈이라, 칸을 나눠 둔다.
 *
 * @param relevant 여행지를 고르는 데 관한 질문인가
 * @param interest 읽어낸 관심사. 없거나 못 읽으면 {@link Interest#NONE}
 */
public record QuestionIntent(boolean relevant, Interest interest) {

	/** 관련 없는 질문. */
	public static final QuestionIntent OFF_TOPIC = new QuestionIntent(false, Interest.NONE);

	public QuestionIntent {
		if (interest == null) {
			interest = Interest.NONE;
		}
		if (!relevant) {
			// 답하지 않을 질문의 관심사는 뜻이 없다. 남겨 두면 뒷단이 그걸 보고 움직인다.
			interest = Interest.NONE;
		}
	}
}
