package com.peakoff.chat.controller;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.chat.domain.DailyBudget;
import com.peakoff.chat.domain.IntentReader;
import com.peakoff.chat.domain.QuestionIntent;
import com.peakoff.global.response.ApiResponse;

/**
 * 질문에서 의도를 읽는 <b>그 단계만</b> 떼어 보는 자리. 개발 기기 전용.
 *
 * <h3>왜 있는가</h3>
 * 챗봇이 이상한 답을 할 때 원인이 셋이다 — 의도를 잘못 읽었거나, 지역을 잘못 골랐거나,
 * 문장을 잘못 옮겼거나. 층마다 따로 볼 수 있어야 <b>어디가 틀렸는지</b> 가려낼 수 있다.
 * 지역 고르기는 {@link RegionChatDevController}가 본다.
 *
 * <h3>⚠️ 여기도 하루 상한을 쓴다</h3>
 * 개발용이라고 상한을 건너뛰면, 확인하느라 크레딧을 태우고도 <b>얼마나 썼는지 모른다.</b>
 * 대신 개인 제한(연타 방지)은 걸지 않는다 — 여러 문장을 잇달아 시험하는 것이 이 경로의 용도다.
 *
 * <p>같은 질문을 두 번 부르면 두 번째는 캐시에서 나온다. 걸린 시간을 함께 돌려주므로
 * <b>캐시가 실제로 도는지</b>가 눈에 보인다 — 예시 질문 칩 셋은 모든 사용자가 같은 문장을
 * 보내므로, 캐시가 죽으면 그 세 문장에만 크레딧이 계속 나간다.
 */
@Tag(name = "개발용", description = "챗봇 의도 추출 확인 (개발 기기 전용)")
@ConditionalOnProperty(name = "peakoff.dev.endpoints", havingValue = "true")
@RestController
@RequestMapping("/api/dev/chat-intent")
public class ChatIntentDevController {

	private final IntentReader intentReader;
	private final DailyBudget budget;
	/** 조각을 날짜로 바꿔 보이려면 오늘이 필요하다. 서비스와 같은 시계를 쓴다 */
	private final Clock clock;

	public ChatIntentDevController(IntentReader intentReader, DailyBudget budget, Clock clock) {
		this.intentReader = intentReader;
		this.budget = budget;
		this.clock = clock;
	}

	@Operation(summary = "의도 추출 확인",
			description = "질문 하나를 LLM에 보내 관심사만 읽어 온다. 지역은 고르지 않는다.")
	@GetMapping
	public ApiResponse<Map<String, Object>> read(@RequestParam String q) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("question", q);
		body.put("available", intentReader.isAvailable());

		if (!intentReader.isAvailable()) {
			body.put("note", "인증키가 없습니다. application-local.yml의 peakoff.chat.api-key "
					+ "또는 환경변수 GEMINI_API_KEY를 확인하세요.");
			return ApiResponse.ok(body);
		}
		if (!budget.tryConsume()) {
			// 상한에 닿았다. 화면에서는 이때 조용히 폴백한다 — 여기서는 그 사실을 그대로 보여준다.
			body.put("note", "하루 호출 상한에 닿았습니다. 화면은 이때 설문으로 폴백합니다.");
			return ApiResponse.ok(body);
		}

		long startedAt = System.currentTimeMillis();
		Optional<QuestionIntent> intent = intentReader.read(q);
		body.put("elapsedMs", System.currentTimeMillis() - startedAt);

		intent.ifPresentOrElse(
				read -> {
					body.put("relevant", read.relevant());
					body.put("interest", read.interest().name());
					body.put("interestLabel", read.interest().label());
					/*
					 * 시점도 함께 보인다. 이 값이 <b>거르는 문에서만</b> 쓰이는지
					 * 확인하려면 읽어낸 숫자를 눈으로 봐야 한다 —
					 * "이번 달 말"을 20으로 읽었는지 60으로 읽었는지에 따라
					 * 답이 카드가 되기도 하고 "아직 예측이 없다"가 되기도 한다.
					 */
					body.put("horizonDays", read.horizonDays());
					/*
					 * 읽어낸 조각과 <b>서버가 만든 날짜</b>를 나란히 보인다.
					 * 답이 이상할 때 모델이 잘못 읽은 것인지 우리 달력이 잘못 센 것인지를
					 * 가르려면 두 층이 함께 보여야 한다.
					 */
					body.put("period", read.period().toString());
					body.put("dates", read.period().resolve(LocalDate.now(clock))
							.map(range -> range.label() + " (" + range.days() + "일)")
							.orElse("기간 없음 — 예측 전체로 답한다"));
				},
				/*
				 * 시간 초과 · 할당량 초과 · 모양이 어긋난 답이 모두 여기다.
				 * 화면에서는 이 경우와 "관련 없는 질문"이 다르게 보인다 —
				 * 앞은 챗봇이 쉬는 것이고 뒤는 답을 고른 것이다.
				 */
				() -> body.put("note", "의도를 읽지 못했습니다(시간 초과·할당량·응답 형식). "
						+ "화면은 이때 조용히 폴백합니다."));

		body.put("budgetRemaining", budget.remaining());
		return ApiResponse.ok(body);
	}
}
