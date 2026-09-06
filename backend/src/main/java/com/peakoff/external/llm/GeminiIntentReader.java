package com.peakoff.external.llm;

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.ImmutableMap;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.IntentReader;
import com.peakoff.chat.domain.QuestionIntent;
import com.peakoff.external.kto.support.TtlCache;

/**
 * 질문에서 <b>관심사만</b> 뽑는다. 지역은 묻지 않는다.
 *
 * <h2>이 클래스가 지키는 선</h2>
 * 프롬프트에 "어느 지역을 추천할지 말하지 말라"고 적는 것으로 끝내지 않고,
 * <b>답의 모양 자체에 지역 칸을 만들지 않는다.</b> 말로만 금지하면 언젠가 넘어오지만,
 * 받을 칸이 없으면 넘어올 자리가 없다.
 *
 * <h2>질문 텍스트를 열쇠로 캐시한다</h2>
 * 예시 칩 셋은 <b>모든 사용자가 같은 문장</b>을 보낸다. 캐시가 없으면 그 세 문장에만
 * 크레딧이 계속 나간다. 의도 추출은 <b>같은 질문이면 같은 답</b>이라야 하는 자리라
 * (온도 0으로 두는 이유이기도 하다) 캐시해도 잃는 것이 없다.
 *
 * <p>⚠️ <b>지역 선택과 카드 문장은 캐시하지 않는다.</b> 그쪽은 무작위로 뽑으므로
 * 캐시하면 모두가 같은 지역을 받아 분산이 죽는다 — 대안 추천에서 "캐시는 원자료 층에만"이라고
 * 정한 것과 같은 이유다. <b>의도는 원자료 층이고 지역 선택은 판단 층이다.</b>
 *
 * <h2>실패는 전부 빈 값이다</h2>
 * 인증키 없음 · 시간 초과 · 할당량 초과 · JSON이 깨짐 — 무엇이든 {@code Optional.empty()}다.
 * 부르는 쪽이 이유를 가려 다르게 행동할 일이 없다. 원인은 로그에만 남는다.
 */
@Component
public class GeminiIntentReader implements IntentReader {

	private static final Logger log = LoggerFactory.getLogger(GeminiIntentReader.class);

	private static final ObjectMapper JSON = new ObjectMapper();

	/**
	 * 의도 캐시의 수명.
	 *
	 * <p>공사 자료 캐시(6시간)보다 길게 잡는다. 그쪽은 <b>바깥 자료가 갱신되므로</b> 짧아야 하지만,
	 * "이 문장이 무엇을 묻는가"는 시간이 지나도 달라지지 않는다.
	 */
	private static final Duration CACHE_TTL = Duration.ofHours(24);

	/**
	 * 캐시에 담을 질문 수.
	 *
	 * <p>열쇠가 <b>사용자가 친 문자열</b>이라 얼마든지 늘어날 수 있다. 상한을 넘으면
	 * 통째로 비운다({@code TtlCache}의 규칙) — 다시 물으면 그만이고, 메모리가 새는 것보다 낫다.
	 */
	private static final int CACHE_MAX = 500;

	/**
	 * 캐시 열쇠로 쓸 질문의 최대 길이이자, 모델에 보낼 질문의 최대 길이.
	 *
	 * <p>긴 글을 붙여 넣으면 <b>입력 토큰이 그만큼 청구된다.</b> 여행지를 묻는 문장이
	 * 200자를 넘을 일이 없으므로 넘는 부분은 자른다.
	 */
	private static final int MAX_QUESTION_LENGTH = 200;

	/**
	 * 무엇을 하는 자리인지, 그리고 <b>무엇을 하지 말아야 하는지</b>.
	 *
	 * <p>관심사 목록은 {@link Interest#promptOptions()}에서 가져온다 —
	 * 여기에 손으로 적어 두면 enum이 바뀔 때 프롬프트만 옛 목록을 들고 있게 된다.
	 */
	private static final String SYSTEM_INSTRUCTION = """
			너는 한국 국내 여행지 추천 서비스의 질문 분류기다.
			사용자의 질문을 읽고 두 가지만 판단해라.

			1. relevant: 이 질문이 "어디로 여행 갈지"를 고르는 데 관한 질문인가?
			   - 여행지, 관광, 나들이, 휴가, 한적한 곳, 붐비지 않는 곳을 묻는 질문이면 true
			   - 그 밖의 모든 질문(코딩, 날씨, 잡담, 특정 장소의 영업시간 등)은 false

			2. interest: 질문에서 드러난 관심사 하나. 아래 목록의 <b>영문 식별자</b>를 그대로 써라.
			   %s
			   - 관심사가 드러나지 않으면 NONE (예: "이번 주 어디가 한산해요?")
			   - 애매하면 NONE. 억지로 고르지 마라
			   - relevant가 false면 NONE

			⚠️ 절대 지키기:
			- 지역이나 장소 이름을 답하지 마라. 어디를 추천할지는 서버가 정한다.
			- 목록에 없는 관심사를 지어내지 마라.
			- 설명하지 말고 JSON만 출력해라.
			""".formatted(Interest.promptOptions());

	private final GeminiClient client;
	private final TtlCache<QuestionIntent> cache;

	public GeminiIntentReader(GeminiClient client, Clock clock) {
		this.client = client;
		this.cache = new TtlCache<>(clock, CACHE_TTL, CACHE_MAX);
	}

	@Override
	public boolean isAvailable() {
		return client.isConfigured();
	}

	@Override
	public Optional<QuestionIntent> read(String question) {
		if (!client.isConfigured() || question == null || question.isBlank()) {
			return Optional.empty();
		}

		String asked = trim(question);
		try {
			/*
			 * 열쇠는 다듬은 문장이다. "식도락 여행하기 좋은 곳"과 "식도락 여행하기 좋은 곳?"이
			 * 다른 열쇠가 되면, 사람마다 조금씩 다르게 치는 만큼 캐시가 헛돈다.
			 *
			 * TtlCache는 실패를 60초 기억한다. LLM이 죽어 있는 동안 같은 질문으로
			 * 계속 두드리는 것을 막아 주는데, 이 자리에서는 그것이 곧 크레딧이다.
			 */
			return Optional.of(cache.get(cacheKey(asked), ignored -> extract(asked)));
		}
		catch (RuntimeException e) {
			// LlmUnavailableException과 캐시 백오프가 모두 여기로 온다. 부르는 쪽은 폴백한다.
			return Optional.empty();
		}
	}

	/** 실제 호출. <b>캐시가 비었을 때만</b> 여기까지 온다. */
	private QuestionIntent extract(String question) {
		String raw = client.json(SYSTEM_INSTRUCTION, question, schema());
		try {
			JsonNode node = JSON.readTree(raw);
			boolean relevant = node.path("relevant").asBoolean(false);
			if (!relevant) {
				return QuestionIntent.OFF_TOPIC;
			}
			/*
			 * 모델이 목록에 없는 값을 줄 수 있다. Interest.of가 그것을 NONE으로 흘려보낸다 —
			 * 관심사를 못 읽어도 "이번 주 한적한 곳"은 여전히 답할 수 있으므로,
			 * 여기서 예외를 던져 질문 전체를 버리는 것은 과하다.
			 */
			return new QuestionIntent(true, Interest.of(node.path("interest").asText("")));
		}
		catch (Exception e) {
			/*
			 * 스키마를 걸어 두었으므로 드물지만, 모양이 어긋난 답이 오면 여기다.
			 * 던져야 TtlCache가 실패로 기억하고 백오프가 걸린다 — 깨진 답을 캐시에 담으면
			 * 24시간 동안 같은 질문에 같은 오답을 준다.
			 */
			log.warn("의도 추출 응답을 읽지 못했습니다. 응답={}", abbreviate(raw));
			throw new LlmUnavailableException("의도 추출 응답의 모양이 어긋났습니다.", e);
		}
	}

	/**
	 * 받을 JSON의 모양.
	 *
	 * <p>⚠️ <b>지역을 담을 칸이 없다.</b> 이 스키마가 곧 "LLM이 할 수 있는 일"의 경계다.
	 */
	private static Schema schema() {
		return Schema.builder()
				.type(Type.Known.OBJECT)
				.properties(ImmutableMap.of(
						"relevant", Schema.builder().type(Type.Known.BOOLEAN).build(),
						"interest", Schema.builder().type(Type.Known.STRING).build()))
				.required("relevant", "interest")
				.build();
	}

	/** 앞뒤 공백을 걷고 너무 긴 질문은 자른다. 자르는 이유는 토큰이 곧 돈이라서다. */
	private static String trim(String question) {
		String squeezed = question.strip();
		return squeezed.length() > MAX_QUESTION_LENGTH
				? squeezed.substring(0, MAX_QUESTION_LENGTH)
				: squeezed;
	}

	/**
	 * 캐시 열쇠.
	 *
	 * <p>공백을 하나로 줄이고 소문자로 바꾸고 끝의 물음표·마침표를 뗀다.
	 * 같은 질문을 조금씩 다르게 치는 것까지 같은 열쇠로 모으기 위해서다.
	 */
	private static String cacheKey(String question) {
		return question.replaceAll("\\s+", " ")
				.toLowerCase()
				.replaceAll("[?!.\\s]+$", "");
	}

	private static String abbreviate(String text) {
		if (text == null) {
			return "(없음)";
		}
		return text.length() > 200 ? text.substring(0, 200) + "…" : text;
	}
}
