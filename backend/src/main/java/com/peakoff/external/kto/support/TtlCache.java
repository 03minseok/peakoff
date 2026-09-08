package com.peakoff.external.kto.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * 공사 자료 캐시의 알맹이. 문자열 열쇠에 값 하나, TTL, 그리고 <b>실패의 기억</b>.
 *
 * <p>{@link RegionCache}(지역 단위)와 장소 상세 캐시(콘텐츠 ID 단위)가 같은 규칙을 쓰도록
 * 한 곳에 모았다. 각자 들고 있으면 실패 처리 같은 규칙이 한쪽에만 고쳐진다.
 *
 * <h3>실패를 60초 기억한다</h3>
 * 예전에는 성공한 값만 담았다. 그래서 공사 호출이 실패하는 동안은 <b>캐시가 없는 것과 같았다</b> —
 * 담을 값이 없으니 다음 요청이 또 부르고, 또 실패하고, 또 부른다.
 *
 * <p>실제로 일이 났다(2026-08-26). 일일 요청 한도에 걸린 뒤 클라이언트 하나가 1.2초마다
 * 두드렸는데, 요청마다 공사 호출이 그대로 나가 <b>39분 동안 1,912번</b>을 실패로 태웠다.
 * 자정에 한도가 풀렸는데도 loop가 계속 돌아 다음 날 치까지 소진했다.
 *
 * <p>이제 실패하면 60초간 그 열쇠를 다시 부르지 않는다. 이 사이의 요청은:
 * <ul>
 *   <li>수명이 지난 옛 값이라도 있으면 <b>그것을 돌려준다</b> — 공사 자료는 하루 한 번
 *       갱신되므로 6시간 지난 값도 빈 화면·500보다 낫다</li>
 *   <li>아무것도 없으면 공사를 부르지 않고 즉시 실패한다</li>
 * </ul>
 *
 * <p>⚠️ 이것은 <b>호출을 대체하는 장치가 아니다.</b> 60초 뒤에는 다시 시도하므로 회복은
 * 자동이고, 정상일 때의 호출 빈도는 변하지 않는다. 죽은 서버를 계속 두드리지 않는 것뿐이다.
 *
 * <h3>빈 응답은 옛 값을 밀어내지 못한다</h3>
 * 공사가 <b>200에 항목 0건</b>을 주는 일이 있다(2026-09-08 여수). 오류가 아니라 정상 응답이라
 * 그대로 담으면 <b>멀쩡하던 옛 값 위에 빈 값이 덮인다</b> — 우리가 스스로 자료를 지우는 셈이다.
 *
 * <p>그래서 {@code usable} 조건을 받아, 쓸 수 없는 값이 왔고 <b>쓸 만한 옛 값이 있으면</b>
 * 옛 값을 지킨다. ⚠️ 이때 <b>예외를 던지지는 않는다</b> — 한 번 그렇게 해 봤더니 지역 하나가
 * 비었다는 이유로 챗봇 전체가 오류가 됐다. 옛 값이 없으면 빈 값을 그대로 돌려주고,
 * 그 지역만 조용히 빠진다.
 *
 * <h3>⚠️ 옛 값에는 나이 한도가 있다</h3>
 * 메꾸는 것은 <b>잠깐 끊길 때</b>이지 오래 버티는 용도가 아니다({@link #MAX_STALE}).
 * 한도를 넘으면 옛 값을 버리고 원래대로 실패한다 — 화면은 "자료가 없다"고 정직하게 말한다.
 *
 * <h3>크기 상한</h3>
 * 지역 캐시는 열쇠가 3개뿐이라 상한이 무의미하지만, 장소 상세는 <b>아무 문자열이나 열쇠가 될 수
 * 있다</b> — 없는 ID로 계속 두드리면(못 찾았다는 답도 담으므로) 캐시가 무한히 자란다.
 * 상한을 넘으면 통째로 비운다. 거칠지만 정확성에는 지장이 없다 — 다시 받아오면 그만이다.
 *
 * @param <T> 캐시할 값. {@code Optional}을 담아도 된다 — "못 찾았다"도 답이다
 */
public class TtlCache<T> {

	/**
	 * 실패를 기억하는 시간.
	 *
	 * <p>너무 길면 공사가 회복돼도 그만큼 늦게 따라가고, 너무 짧으면 죽은 서버를 계속 두드린다.
	 * 60초는 "장애 중 재시도는 분당 한 번"이라는 뜻이다.
	 */
	public static final Duration FAILURE_BACKOFF = Duration.ofSeconds(60);

	/**
	 * 옛 값을 써도 되는 한도.
	 *
	 * <h3>왜 무제한이면 안 되나</h3>
	 * 두 가지가 조용히 망가진다.
	 *
	 * <p><b>하나, 창이 짧아진다.</b> 공사 예측은 받은 날부터 30일치다. 9/5에 받은 값을
	 * 9/25에 쓰면 남은 것은 <b>열흘치뿐</b>인데, 없는 날짜는 그냥 세지 않고 넘어가므로
	 * 화면은 아무 말도 하지 않는다. 카드의 비율이 "30일 중"이 아니라 "남은 열흘 중"이 되는데
	 * 사용자는 그것을 알 방법이 없다.
	 *
	 * <p><b>둘, 성격이 달라진다.</b> 공모전 규칙은 <b>자료를 쌓아 두고 API를 사실상 부르지
	 * 않는 구조</b>를 금지한다. 지금 구조는 규칙 안이다 — 인메모리이고, 계속 물어보되
	 * <b>대답이 없을 때만</b> 직전 값을 쓴다. 그런데 일주일씩 쓰면 "물어보는 서비스"인지
	 * "받아 둔 것을 보여주는 서비스"인지 경계가 흐려진다.
	 *
	 * <h3>왜 사흘인가</h3>
	 * 예측 창이 24~30일이라 사흘이 비어도 계산이 크게 흔들리지 않는다. 그리고 공사 장애가
	 * 사흘을 넘으면 그건 우리가 감출 일이 아니라 <b>알려야 할 일</b>이다.
	 *
	 * <p>같은 날짜의 예측값이 며칠 지나도 바뀌지 않는다는 것은 실측으로 확인했다 —
	 * 경주·제주시·서귀포시에서 최대 3일 간격, 겹친 18,340쌍 중 <b>바뀐 값 0건</b>
	 * ({@code analysis/forecast-drift/DRIFT-LOG.md}). 그래서 옛 값을 쓰는 것이 곧
	 * 틀린 값을 쓰는 것은 아니다. 문제는 값이 아니라 <b>남은 날짜</b>다.
	 */
	public static final Duration MAX_STALE = Duration.ofDays(3);

	private final Clock clock;
	private final Duration ttl;
	private final int maxEntries;
	/** 담을 가치가 있는 값인가. 기본은 <b>무엇이든 담는다</b> */
	private final Predicate<T> usable;
	private final Map<String, Entry<T>> entries = new ConcurrentHashMap<>();
	private final Map<String, Instant> failures = new ConcurrentHashMap<>();

	private record Entry<T>(T value, Instant fetchedAt) {
	}

	public TtlCache(Clock clock, Duration ttl, int maxEntries) {
		this(clock, ttl, maxEntries, value -> true);
	}

	public TtlCache(Clock clock, Duration ttl, int maxEntries, Predicate<T> usable) {
		this.clock = clock;
		this.ttl = ttl;
		this.maxEntries = maxEntries;
		this.usable = usable;
	}

	/**
	 * 캐시가 살아 있으면 그 값을, 아니면 {@code loader}로 새로 받아 담는다.
	 *
	 * <p>동시에 여러 요청이 들어오면 같은 열쇠를 두 번 부를 수 있다. 잠그지 않은 이유는
	 * 첫 호출이 느릴 때 뒤따르는 요청이 모두 멈추기 때문이다 — 최악이 <b>중복 호출 한 번</b>이라
	 * 그대로 둔다.
	 */
	public T get(String key, Function<String, T> loader) {
		Entry<T> cached = entries.get(key);
		if (cached != null && !isExpired(cached)) {
			return cached.value();
		}

		Instant failedAt = failures.get(key);
		if (failedAt != null && withinBackoff(failedAt)) {
			/*
			 * 방금 실패한 열쇠다. 다시 불러 봐야 또 실패할 가능성이 크고,
			 * 실패하는 호출도 한도를 소모한다 — 위 클래스 주석의 1,912번이 그렇게 쌓였다.
			 */
			if (cached != null && !isTooStale(cached)) {
				// 수명이 지난 값이지만 빈 화면보다 낫다. 하루 한 번 갱신되는 자료다.
				return cached.value();
			}
			throw new KtoApiException(
					"공사 OpenAPI 호출이 방금 실패해 잠시 쉬는 중입니다. 곧 다시 시도합니다.");
		}

		try {
			T fresh = loader.apply(key);
			if (!usable.test(fresh) && cached != null && !isTooStale(cached)) {
				/*
				 * 받아 오긴 했는데 담을 가치가 없다(빈 응답). 옛 값을 지키고 그것을 돌려준다.
				 *
				 * ⚠️ <b>실패로 기억한다.</b> 빈 응답이 이어지는 동안 매 요청마다 공사를
				 * 부르면 한도만 태운다 — 60초에 한 번으로 줄인다. 회복은 여전히 자동이다.
				 */
				failures.put(key, clock.instant());
				return cached.value();
			}
			if (entries.size() >= maxEntries) {
				// 없는 ID를 무한히 담으면 메모리가 샌다. 통째로 비워도 다시 받아오면 그만이다.
				entries.clear();
			}
			entries.put(key, new Entry<>(fresh, clock.instant()));
			failures.remove(key);
			return fresh;
		}
		catch (RuntimeException e) {
			failures.put(key, clock.instant());
			if (cached != null && !isTooStale(cached)) {
				/*
				 * 갱신에 실패했지만 쓸 만한 옛 값이 있다. 백오프 안의 다음 요청만이 아니라
				 * <b>실패한 그 요청부터</b> 옛 값을 받아야 한다 — 6시간 1분째의 첫 사용자만
				 * 500을 보는 것은 운으로 갈리는 실패다.
				 */
				return cached.value();
			}
			throw e;
		}
	}

	/** 메꾸기에도 못 쓸 만큼 오래됐는가. 위 {@link #MAX_STALE} 주석 참고 */
	private boolean isTooStale(Entry<T> entry) {
		return Duration.between(entry.fetchedAt(), clock.instant()).compareTo(MAX_STALE) >= 0;
	}

	private boolean isExpired(Entry<T> entry) {
		return Duration.between(entry.fetchedAt(), clock.instant()).compareTo(ttl) >= 0;
	}

	private boolean withinBackoff(Instant failedAt) {
		return Duration.between(failedAt, clock.instant()).compareTo(FAILURE_BACKOFF) < 0;
	}
}
