package com.peakoff.chat.domain;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.SupportedRegion;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 카드가 만들어지는 규칙을 잠근다.
 *
 * <p>여기가 <b>"계산하지 않은 것을 근거로 말하지 않는다"</b>를 지키는 마지막 자리다.
 * 질문은 사용자가 친 문자열이고 그것이 프롬프트에 들어가므로, 모델이 무엇을 돌려주든
 * 카드에 오를 수 있는 문장은 이 검증을 통과한 것뿐이다.
 */
class RegionCardsTest {

	private static RegionProfile profile(SupportedRegion region, int quietShare, double foodShare) {
		return new RegionProfile(region, Map.of(Interest.FOOD, foodShare), quietShare, 94);
	}

	/** 실측 순서 그대로 — 통영 · 여수 · 제주시 (한적한 순). */
	private List<RegionProfile> picked() {
		return List.of(
				profile(SupportedRegion.TONGYEONG, 65, 0.349),
				profile(SupportedRegion.YEOSU, 57, 0.449),
				profile(SupportedRegion.JEJU, 22, 0.345));
	}

	@Test
	@DisplayName("LLM이 없어도 카드는 완성된다 — 빈 줄이 서면 화면이 고장으로 읽힌다")
	void templatesFillEveryCardWithoutLlm() {
		List<RegionCard> cards = RegionCards.of(Interest.FOOD, picked(), Map.of());

		assertThat(cards).hasSize(3);
		assertThat(cards).allSatisfy(card -> {
			assertThat(card.line()).isNotBlank();
			assertThat(card.lineSource()).isEqualTo(CardLineSource.TEMPLATE);
		});
	}

	@Test
	@DisplayName("관심사 몫이 가장 큰 곳만 \"가장 높아요\"라고 말한다")
	void onlyTheTopShareSaysHighest() {
		List<RegionCard> cards = RegionCards.of(Interest.FOOD, picked(), Map.of());

		// 음식 몫은 여수(44.9%)가 가장 크다. 한적한 순서(통영이 첫째)와 다른 순위다.
		assertThat(lineOf(cards, SupportedRegion.YEOSU)).isEqualTo("음식점 비중이 가장 높아요");
		assertThat(lineOf(cards, SupportedRegion.TONGYEONG)).isEqualTo("음식점 비중이 높은 편이에요");
	}

	/**
	 * 지역 평균으로는 3단계 등급이 서지 않는다({@link RegionProfile}). 그래서 한적함은
	 * <b>견주는 말</b>로만 한다 — "한적해요"는 사실이 아닐 수 있지만 "이 중에서는"은 언제나 사실이다.
	 */
	@Test
	@DisplayName("관심사가 없으면 한적한 정도를 견주어 말한다 — 단정하지 않는다")
	void withoutInterestItComparesQuietness() {
		List<RegionCard> cards = RegionCards.of(Interest.NONE, picked(), Map.of());

		assertThat(lineOf(cards, SupportedRegion.TONGYEONG)).isEqualTo("이 중에서는 가장 한적한 편이에요");
		assertThat(lineOf(cards, SupportedRegion.JEJU)).isEqualTo("이 중에서는 붐비는 편이에요");
		assertThat(cards).noneSatisfy(card -> assertThat(card.line()).isEqualTo("한적해요"));
	}

	@Test
	@DisplayName("쓸 만한 LLM 문장은 템플릿을 덮는다")
	void usableLlmLinesWin() {
		Map<SupportedRegion, String> written = Map.of(
				SupportedRegion.TONGYEONG, "맛집이 몰려 있고 이번 주는 한산한 편이에요");

		List<RegionCard> cards = RegionCards.of(Interest.FOOD, picked(), written);

		assertThat(lineOf(cards, SupportedRegion.TONGYEONG)).isEqualTo("맛집이 몰려 있고 이번 주는 한산한 편이에요");
		assertThat(sourceOf(cards, SupportedRegion.TONGYEONG)).isEqualTo(CardLineSource.LLM);
		// 나머지는 그대로 템플릿이다. 하나만 왔다고 나머지를 비우지 않는다.
		assertThat(sourceOf(cards, SupportedRegion.YEOSU)).isEqualTo(CardLineSource.TEMPLATE);
	}

	@Test
	@DisplayName("다른 지역을 말하는 문장은 버린다 — 우리가 고르지 않은 곳을 카드가 말하게 된다")
	void rejectsLinesNamingOtherRegions() {
		assertThat(RegionCards.isUsable("제주시보다 한적해요", SupportedRegion.TONGYEONG)).isFalse();
		// ⚠️ 접미사를 뗀 형태도 잡아야 한다. 사람은 "서귀포시"라고 쓰지 않는다.
		assertThat(RegionCards.isUsable("서귀포 쪽보다 조용해요", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("가평 근처예요", SupportedRegion.TONGYEONG)).isFalse();
	}

	@Test
	@DisplayName("자기 지역 이름은 허용한다 — 군더더기일 뿐 틀린 말은 아니다")
	void allowsItsOwnName() {
		assertThat(RegionCards.isUsable("통영은 이번 주 한산한 편이에요", SupportedRegion.TONGYEONG)).isTrue();
	}

	/**
	 * 카드의 숫자는 전부 서버가 계산한 것이다. 문장 속 숫자는 <b>지어낸 것일 수밖에 없다</b> —
	 * 우리가 모델에게 숫자를 넘기지 않기 때문이다.
	 */
	@Test
	@DisplayName("숫자가 든 문장은 버린다 — 넘긴 적 없는 숫자는 지어낸 것이다")
	void rejectsLinesWithNumbers() {
		assertThat(RegionCards.isUsable("맛집이 200곳 넘어요", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("한적도가 65예요", SupportedRegion.TONGYEONG)).isFalse();
	}

	/**
	 * 공사 자료는 <b>예측</b>이라 "지금"이라고 말하면 안 된다. 실호출 첫날 바로 나왔다 —
	 * "여수는 음식점이 많고 지금 아주 한적해요"(2026-09-06).
	 */
	@Test
	@DisplayName("시점을 주장하는 문장은 버린다 — 우리가 아는 것은 이번 주 예측뿐이다")
	void rejectsLinesClaimingTheMoment() {
		assertThat(RegionCards.isUsable("지금 아주 한적해요", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("현재 한산한 편이에요", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("오늘 가기 좋아요", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("요즘 붐비는 편이에요", SupportedRegion.TONGYEONG)).isFalse();
		// "이번 주"는 우리가 실제로 본 창이다
		assertThat(RegionCards.isUsable("이번 주에는 한적한 편이에요", SupportedRegion.TONGYEONG)).isTrue();
	}

	/**
	 * 우리가 모델에게 넘긴 것은 <b>순위</b>이지 사람 수가 아니다.
	 * "제주시는 이번 주에 방문객이 많은 편이에요"가 실제로 나왔다.
	 */
	@Test
	@DisplayName("세지 않은 것을 세었다고 하는 문장은 버린다")
	void rejectsLinesInventingCounts() {
		assertThat(RegionCards.isUsable("방문객이 많은 편이에요", SupportedRegion.JEJU)).isFalse();
		assertThat(RegionCards.isUsable("관광객이 몰려요", SupportedRegion.JEJU)).isFalse();
		assertThat(RegionCards.isUsable("회가 유명해요", SupportedRegion.YEOSU)).isFalse();
	}

	@Test
	@DisplayName("금지어가 애먼 말을 잡지 않는다 — \"명소\"는 우리가 쓰는 말이다")
	void bannedWordsDoNotCatchOurOwnCopy() {
		assertThat(RegionCards.isUsable("문화 명소 비중이 높은 편이에요", SupportedRegion.TONGYEONG)).isTrue();
		assertThat(RegionCards.isUsable("바닷가·물가 명소가 많아요", SupportedRegion.TAEAN)).isTrue();
	}

	@Test
	@DisplayName("너무 길거나 빈 문장은 버린다 — 350px 칸에서 카드가 무너진다")
	void rejectsBadLengths() {
		assertThat(RegionCards.isUsable("   ", SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable(null, SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("가".repeat(41), SupportedRegion.TONGYEONG)).isFalse();
		assertThat(RegionCards.isUsable("가".repeat(40), SupportedRegion.TONGYEONG)).isTrue();
	}

	@Test
	@DisplayName("버려진 문장 자리에는 템플릿이 선다 — 한 줄 때문에 셋을 다 버리지 않는다")
	void rejectedLinesFallBackPerCard() {
		Map<SupportedRegion, String> written = Map.of(
				SupportedRegion.TONGYEONG, "제주시보다 한산해요",          // 다른 지역 언급 → 버린다
				SupportedRegion.YEOSU, "맛집이 몰려 있어요");              // 통과

		List<RegionCard> cards = RegionCards.of(Interest.FOOD, picked(), written);

		assertThat(sourceOf(cards, SupportedRegion.TONGYEONG)).isEqualTo(CardLineSource.TEMPLATE);
		assertThat(sourceOf(cards, SupportedRegion.YEOSU)).isEqualTo(CardLineSource.LLM);
		assertThat(cards).allSatisfy(card -> assertThat(card.line()).isNotBlank());
	}

	@Test
	@DisplayName("카드 순서는 들어온 순서 그대로다 — 한적한 순으로 이미 세워져 있다")
	void keepsIncomingOrder() {
		List<RegionCard> cards = RegionCards.of(Interest.FOOD, picked(), Map.of());

		assertThat(cards).extracting(card -> card.region().shortName())
				.containsExactly("통영", "여수", "제주시");
	}

	private static String lineOf(List<RegionCard> cards, SupportedRegion region) {
		return cards.stream().filter(card -> card.region() == region).findFirst().orElseThrow().line();
	}

	private static CardLineSource sourceOf(List<RegionCard> cards, SupportedRegion region) {
		return cards.stream().filter(card -> card.region() == region).findFirst().orElseThrow().lineSource();
	}
}
