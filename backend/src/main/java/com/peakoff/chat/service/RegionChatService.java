package com.peakoff.chat.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.peakoff.chat.domain.CallLimiter;
import com.peakoff.chat.domain.CardLineWriter;
import com.peakoff.chat.domain.DailyBudget;
import com.peakoff.chat.domain.Interest;
import com.peakoff.chat.domain.IntentReader;
import com.peakoff.chat.domain.QuestionIntent;
import com.peakoff.chat.domain.RegionCard;
import com.peakoff.chat.domain.RegionCards;
import com.peakoff.chat.domain.RegionChatPicker;
import com.peakoff.chat.domain.RegionProfile;
import com.peakoff.chat.domain.RegionProfileProvider;
import com.peakoff.chat.dto.ChatResponse;
import com.peakoff.global.error.TooManyRequestsException;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 질문 하나를 지역 카드 둘~셋으로 바꾼다.
 *
 * <h2>층이 셋이고 <b>가운데가 우리 것</b>이다</h2>
 * <pre>
 *   LLM ①  질문 → 관심사        (고르기)
 *   서버    관심사 → 지역        ← 판단은 전부 여기서 한다
 *   LLM ②  값 → 문장            (옮기기)
 * </pre>
 * 위아래가 다 죽어도 가운데는 돈다. LLM ①이 없으면 관심사 없이 한적한 곳을 고르고,
 * LLM ②가 없으면 서버 템플릿이 문장을 쓴다. <b>화면이 비는 경우는 없다.</b>
 *
 * <h2>문을 지나는 순서</h2>
 * <ol>
 *   <li><b>개인 제한</b> — 연타를 막는다. 유일하게 오류(429)로 나가는 자리다</li>
 *   <li><b>하루 상한</b> — 닿으면 조용히 폴백. 오류가 아니다</li>
 *   <li><b>의도 읽기</b> — 실패하면 폴백, 무관한 질문이면 물러난다</li>
 *   <li><b>지역 고르기</b> — 여기가 서버의 판단</li>
 *   <li><b>문장 쓰기</b> — 실패해도 카드는 이미 완성돼 있다</li>
 * </ol>
 *
 * <h2>⚠️ 완성된 답을 캐시하지 않는다</h2>
 * 지역은 <b>매번 새로 뽑는다.</b> 서버가 답을 캐시해 모두에게 돌려주면 분산이 통째로 죽고,
 * 그러면 우리가 미는 지역이 새로운 혼잡지가 된다 — 이 서비스가 하지 말자고 만든 일이다.
 * 캐시는 원자료 층(공사 응답, 의도 추출)에만 있다.
 */
@Service
@RequiredArgsConstructor
public class RegionChatService {

	private static final Logger log = LoggerFactory.getLogger(RegionChatService.class);

	/** 이번 주. 홈의 "이번 주 한적한 곳"과 같은 창이라야 두 화면의 숫자가 어긋나지 않는다. */
	private static final int FORECAST_DAYS = 7;

	/**
	 * 지역 프로필을 만드는 쪽. <b>없을 수 있다.</b>
	 *
	 * <p>목업 구간에서는 빈 값이다 — 프로필은 카탈로그와 예측을 함께 봐야 만들어지는데
	 * 목업 카탈로그는 경주 한 곳뿐이라 견줄 것이 없다. 그때 챗봇은 조용히 꺼진다.
	 */
	private final Optional<RegionProfileProvider> profileProvider;

	private final RegionChatPicker picker;
	private final IntentReader intentReader;
	private final CardLineWriter cardLineWriter;
	private final CallLimiter limiter;
	private final DailyBudget budget;
	private final Clock clock;

	/** 화면이 처음 뜰 때 챗봇을 그릴지 정하는 데 쓴다. */
	public boolean isAvailable() {
		return profileProvider.isPresent() && intentReader.isAvailable() && budget.hasRoom();
	}

	/**
	 * @param question 사용자가 친 질문
	 * @param callerKey 게스트는 IP, 회원은 사용자 ID로 만든 열쇠
	 * @throws TooManyRequestsException 연타로 막혔을 때. <b>이것만 오류로 나간다</b>
	 */
	public ChatResponse answer(String question, String callerKey) {
		CallLimiter.Verdict verdict = limiter.tryAcquire(callerKey);
		if (!verdict.allowed()) {
			throw new TooManyRequestsException(
					"잠시 후 다시 시도해주세요.", verdict.retryAfterSeconds());
		}

		if (profileProvider.isEmpty()) {
			return ChatResponse.unavailable();
		}

		Optional<QuestionIntent> intent = readIntent(question);
		if (intent.isEmpty()) {
			// 인증키 없음 · 상한 · 시간 초과. 화면은 기존 설문으로 안내한다.
			return ChatResponse.unavailable();
		}
		if (!intent.get().relevant()) {
			return ChatResponse.offTopic();
		}

		Interest interest = intent.get().interest();
		List<RegionProfile> picked = picker.pick(
				profileProvider.get().profiles(LocalDate.now(clock), FORECAST_DAYS), interest);
		if (picked.isEmpty()) {
			/*
			 * 예측 자료가 하나도 없는 상황. 공사가 흔들릴 때 일어난다.
			 * 카드에 적을 숫자가 없으므로 지역을 추천할 근거가 없다 — 조용히 물러난다.
			 */
			log.warn("챗봇이 세울 지역이 없습니다. interest={}", interest);
			return ChatResponse.unavailable();
		}

		List<RegionCard> cards = RegionCards.of(interest, picked, writeLines(question, interest, picked));
		return ChatResponse.ok(interest, cards);
	}

	/**
	 * 의도 읽기. <b>하루 상한을 먼저 확인한다.</b>
	 *
	 * <p>캐시에 있는 질문이면 호출이 나가지 않는데도 상한을 하나 쓰게 된다.
	 * 그 손해를 감수하는 이유: 캐시 적중 여부를 미리 알려면 캐시를 두 번 뒤져야 하고,
	 * 그러면 <b>상한을 세는 자리와 부르는 자리가 갈라진다.</b> 갈라진 두 곳은 언젠가 어긋난다.
	 */
	private Optional<QuestionIntent> readIntent(String question) {
		if (!intentReader.isAvailable()) {
			return Optional.empty();
		}
		if (!budget.tryConsume()) {
			log.info("챗봇 하루 상한에 닿았습니다. 남은 요청은 설문으로 폴백합니다.");
			return Optional.empty();
		}
		return intentReader.read(question);
	}

	/**
	 * 카드 문장. <b>못 써도 그만이다</b> — 부르는 쪽이 템플릿으로 채운다.
	 *
	 * <p>여기서 상한이 걸려도 화면은 멀쩡하다. 의도 하나만 읽고 문장은 서버가 쓰는,
	 * <b>반쯤 켜진 상태</b>가 자연스럽게 만들어진다.
	 */
	private Map<SupportedRegion, String> writeLines(
			String question, Interest interest, List<RegionProfile> picked) {

		if (!cardLineWriter.isAvailable() || !budget.tryConsume()) {
			return Map.of();
		}
		return cardLineWriter.write(question, interest, picked);
	}
}
