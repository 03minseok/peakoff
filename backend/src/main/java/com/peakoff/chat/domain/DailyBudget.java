package com.peakoff.chat.domain;

import java.time.Clock;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 하루에 LLM을 몇 번까지 부를지. <b>크레딧이 바닥나기 전에 우리가 먼저 멈춘다.</b>
 *
 * <h3>왜 개인 제한과 따로 있는가</h3>
 * {@link CallLimiter}는 <b>한 사람</b>이 남을 밀어내지 못하게 한다. 그것만으로는
 * 사람이 많을 때 하루치가 오전에 사라지는 것을 못 막는다 — 각자는 규칙을 지켰는데
 * 합이 넘는다. 이 클래스가 그 합을 본다.
 *
 * <h3>⚠️ 닿으면 끄되, 화면은 살아 있어야 한다</h3>
 * 상한에 닿았을 때 오류를 던지면 <b>홈 화면 한 칸이 빨갛게 죽는다.</b> 그래서 이 클래스는
 * 던지지 않고 {@code false}만 돌려준다 — 부르는 쪽은 LLM을 건너뛰고 조용히 폴백한다
 * (서버가 만든 문장, 또는 기존 설문 안내). <b>사용자는 무엇이 꺼졌는지 알 필요가 없다.</b>
 *
 * <h3>세는 단위는 "질문"이 아니라 "호출"이다</h3>
 * 질문 하나가 LLM을 두 번 부른다(의도 추출 · 카드 문장). 돈이 나가는 것은 호출이므로
 * 호출을 센다. 남은 자리가 하나뿐이면 앞의 호출만 나가고 뒤는 폴백으로 채워진다 —
 * <b>질문 단위로 예약해 두면 자리가 남았는데도 거절하게 된다.</b>
 *
 * <h3>자정에 되돌아간다</h3>
 * 날짜는 {@code Clock}이 정한다. 서버 시계가 서울로 맞춰져 있으므로
 * ({@code TimeConfig}) 사용자의 "오늘"과 같은 날에 풀린다. UTC 시계였다면
 * <b>오전 9시에 하루가 바뀌어</b> 이용이 몰리는 저녁에 상한이 남지 않는다.
 *
 * <p>메모리에만 둔다. 재시작하면 0에서 시작하므로 그날 한도가 다시 열리지만,
 * 서버를 하루에 몇 번씩 재시작하는 상황이 아니라면 실제 초과분은 작다.
 * 저장소를 붙이는 값은 여기서 지키려는 금액보다 크다.
 */
public final class DailyBudget {

	private final Clock clock;
	private final int limit;

	/**
	 * 오늘 날짜와 오늘 쓴 횟수를 <b>한 덩어리로</b> 들고 있다.
	 *
	 * <p>날짜와 숫자를 따로 두면 자정 언저리에 <b>어제 숫자가 오늘에 얹히거나</b>
	 * 오늘 숫자가 0으로 덮인다. 둘을 함께 갈아끼우면 그 틈이 없다.
	 */
	private final AtomicReference<Usage> usage;

	public DailyBudget(Clock clock, int limit) {
		if (limit < 0) {
			throw new IllegalArgumentException("하루 상한은 0 이상이어야 합니다. 입력값: " + limit);
		}
		this.clock = clock;
		this.limit = limit;
		this.usage = new AtomicReference<>(new Usage(LocalDate.now(clock), 0));
	}

	/**
	 * 한 번 부를 자리를 가져간다.
	 *
	 * <p>여러 요청이 동시에 물으면 <b>합해서 상한을 넘지 않아야</b> 하므로,
	 * 읽고 쓰는 사이에 남이 끼어들었으면 다시 읽는다(CAS).
	 *
	 * @return 자리를 가져갔으면 {@code true}. {@code false}면 <b>LLM을 부르지 않고 폴백한다</b>
	 */
	public boolean tryConsume() {
		LocalDate today = LocalDate.now(clock);
		while (true) {
			Usage current = usage.get();
			Usage onToday = current.date().equals(today) ? current : new Usage(today, 0);
			if (onToday.used() >= limit) {
				// 날짜가 바뀌었다면 0으로 되돌린 사실은 남긴다 — 다음 요청이 다시 계산하지 않게.
				usage.compareAndSet(current, onToday);
				return false;
			}
			if (usage.compareAndSet(current, new Usage(today, onToday.used() + 1))) {
				return true;
			}
		}
	}

	/**
	 * 자리가 남았는지 <b>쓰지 않고</b> 본다. 화면이 처음 뜰 때 챗봇을 그릴지 정하는 데 쓴다.
	 *
	 * <p>이 답이 {@code true}여도 실제 호출은 실패할 수 있다(그 사이 남이 마지막 자리를
	 * 가져갔다면). 그래서 <b>이것으로 대신 검사하지 않는다</b> — 부르기 직전에는 언제나
	 * {@link #tryConsume()}이 한 번 더 판단한다.
	 */
	public boolean hasRoom() {
		return remaining() > 0;
	}

	/** 오늘 남은 호출 수. 날짜가 바뀌었으면 상한 그대로다. */
	public int remaining() {
		Usage current = usage.get();
		int used = current.date().equals(LocalDate.now(clock)) ? current.used() : 0;
		return Math.max(0, limit - used);
	}

	public int limit() {
		return limit;
	}

	private record Usage(LocalDate date, int used) {
	}
}
