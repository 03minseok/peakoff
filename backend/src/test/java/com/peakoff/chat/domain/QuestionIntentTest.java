package com.peakoff.chat.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 의도의 불변식.
 *
 * <p>특히 <b>"관련 없음"과 "관심사 없음"이 다르다</b>는 것을 잠근다. 둘을 뭉치면
 * "어디가 한산해요?"가 거절당하는데, 하필 이 서비스가 가장 잘 답할 수 있는 질문이다.
 *
 * <p>시점도 마찬가지로 <b>없는 것과 0이 다르다.</b> 시점이 안 드러난 질문을 "오늘"로 읽으면
 * 창과 견주는 판정이 엉뚱한 자리에서 돈다.
 */
class QuestionIntentTest {

	@Test
	@DisplayName("관심사 없는 여행 질문은 답할 수 있는 질문이다")
	void noInterestIsStillAnswerable() {
		QuestionIntent intent = QuestionIntent.of(Interest.NONE);

		assertThat(intent.relevant()).isTrue();
		assertThat(intent.interest()).isEqualTo(Interest.NONE);
		assertThat(intent.horizonDays()).isNull();
	}

	@Test
	@DisplayName("관련 없는 질문에는 관심사가 남지 않는다 — 남기면 뒷단이 그걸 보고 움직인다")
	void offTopicCarriesNoInterest() {
		QuestionIntent intent = new QuestionIntent(
				false, Interest.FOOD, 60,
				new AskedPeriod(AskedPeriod.Anchor.WEEK, 0, AskedPeriod.Part.WEEKEND, null, null));

		assertThat(intent.interest()).isEqualTo(Interest.NONE);
		assertThat(intent.horizonDays()).isNull();
		// 답하지 않을 질문의 기간도 남기지 않는다. 남기면 뒷단이 그걸 보고 창을 옮긴다.
		assertThat(intent.period()).isEqualTo(AskedPeriod.NONE);
		assertThat(QuestionIntent.OFF_TOPIC.relevant()).isFalse();
	}

	@Test
	@DisplayName("관심사가 비어 오면 관심사 없음으로 읽는다 — 모델이 칸을 비울 수 있다")
	void nullInterestBecomesNone() {
		assertThat(new QuestionIntent(true, null, null, null).interest()).isEqualTo(Interest.NONE);
	}

	@Test
	@DisplayName("지난 시점을 가리키면 시점이 없는 것으로 읽는다 — 과거 예측은 애초에 없다")
	void pastHorizonIsDropped() {
		assertThat(new QuestionIntent(true, Interest.NONE, -7, null).horizonDays()).isNull();
	}
}
