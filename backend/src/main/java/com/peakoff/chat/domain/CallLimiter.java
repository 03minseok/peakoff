package com.peakoff.chat.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한 사람이 짧은 시간에 몇 번까지 부를 수 있는지. <b>연타만 걸리고 정상 사용자는 안 걸리는 선.</b>
 *
 * <h3>왜 필요한가</h3>
 * 챗봇 한 번이 곧 유료 LLM 호출이다. 크레딧이 유한하므로 <b>버튼을 계속 누르는 것만으로
 * 서비스가 멈출 수 있다.</b> 심사 기간 중에 그 일이 나면 되돌릴 방법이 없다.
 *
 * <p>{@link DailyBudget}과 층이 다르다. 이쪽은 <b>한 사람이 남을 밀어내지 못하게</b> 하고,
 * 그쪽은 <b>전체가 크레딧을 다 태우지 못하게</b> 한다. 둘 중 하나만으로는 부족하다 —
 * 개인 제한만 있으면 사람이 많을 때 하루치가 오전에 사라지고, 전체 상한만 있으면
 * 한 사람이 그 상한을 혼자 가져간다.
 *
 * <h3>고정 구간이 아니라 미끄러지는 창이다</h3>
 * "5분마다 0으로 되돌리는 칸"이 코드는 더 짧다. 그런데 그 방식은 두 가지가 틀어진다:
 * <ul>
 *   <li>칸 경계에서 <b>두 배가 통과한다</b> — 4분 59초에 열 번, 5분 1초에 또 열 번</li>
 *   <li>경계가 <b>모두에게 같은 시각</b>이라, 걸린 사람들이 정각에 함께 풀려 다시 몰린다</li>
 * </ul>
 * 그래서 열쇠마다 <b>통과한 시각을 그대로 들고</b> 창 안의 것만 센다. 창을 벗어난 시각은
 * 물어볼 때 앞에서 버린다 — 따로 청소하는 일이 없다.
 *
 * <h3>⚠️ 막힌 호출은 기록하지 않는다</h3>
 * 거절당한 시도까지 창에 넣으면, 화면이 실패를 자동으로 재시도하는 순간
 * <b>영영 풀리지 않는다</b> — 5분 안에 계속 두드리니 창이 계속 새로 채워진다.
 * 우리가 지키려는 것은 <b>크레딧</b>이고 거절된 호출은 크레딧을 쓰지 않는다.
 * 그러니 통과한 것만 센다.
 *
 * <h3>{@code RegionCache}와 같은 구조 — Map + 시간</h3>
 * 열쇠마다 값 하나, 시간이 지나면 버린다. 캐시 구현체를 의존성으로 더하지 않는 이유도 같다
 * (필요한 것이 이게 전부다). 다만 담는 것이 "받아온 자료"가 아니라 "부른 시각"이라
 * {@code TtlCache}를 재사용하지 않고 따로 두었다 — 그쪽은 열쇠 하나에 값이 하나인데
 * 여기는 열쇠 하나에 <b>시각이 여럿</b>이다.
 *
 * <p>서버가 하나뿐이라 메모리에 둔다. 재시작하면 모두 0에서 시작하지만, 그 손해는
 * "제한이 잠깐 느슨해지는" 쪽이라 크레딧을 태우지 않는다.
 */
public final class CallLimiter {

	/**
	 * 창 하나에 허용하는 횟수.
	 *
	 * <p>자기 질문 몇 개를 던져도 남을 만큼으로 잡는다 — <b>정상 사용자가 걸리면 제한이 아니라
	 * 고장으로 읽힌다.</b> 반대로 연타는 초 단위로 쌓이므로 금방 넘긴다.
	 *
	 * <p>⚠️ <b>10에서 20으로 올렸다</b> (2026-09-09). 질문 하나가 요청 <b>둘</b>이 됐기 때문이다 —
	 * 카드를 먼저 받고({@code /regions}) 문장을 따로 받는다({@code /regions/lines}).
	 * <b>LLM 호출 수는 그대로다</b>: 예전에도 요청 하나가 모델을 최대 두 번 불렀다.
	 * 세는 단위가 호출에서 요청으로 바뀌었을 뿐이라, 값을 두 배로 두어야 사용자가 쓸 수 있는
	 * 질문 수가 예전과 같아진다.
	 */
	public static final int DEFAULT_LIMIT = 20;

	/** 세는 구간. 5분이면 "방금 몰아친 것"과 "천천히 쓰는 것"이 갈린다. */
	public static final Duration DEFAULT_WINDOW = Duration.ofMinutes(5);

	/**
	 * 들고 있을 열쇠 수의 상한.
	 *
	 * <p>열쇠가 IP라 <b>누가 얼마나 만들지 우리가 정하지 못한다.</b> 상한이 없으면
	 * 주소를 바꿔 가며 두드리는 것만으로 메모리가 샌다({@code TtlCache}가 없는 콘텐츠 ID로
	 * 무한히 자라던 것과 같은 모양이다).
	 */
	public static final int MAX_KEYS = 2_000;

	private final Clock clock;
	private final int limit;
	private final Duration window;

	/**
	 * 열쇠 → 창 안에서 통과한 시각들(오래된 것이 앞).
	 *
	 * <p>{@link ArrayDeque}는 여러 스레드가 함께 만지면 깨지므로 덱마다 잠근다.
	 * 잠그는 범위가 <b>한 사람</b>이라 다른 사용자의 요청은 기다리지 않는다.
	 */
	private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

	public CallLimiter(Clock clock) {
		this(clock, DEFAULT_LIMIT, DEFAULT_WINDOW);
	}

	public CallLimiter(Clock clock, int limit, Duration window) {
		if (limit < 1) {
			throw new IllegalArgumentException("허용 횟수는 1 이상이어야 합니다. 입력값: " + limit);
		}
		this.clock = clock;
		this.limit = limit;
		this.window = window;
	}

	/**
	 * 한 번 부를 자격을 묻는다. <b>통과하면 그 자리에서 한 번 쓴 것으로 센다.</b>
	 *
	 * @param key 게스트는 IP, 회원은 사용자 ID로 만든 문자열. 누가 만드는지는 부르는 쪽이 정한다 —
	 *            이 클래스는 열쇠의 뜻을 모른다
	 */
	public Verdict tryAcquire(String key) {
		Instant now = clock.instant();
		Instant cutoff = now.minus(window);

		evictIfCrowded(cutoff, key);

		Deque<Instant> recent = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
		synchronized (recent) {
			// 창을 벗어난 시각은 앞에서 버린다. 청소를 따로 돌리지 않아도 되는 이유다.
			while (!recent.isEmpty() && !recent.peekFirst().isAfter(cutoff)) {
				recent.pollFirst();
			}
			if (recent.size() >= limit) {
				// 가장 오래된 것이 창을 벗어나는 순간이 곧 다음 자리가 나는 시각이다.
				return Verdict.denied(secondsUntil(now, recent.peekFirst().plus(window)));
			}
			recent.addLast(now);
			return Verdict.ALLOWED;
		}
	}

	/**
	 * 열쇠가 너무 많아지면 <b>죽은 것부터</b> 버린다.
	 *
	 * <p>{@code TtlCache}는 상한을 넘으면 통째로 비운다. 여기서 같은 일을 하면
	 * <b>주소를 바꿔 가며 두드리는 것만으로 남들의 제한이 함께 풀린다</b> — 비우는 행위가
	 * 공격 수단이 된다. 그래서 먼저 <b>창을 벗어난 열쇠</b>만 고른다. 그것들은 어차피
	 * 다음에 물어보면 빈 덱과 같으므로 버려도 잃는 정보가 없다.
	 *
	 * <p>그러고도 넘치면 그때는 통째로 비운다. 메모리가 새는 것보다는 낫고,
	 * 이 서비스에서 5분 안에 서로 다른 주소 2,000개가 오는 일은 사실상 없다.
	 */
	private void evictIfCrowded(Instant cutoff, String key) {
		if (hits.size() < MAX_KEYS || hits.containsKey(key)) {
			return;
		}
		for (Iterator<Map.Entry<String, Deque<Instant>>> it = hits.entrySet().iterator(); it.hasNext(); ) {
			Deque<Instant> recent = it.next().getValue();
			boolean dead;
			synchronized (recent) {
				Instant last = recent.peekLast();
				dead = last == null || !last.isAfter(cutoff);
			}
			if (dead) {
				it.remove();
			}
		}
		if (hits.size() >= MAX_KEYS) {
			hits.clear();
		}
	}

	/**
	 * 남은 시간을 <b>올림</b>해서 초로. 0초를 돌려주면 화면이 "지금 다시"로 읽어 곧장 또 부른다.
	 */
	private static long secondsUntil(Instant now, Instant target) {
		Duration remaining = Duration.between(now, target);
		return Math.max(1, (remaining.toNanos() + 999_999_999L) / 1_000_000_000L);
	}

	/**
	 * 물음의 답.
	 *
	 * @param allowed           부를 수 있는가
	 * @param retryAfterSeconds 막혔다면 몇 초 뒤에 자리가 나는지. 통과했으면 0.
	 *                          <b>화면이 그만큼 버튼을 잠근다</b> — 막연히 "잠시 후"라고만 하면
	 *                          사용자는 계속 눌러 보는 수밖에 없다
	 */
	public record Verdict(boolean allowed, long retryAfterSeconds) {

		static final Verdict ALLOWED = new Verdict(true, 0);

		static Verdict denied(long retryAfterSeconds) {
			return new Verdict(false, retryAfterSeconds);
		}
	}
}
