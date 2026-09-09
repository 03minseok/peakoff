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
 * @param crowdedPeriod 그 기간이 <b>열한 곳 어디나 붐비는가</b>. 화면이 한 줄로 알린다
 * @param cards      지역 카드. {@code OK}가 아니면 빈 목록이다
 */
public record ChatResponse(
		ChatStatus status,
		String basis,
		String interest,
		/**
		 * 관심사의 <b>코드</b>. 화면이 문장을 받으러 올 때 그대로 돌려보낸다.
		 *
		 * <p>{@code interest}는 사람에게 보이는 이름("바다")이라 되돌려 받아 해석하면
		 * 표기를 바꾸는 순간 조용히 깨진다. 코드는 화면이 읽지 않는 값이다.
		 */
		String interestCode,
		boolean crowdedPeriod,
		/**
		 * 카드 문장을 <b>따로 받아 갈 것이 남았는가.</b>
		 *
		 * <p>이 응답의 문장은 서버 템플릿이다. 모델이 켜져 있고 하루 상한이 남았으면
		 * {@code POST /api/chat/regions/lines}로 더 나은 문장을 받아 조용히 갈아끼울 수 있다.
		 * 꺼져 있거나 상한이 닳았으면 {@code false}이고, 화면은 <b>묻지 않는다</b> —
		 * 어차피 같은 템플릿이 돌아올 요청을 한 번 더 보낼 이유가 없다.
		 */
		boolean moreLines,
		List<RegionCardResponse> cards) {

	/** 창을 못 읽었을 때 쓸 말. 며칠인지 모를 뿐 <b>예측을 본다는 사실</b>은 그대로다. */
	private static final String UNKNOWN_BASIS = "예측이 나온 기간";

	/**
	 * @param crowdedPeriod ⚠️ <b>카드 둘이 아니라 그 기간의 열한 곳 전부</b>를 보고 정한 값이다.
	 *                      뽑힌 둘만 보면 거짓이 될 수 있다 — "바다"를 물었을 때 뽑힌 둘이
	 *                      낮은 것은 <b>기간이 붐벼서가 아니라 바닷가 지역이 붐벼서</b>이고,
	 *                      그때 통영은 55%다. 그 상태로 "어디나 붐빈다"고 하면 거짓말이 된다
	 */
	public static ChatResponse ok(String basis, Interest interest, boolean crowdedPeriod,
			boolean moreLines, List<RegionCard> cards) {
		return new ChatResponse(ChatStatus.OK, basis(basis), interest.label(), interest.name(),
				crowdedPeriod, moreLines, cards.stream().map(RegionCardResponse::from).toList());
	}

	public static ChatResponse offTopic(String basis) {
		return new ChatResponse(ChatStatus.OFF_TOPIC, basis(basis), null, null, false, false, List.of());
	}

	/**
	 * 예측이 닿지 않는 먼 훗날을 물었다.
	 *
	 * <p>⚠️ <b>카드를 함께 주지 않는다.</b> 지금 창의 지역을 붙이면 사용자가 그것을
	 * <b>물어본 시점의 답</b>으로 읽는다 — "내년 여름"을 물었는데 다음 달 자료가 오는 셈이다.
	 * 대신 {@code basis}가 어디까지 볼 수 있는지 말하므로, 화면은 그 기간을 알려 줄 수 있다.
	 */
	public static ChatResponse tooFar(String basis) {
		return new ChatResponse(ChatStatus.TOO_FAR, basis(basis), null, null, false, false, List.of());
	}

	public static ChatResponse unavailable(String basis) {
		return new ChatResponse(ChatStatus.UNAVAILABLE, basis(basis), null, null, false, false, List.of());
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
