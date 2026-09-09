package com.peakoff.chat.dto;

import java.util.List;

import com.peakoff.chat.domain.RegionCard;

/**
 * 카드에 갈아끼울 문장들.
 *
 * <p>문장만 돌려준다. 숫자·모수·막대는 앞 응답의 것이 화면에 그대로 남아야 한다 —
 * 같은 값을 두 번 내려보내면 둘이 어긋날 자리가 생긴다.
 *
 * <p>여기 담긴 문장은 이미 검증을 통과한 것이다({@code RegionCards.of}). 모델이 쓴 것이
 * 규칙에 걸렸으면 <b>템플릿이 대신 담겨 온다</b> — 화면이 이미 들고 있는 문장과 같아서
 * 갈아끼워도 아무 일이 없다. 그래서 화면은 무엇이 왔는지 따지지 않고 그대로 덮으면 된다.
 */
public record ChatLinesResponse(List<Line> lines) {

	public record Line(String region, String line) {
	}

	public static ChatLinesResponse of(List<RegionCard> cards) {
		return new ChatLinesResponse(cards.stream()
				.map(card -> new Line(card.region().slug(), card.line()))
				.toList());
	}

	public static ChatLinesResponse empty() {
		return new ChatLinesResponse(List.of());
	}
}
