package com.peakoff.chat.dto;

import java.util.List;

import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.RegionCard;

/**
 * 챗봇의 답.
 *
 * @param status     어떻게 답했는지. 화면은 이 값으로 갈라 그린다
 * @param basis      어느 기간을 본 값인지. <b>"지금"이 아니다</b> —
 *                   공사 자료는 예측이고 이 화면은 이번 주를 본다
 * @param interest   읽어낸 관심사 이름. 화면이 "식도락" 같은 말을 되비추는 데 쓴다
 * @param cards      지역 카드. {@code OK}가 아니면 빈 목록이다
 */
public record ChatResponse(
		ChatStatus status,
		String basis,
		String interest,
		List<RegionCardResponse> cards) {

	/** 화면이 "지금"이라고 말하지 않도록 서버가 기준을 함께 내려보낸다. */
	private static final String BASIS = "이번 주";

	public static ChatResponse ok(Interest interest, List<RegionCard> cards) {
		return new ChatResponse(ChatStatus.OK, BASIS, interest.label(),
				cards.stream().map(RegionCardResponse::from).toList());
	}

	public static ChatResponse offTopic() {
		return new ChatResponse(ChatStatus.OFF_TOPIC, BASIS, null, List.of());
	}

	public static ChatResponse unavailable() {
		return new ChatResponse(ChatStatus.UNAVAILABLE, BASIS, null, List.of());
	}
}
