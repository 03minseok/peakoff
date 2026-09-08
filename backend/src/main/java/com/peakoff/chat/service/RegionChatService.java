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
import com.peakoff.chat.domain.DateRange;
import com.peakoff.chat.domain.ForecastWindow;
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
import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.error.TooManyRequestsException;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 질문 하나를 지역 카드 둘로 바꾼다.
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
 *   <li><b>기간 정하기</b> — 질문이 가리키는 며칠을 서버가 계산한다. 창 밖이면 그렇다고 말한다</li>
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

	/**
	 * 지역 프로필을 만드는 쪽. <b>없을 수 있다.</b>
	 *
	 * <p>목업 구간에서는 빈 값이다 — 프로필은 카탈로그와 예측을 함께 봐야 만들어지는데
	 * 목업 카탈로그는 경주 한 곳뿐이라 견줄 것이 없다. 그때 챗봇은 조용히 꺼진다.
	 */
	private final Optional<RegionProfileProvider> profileProvider;

	/**
	 * 예측이 어디까지 닿는지 묻는 자리.
	 *
	 * <p>새 호출이 나가지 않는다 — 지역별 예측은 이미 6시간 캐시돼 있고 여기서는
	 * 그 마지막 날만 읽는다. 날짜 고르는 화면이 쓰는 {@code /api/dates/forecast-window}와
	 * <b>같은 값</b>이라, 두 화면이 서로 다른 기간을 말하지 않는다.
	 */
	private final CongestionProvider congestionProvider;

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
	 * 어느 기간을 본다고 화면에 적을지.
	 *
	 * <p>답에 실리는 {@code basis}와 <b>같은 자리에서 나온다.</b> 화면이 제 문구를 들고
	 * 있으면 창이 늘어날 때 머리글만 옛 기간을 말하게 된다.
	 */
	public String basis() {
		return window().label();
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

		/*
		 * 창을 먼저 만든다. 자료가 없어 답하지 못하는 경우에도 <b>기간은 말할 수 있어야</b>
		 * 하기 때문이다 — 화면 머리글이 이 값으로 "어느 기간을 보는지"를 적는다.
		 */
		ForecastWindow window = window();
		String basis = window.label();

		if (profileProvider.isEmpty()) {
			return ChatResponse.unavailable(basis);
		}

		Optional<QuestionIntent> intent = readIntent(question);
		if (intent.isEmpty()) {
			// 인증키 없음 · 상한 · 시간 초과. 화면은 기존 설문으로 안내한다.
			return ChatResponse.unavailable(basis);
		}
		if (!intent.get().relevant()) {
			return ChatResponse.offTopic(basis);
		}
		/*
		 * ■ 물어본 며칠만 센다 (2026-09-08)
		 *
		 * "이번 주말에 사람 적은 바다"에 예측 전체(한 달) 평균으로 답하고 있었다.
		 * 기간을 화면에 적어 두어 거짓말은 아니었지만, <b>물은 기간과 답한 기간이 달랐다.</b>
		 *
		 * <p>그것이 사소하지 않다는 것을 실측이 보여줬다 — 같은 자료를 창만 바꿔 재니
		 * <b>순위가 뒤집힌다.</b> 30일 기준 꼴찌인 서귀포시(20.2%)가 9/12~13 주말에는
		 * 1위(21.8%)이고, 1위였던 통영(51.6%)이 4위(16.5%)로 내려간다.
		 * 주말을 물은 사람에게 한 달 평균으로 답하는 것은 <b>틀린 지역을 주는 일</b>이었다.
		 *
		 * ⚠️ 날짜는 <b>서버가 만든다.</b> 모델은 "3주 뒤 주말"에서 3과 WEEKEND를
		 * 꺼내 줄 뿐이다(AskedPeriod).
		 */
		Optional<DateRange> asked = intent.get().period().resolve(LocalDate.now(clock));

		/*
		 * "내년 여름에 갈 만한 데" — 예측이 닿지 않는 시점이다.
		 *
		 * ⚠️ <b>여기서 물러나는 것이 카드를 내주는 것보다 정직하다.</b> 지금 창의 지역을
		 * 붙이면 사용자는 그것을 물어본 시점의 답으로 읽는다. 답할 수 없다는 말과 함께
		 * <b>어디까지 볼 수 있는지</b>(basis)를 주면, 다시 물을 수 있다.
		 *
		 * <p>기간을 읽어냈으면 <b>그 첫날</b>로 견준다. 못 읽었을 때만 모델의 어림수를
		 * 쓴다 — 우리 달력이 있는데 어림수를 볼 이유가 없다.
		 */
		boolean tooFar = asked.isPresent()
				? !window.covers(asked.get().from())
				: !window.coversHorizon(intent.get().horizonDays());
		if (tooFar) {
			return ChatResponse.tooFar(basis);
		}

		/*
		 * 끝이 창 밖으로 넘치면 잘라서 <b>적은 대로만 센다.</b> 안 자르면 뒤쪽 며칠은
		 * 자료가 없어 관측에 안 잡히고, 그러면 화면에 적힌 기간과 실제로 센 기간이 어긋난다.
		 */
		DateRange counted = asked
				.map(range -> range.clampTo(window.lastDate()))
				.orElseGet(() -> new DateRange(window.from(), window.lastDate()));
		basis = asked.isPresent() ? counted.label() : basis;

		Interest interest = intent.get().interest();
		List<RegionProfile> profiles = profileProvider.get().profiles(counted.from(), counted.days());
		List<RegionProfile> picked = picker.pick(profiles, interest);
		if (picked.isEmpty()) {
			/*
			 * 예측 자료가 하나도 없는 상황. 공사가 흔들릴 때 일어난다.
			 * 카드에 적을 숫자가 없으므로 지역을 추천할 근거가 없다 — 조용히 물러난다.
			 */
			log.warn("챗봇이 세울 지역이 없습니다. interest={}", interest);
			return ChatResponse.unavailable(basis);
		}

		List<RegionCard> cards = RegionCards.of(interest, picked, writeLines(question, interest, picked));
		return ChatResponse.ok(basis, interest, crowdedPeriod(profiles), cards);
	}

	/**
	 * 그 기간이 <b>어디나 붐비는가</b>.
	 *
	 * <p>⚠️ <b>뽑힌 둘이 아니라 열한 곳 전부</b>를 본다. 카드 둘만 보면 거짓이 되는 경우가
	 * 있다 — "사람 적은 바다"를 물으면 뽑힌 둘이 34%·20%로 낮은데, 그것은 <b>기간이
	 * 붐벼서가 아니라 바닷가 지역이 붐벼서</b>다. 같은 기간에 통영은 55%다.
	 * 그 상태로 "이 기간은 어디나 붐빈다"고 하면 화면이 거짓을 말한다.
	 *
	 * <p>실측(2026-09-05 스냅샷)에서 이 판정이 두 상태를 정확히 갈랐다 —
	 * 30일 창은 최고 52%(붐비지 않음), 주말 이틀은 최고 22%(어디나 붐빔).
	 */
	private static boolean crowdedPeriod(List<RegionProfile> profiles) {
		return profiles.stream().anyMatch(RegionProfile::isRankable)
				&& profiles.stream().noneMatch(RegionProfile::hasManyQuietSpots);
	}

	/**
	 * 이번에 볼 기간.
	 *
	 * <p>요청마다 다시 만든다. 창은 <b>날짜가 바뀌면 하루씩 밀리고</b> 공사가 늘리면
	 * 길이도 달라진다 — 서버가 뜰 때 한 번 정해 두면 자정을 넘긴 순간부터 어제 창을 본다.
	 */
	private ForecastWindow window() {
		return ForecastWindow.of(LocalDate.now(clock), congestionProvider.lastForecastDate());
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
