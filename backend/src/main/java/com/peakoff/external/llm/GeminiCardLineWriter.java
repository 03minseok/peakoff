package com.peakoff.external.llm;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.ImmutableMap;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.peakoff.chat.domain.CardLineWriter;
import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.RegionProfile;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 카드 문장을 LLM에게 <b>옮겨 적게</b> 한다. 판단은 이미 끝나 있다.
 *
 * <h2>모델이 받는 것과 못 받는 것</h2>
 * 받는 것: 지역 이름 · 그 지역의 관심사 몫 순위 · 카드들 중 한적한 순위 · 사용자의 질문.
 * <b>못 받는 것: 지역에 대한 어떤 사실도.</b> 무엇이 유명한지, 무엇을 파는지, 어떤 풍경인지를
 * 우리가 넘기지 않으므로 모델이 그것을 말하면 <b>자기 지식으로 말하는 것</b>이고,
 * 그런 문장은 {@code RegionCards}의 검증에서 버려진다.
 *
 * <h2>그러면 LLM이 왜 필요한가</h2>
 * 솔직히 말해 <b>얻는 것이 말투 하나다.</b> 서버 템플릿도 같은 사실을 말할 수 있고
 * ({@code CardLineTemplate}), 실제로 그것이 기본값이다. LLM이 더하는 것은
 * "사람 적은 바다 여행지 없나요?"라고 물었을 때 그 말투에 맞춰 답하는 정도다.
 *
 * <p>그래서 <b>끌 수 있게 두었다</b>({@code peakoff.chat.card-lines=false}).
 * 이 호출이 질문당 크레딧의 절반을 쓰므로, 문장이 템플릿과 별로 다르지 않다면 끄는 편이 낫다.
 * {@code CardLineSource}가 실제 채택률을 알려 준다.
 *
 * <h2>⚠️ 한 번에 묻는다</h2>
 * 카드마다 부르면 호출이 셋이 된다 — 크레딧도 셋이고 기다림도 셋이다.
 * 지역 목록을 한 번에 주고 문장 목록을 한 번에 받는다.
 */
@Component
public class GeminiCardLineWriter implements CardLineWriter {

	private static final Logger log = LoggerFactory.getLogger(GeminiCardLineWriter.class);

	private static final ObjectMapper JSON = new ObjectMapper();

	/** 질문을 말투 참고용으로만 넘긴다. 길면 자른다 — 토큰이 곧 돈이다. */
	private static final int MAX_QUESTION_LENGTH = 200;

	private static final String SYSTEM_INSTRUCTION = """
			너는 한국 국내 여행지 추천 서비스의 문안 작성기다.
			서버가 이미 지역을 골랐고, 각 지역에 대해 아래 사실을 준다.
			너는 그 사실을 사용자의 말투에 맞춰 <b>짧은 한 문장</b>으로 옮기기만 한다.

			규칙:
			- 지역마다 한 문장. 20~30자. 존댓말("~해요" / "~예요").
			- 제공된 사실만 말해라. 제공되지 않은 것은 모른다.
			- ⚠️ 특산물·명소·풍경·역사·맛집처럼 <b>우리가 주지 않은 정보를 절대 지어내지 마라.</b>
			  "회가 유명해요", "야경이 예뻐요" 같은 문장은 금지다.
			- ⚠️ 다른 지역 이름을 언급하지 마라.
			- ⚠️ 숫자를 쓰지 마라. 숫자는 화면이 따로 보여준다.
			- 지역 이름은 slug 그대로 돌려줘라. 문장만 새로 쓴다.
			""";

	private final GeminiClient client;
	private final LlmProperties properties;

	public GeminiCardLineWriter(GeminiClient client, LlmProperties properties) {
		this.client = client;
		this.properties = properties;
	}

	@Override
	public boolean isAvailable() {
		return client.isConfigured() && properties.cardLines();
	}

	@Override
	public Map<SupportedRegion, String> write(
			String question, Interest interest, List<RegionProfile> picked) {

		if (!isAvailable() || picked == null || picked.isEmpty()) {
			return Map.of();
		}
		try {
			return parse(client.json(SYSTEM_INSTRUCTION, prompt(question, interest, picked), schema()));
		}
		catch (RuntimeException e) {
			/*
			 * 실패해도 카드는 선다 — 템플릿이 이미 자리를 잡고 있다.
			 * 여기서 예외를 위로 올리면 문장 하나 때문에 챗봇 전체가 멈춘다.
			 */
			log.warn("카드 문장을 쓰지 못했습니다. 템플릿으로 채웁니다. 원인={}", e.toString());
			return Map.of();
		}
	}

	/**
	 * 모델에게 줄 사실들.
	 *
	 * <p>⚠️ <b>한적 비율의 숫자를 넘기지 않는다.</b> 넘기면 문장에 그 숫자를 적고 싶어지고,
	 * 그러면 카드에 같은 숫자가 두 번 뜬다. 필요한 것은 <b>순위</b>뿐이다.
	 */
	private static String prompt(String question, Interest interest, List<RegionProfile> picked) {
		SupportedRegion topShare = topShareRegion(interest, picked);

		StringBuilder prompt = new StringBuilder();
		prompt.append("사용자 질문: ").append(trim(question)).append('\n');
		if (interest != null && interest.filtersRegions()) {
			prompt.append("사용자 관심사: ").append(interest.noun()).append('\n');
		}
		else {
			prompt.append("사용자 관심사: 없음 (한적한 곳을 찾는 질문)\n");
		}
		prompt.append("\n지역들 (한적한 순):\n");

		for (int rank = 0; rank < picked.size(); rank++) {
			RegionProfile profile = picked.get(rank);
			prompt.append("- slug=").append(profile.region().slug())
					.append(", 이름=").append(profile.region().shortName());
			if (interest != null && interest.filtersRegions()) {
				prompt.append(", ").append(interest.noun()).append(" 비중=")
						.append(profile.region() == topShare ? "이 중 가장 높음" : "높은 편");
			}
			prompt.append(", 이번 주 한적한 정도=").append(quietnessRank(rank, picked.size()))
					.append('\n');
		}
		return prompt.toString();
	}

	/** 순위를 말로 옮긴다. <b>절대 등급이 아니라 이 카드들 안에서의 자리</b>다. */
	private static String quietnessRank(int rank, int total) {
		if (total <= 1) {
			return "견줄 상대 없음";
		}
		if (rank == 0) {
			return "이 중 가장 한적함";
		}
		if (rank == total - 1) {
			return "이 중 가장 붐빔";
		}
		return "중간";
	}

	private static SupportedRegion topShareRegion(Interest interest, List<RegionProfile> picked) {
		if (interest == null || !interest.filtersRegions()) {
			return null;
		}
		RegionProfile top = picked.get(0);
		for (RegionProfile profile : picked) {
			if (profile.shareOf(interest) > top.shareOf(interest)) {
				top = profile;
			}
		}
		return top.region();
	}

	/**
	 * 받을 JSON의 모양.
	 *
	 * <p>여기도 <b>지역을 고를 칸은 없다.</b> {@code region}은 우리가 준 slug를 되돌려 주는
	 * 자리이고, 모르는 slug가 오면 어느 카드에도 안 붙어 그냥 버려진다.
	 */
	private static Schema schema() {
		return Schema.builder()
				.type(Type.Known.OBJECT)
				.properties(ImmutableMap.of(
						"lines", Schema.builder()
								.type(Type.Known.ARRAY)
								.items(Schema.builder()
										.type(Type.Known.OBJECT)
										.properties(ImmutableMap.of(
												"region", Schema.builder().type(Type.Known.STRING).build(),
												"line", Schema.builder().type(Type.Known.STRING).build()))
										.required("region", "line"))
								.build()))
				.required("lines")
				.build();
	}

	/**
	 * 답을 지역별로 나눈다.
	 *
	 * <p>모르는 slug는 조용히 버린다. 예외를 던지면 <b>나머지 멀쩡한 문장까지</b> 잃는다 —
	 * 셋 중 둘만 제대로 왔으면 그 둘은 쓰는 편이 낫다.
	 */
	private static Map<SupportedRegion, String> parse(String raw) {
		Map<SupportedRegion, String> lines = new LinkedHashMap<>();
		try {
			JsonNode node = JSON.readTree(raw);
			for (JsonNode line : node.path("lines")) {
				String slug = line.path("region").asText("");
				String text = line.path("line").asText("");
				if (slug.isBlank() || text.isBlank()) {
					continue;
				}
				try {
					lines.put(SupportedRegion.fromSlug(slug), text);
				}
				catch (RuntimeException e) {
					log.debug("모르는 지역 slug를 받았습니다. slug={}", slug);
				}
			}
		}
		catch (Exception e) {
			log.warn("카드 문장 응답을 읽지 못했습니다.");
			return Map.of();
		}
		return lines;
	}

	private static String trim(String question) {
		if (question == null) {
			return "";
		}
		String squeezed = question.strip();
		return squeezed.length() > MAX_QUESTION_LENGTH
				? squeezed.substring(0, MAX_QUESTION_LENGTH)
				: squeezed;
	}
}
