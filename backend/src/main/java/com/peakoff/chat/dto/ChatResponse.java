package com.peakoff.chat.dto;

import java.util.List;

import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.RegionCard;

/**
 * 챗봇의 답.
 *
 * @param status     어떻게 답했는지. 화면은 이 값으로 갈라 그린다
 * @param basis      어느 기간을 본 값인지. <b>"지금"이 아니다</b> — 공사 자료는 예측이고,
 *                   이 화면은 <b>예측이 닿는 기간 전체</b>를 본다({@code ForecastWindow})
 * @param interest   읽어낸 관심사 이름. 화면이 "식도락" 같은 말을 되비추는 데 쓴다
 * @param cards      지역 카드. {@code OK}가 아니면 빈 목록이다
 */
public record ChatResponse(
		ChatStatus status,
		String basis,
		String interest,
		List<RegionCardResponse> cards) {

	/** 창을 못 읽었을 때 쓸 말. 며칠인지 모를 뿐 <b>예측을 본다는 사실</b>은 그대로다. */
	private static final String UNKNOWN_BASIS = "예측이 나온 기간";

	public static ChatResponse ok(String basis, Interest interest, List<RegionCard> cards) {
		return new ChatResponse(ChatStatus.OK, basis(basis), interest.label(),
				cards.stream().map(RegionCardResponse::from).toList());
	}

	public static ChatResponse offTopic(String basis) {
		return new ChatResponse(ChatStatus.OFF_TOPIC, basis(basis), null, List.of());
	}

	/**
	 * 예측이 닿지 않는 먼 훗날을 물었다.
	 *
	 * <p>⚠️ <b>카드를 함께 주지 않는다.</b> 지금 창의 지역을 붙이면 사용자가 그것을
	 * <b>물어본 시점의 답</b>으로 읽는다 — "내년 여름"을 물었는데 다음 달 자료가 오는 셈이다.
	 * 대신 {@code basis}가 어디까지 볼 수 있는지 말하므로, 화면은 그 기간을 알려 줄 수 있다.
	 */
	public static ChatResponse tooFar(String basis) {
		return new ChatResponse(ChatStatus.TOO_FAR, basis(basis), null, List.of());
	}

	public static ChatResponse unavailable(String basis) {
		return new ChatResponse(ChatStatus.UNAVAILABLE, basis(basis), null, List.of());
	}

	/**
	 * 창을 못 읽었을 때도 <b>기간을 말하는 자리는 비우지 않는다.</b>
	 *
	 * <p>화면은 이 값을 문장에 끼워 넣는다("… 예측을 기준으로 찾아드려요").
	 * null이 가면 그 문장이 통째로 무너지거나 "null 예측"이 뜬다.
	 */
	private static String basis(String basis) {
		return basis == null || basis.isBlank() ? UNKNOWN_BASIS : basis;
	}
}
