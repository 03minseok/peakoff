package com.peakoff.chat.domain;

/**
 * 질문 하나에서 읽어낸 것. <b>이게 LLM이 판단하는 전부다.</b>
 *
 * <h3>왜 이것뿐인가</h3>
 * LLM에게 시키는 일을 <b>고르기와 어림잡기</b>로 좁히기 위해서다. 여기에 "추천 지역"이나
 * "추천 이유" 같은 칸을 하나만 더 만들어도, 모델은 자기 지식으로 그 칸을 채운다 —
 * 그 순간 서비스가 <b>계산하지 않은 것을 근거로</b> 말하게 된다.
 * 어느 지역인지는 서버가 자료를 보고 정한다.
 *
 * <h3>시점은 <b>계산하지 않아도 되는 것</b>만 받는다 (2026-09-07 · 09-08)</h3>
 * "내년 여름에 갈 만한 데"라고 물으면 공사 예측이 닿지 않는다. 그 판단을 하려면
 * 질문이 <b>얼마나 먼 훗날</b>을 가리키는지 알아야 하는데, 그것은 자료가 아니라
 * 말에 들어 있어 서버가 읽을 수 없다.
 *
 * <p>그래서 칸을 열되 <b>숫자와 조각</b>으로 막았다. 여기에는 지역도 이유도 들어갈
 * 자리가 없다. 그리고 <b>"예측할 수 있는가"는 묻지 않는다</b> —
 * 그건 우리 자료 사정이라 {@link ForecastWindow#covers}가 서버에서 정한다.
 *
 * <p>{@code period}는 기간을 <b>조각으로</b> 받아 서버가 날짜로 바꾼다({@link AskedPeriod}).
 * {@code horizonDays}는 그 조각으로 못 읽는 먼 말("내년 여름")을 창 밖으로 거르는
 * <b>보조 문</b>으로 남는다 — 어림수여도 창에서 한참 떨어져 있어 판정이 흔들리지 않는다.
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
 * @param relevant    여행지를 고르는 데 관한 질문인가
 * @param interest    읽어낸 관심사. 없거나 못 읽으면 {@link Interest#NONE}
 * @param horizonDays 질문이 가리키는 시점까지 대략 며칠 뒤인가. <b>안 드러나면 null</b>
 * @param period      질문이 가리키는 기간의 조각. 못 읽으면 {@link AskedPeriod#NONE}
 */
public record QuestionIntent(
		boolean relevant, Interest interest, Integer horizonDays, AskedPeriod period) {

	/** 관련 없는 질문. */
	public static final QuestionIntent OFF_TOPIC =
			new QuestionIntent(false, Interest.NONE, null, AskedPeriod.NONE);

	public QuestionIntent {
		if (interest == null) {
			interest = Interest.NONE;
		}
		if (period == null) {
			period = AskedPeriod.NONE;
		}
		if (!relevant) {
			// 답하지 않을 질문의 관심사는 뜻이 없다. 남겨 두면 뒷단이 그걸 보고 움직인다.
			interest = Interest.NONE;
			horizonDays = null;
			period = AskedPeriod.NONE;
		}
		if (horizonDays != null && horizonDays < 0) {
			/*
			 * 지난 시점을 가리키는 질문("지난 주말엔 어땠어?")이다. 과거 예측은 애초에 없으므로
			 * <b>창 밖이라고 말하는 것도 사실이 아니다</b> — 시점이 없는 질문과 같이 다뤄
			 * 지금 볼 수 있는 기간으로 답한다.
			 */
			horizonDays = null;
		}
	}

	/** 시점을 읽지 못한 보통의 질문. */
	public static QuestionIntent of(Interest interest) {
		return new QuestionIntent(true, interest, null, AskedPeriod.NONE);
	}
}
