package com.peakoff.chat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.peakoff.chat.domain.DailyBudget;
import com.peakoff.chat.domain.IntentReader;

/**
 * 홈 챗봇의 <b>예시 질문</b>만 미리 한 번 물어 의도 추출을 캐시에 넣는다.
 *
 * <h2>왜 필요한가 (2026-09-09 실측)</h2>
 * 챗봇 한 번이 5.0~7.9초다. 그 절반이 <b>의도 추출</b>(3.5~5.0초)인데, 이것은 지역을 고르기
 * 전에 끝나야 하는 앞단이라 뒤로 미룰 수가 없다. 다만 같은 질문은 24시간 캐시되므로
 * ({@code GeminiIntentReader}) <b>미리 물어 두면 그 질문만은 0초</b>가 된다.
 *
 * <p>그리고 처음 온 사람이 가장 많이 누르는 것이 예시 칩이다 — 빈 입력창 앞에서 무엇을
 * 물어야 할지 모르는 사람을 위해 둔 자리이므로, 심사위원이 밟을 길도 대개 여기다.
 * 예시를 데워 두면 그 경로가 <b>카드 문장 시간만</b> 남는다.
 *
 * <h2>⚠️ 예시 목록이 두 곳에 있다</h2>
 * 진짜 목록은 화면({@code frontend/src/components/RegionChat.tsx}의 {@code EXAMPLES})이고,
 * 여기 것은 <b>데울 대상의 사본</b>이다. 서버가 목록의 원천이 되려면 화면이 그것을 받아 갈
 * 엔드포인트를 새로 열어야 하는데, 홈을 열 때마다 요청이 하나 늘어난다.
 *
 * <p>대신 어긋나도 <b>고장이 아니다.</b> 안 쓰는 질문을 데우면 하루 상한을 두어 번 더 쓸 뿐이고,
 * 새 예시를 안 데우면 그 칩만 예전처럼 느리다. 그래서 사본을 두되 양쪽에 서로를 가리키는
 * 주석을 남긴다 — 값이 갈렸을 때 <b>조용히 틀리는 것</b>이 아니라 <b>조금 느려질</b> 뿐이다.
 *
 * <h2>비용</h2>
 * 부팅마다 LLM <b>2회</b>. 하루 상한 600회 중 2회이고, 재배포를 하루 열 번 해도 20회다.
 * 그래도 상한을 우습게 보지 않으려고 {@link DailyBudget}에서 정직하게 <b>차감한다</b> —
 * 실제로 나가는 호출이라 세지 않으면 남은 횟수가 거짓이 된다.
 *
 * <p>인증키가 없으면 아무 일도 하지 않는다. 챗봇이 꺼진 배포에서 오류를 만들지 않는다.
 */
@Component
public class ChatWarmer {

	private static final Logger log = LoggerFactory.getLogger(ChatWarmer.class);

	/**
	 * 데울 질문들.
	 *
	 * <p>⚠️ 화면의 {@code EXAMPLES}({@code RegionChat.tsx})와 <b>같아야 뜻이 있다.</b>
	 * 글자 하나만 달라도 캐시 열쇠가 갈려 데운 것이 쓰이지 않는다
	 * (열쇠는 공백·대소문자·끝의 물음표를 지운 값이다 — {@code GeminiIntentReader.cacheKey}).
	 */
	static final List<String> EXAMPLE_QUESTIONS = List.of(
			"사람 적은 바다 여행지 없나요?",
			"다음 주에 어디가 한산해요?");

	private final IntentReader intentReader;
	private final DailyBudget budget;

	public ChatWarmer(IntentReader intentReader, DailyBudget budget) {
		this.intentReader = intentReader;
		this.budget = budget;
	}

	/**
	 * 부팅이 끝나면 예시들을 한 번씩 물어 둔다.
	 *
	 * <p>{@code ApplicationReadyEvent}는 서버가 이미 요청을 받는 뒤에 온다. 이 루프가 도는
	 * 동안(최대 10초) 들어오는 질문은 그냥 예전처럼 처리되므로 아무도 막히지 않는다.
	 *
	 * <p>⚠️ <b>모델이 뭐라고 답했는지는 보지 않는다.</b> 여기서 하려는 일은 답을 쓰는 것이
	 * 아니라 <b>캐시를 채우는 것</b>이고, 실패하면 그 질문만 예전 속도로 돌아갈 뿐이다.
	 * {@code read()}는 이미 실패를 삼켜 {@code Optional.empty()}를 준다.
	 */
	@EventListener(ApplicationReadyEvent.class)
	public void warmExamples() {
		if (!intentReader.isAvailable()) {
			return;
		}
		Instant started = Instant.now();
		int warmed = 0;
		for (String question : EXAMPLE_QUESTIONS) {
			if (!budget.tryConsume()) {
				log.warn("[챗봇] 예시 데우기를 멈춥니다 — 하루 상한이 남지 않았습니다.");
				break;
			}
			if (intentReader.read(question).isPresent()) {
				warmed++;
			}
		}
		log.info("[챗봇] 예시 질문 의도 데우기 — {}/{}개, {}ms",
				warmed, EXAMPLE_QUESTIONS.size(),
				Duration.between(started, Instant.now()).toMillis());
	}
}
