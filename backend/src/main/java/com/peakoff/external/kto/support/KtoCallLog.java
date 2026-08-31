package com.peakoff.external.kto.support;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 공사 API를 <b>오늘 몇 번 불렀는지</b> 센다.
 *
 * <h2>왜 세는가</h2>
 * 일일 요청 한도가 있고, 한 번 소진되면 <b>하루 종일</b> 막힌다. 2026-08-26에 실제로 났다 —
 * 새벽에 한도가 날아가 상세 조회가 종일 429였고, 심사 데모 중이었으면 치명적이었다.
 * 한도가 정확히 몇인지는 아직 모르지만 개발계정 기본이 보통 1,000회다.
 *
 * <h2>왜 메모리가 아니라 파일인가</h2>
 * 인메모리 카운터는 <b>재시작하면 0이 된다.</b> 그런데 공사 쪽 한도는 우리 프로세스와
 * 무관하게 하루 단위로 쌓인다 — 개발 중에 서버를 열 번 재시작하면 메모리 카운터는
 * "오늘 30번 불렀다"고 하는데 실제로는 300번일 수 있다. 그 숫자로는 정작 알고 싶은
 * "한도를 넘겼나"에 답할 수 없다.
 *
 * <p>파일에 한 줄씩 붙이면 <b>서버가 여럿 떠 있어도 합산된다.</b> 한도는 인증키 단위라
 * 8080과 8081에 각각 띄워 두면 둘이 같은 한도를 나눠 쓰는데, 그 합이 그대로 파일에 남는다.
 *
 * <h2>⚠️ 이 파일이 세지 못하는 것</h2>
 * <ul>
 *   <li><b>분석 스크립트</b>({@code analysis/**}/*.py). 서버를 거치지 않고 직접 부르므로
 *       여기 안 남는다. 실측을 몰아서 할 때는 그쪽 호출 수를 따로 더해야 한다</li>
 *   <li><b>다른 기기·다른 배포본</b>. 같은 인증키를 쓰는 배포 서버가 있으면 그쪽 호출은
 *       그쪽 파일에 쌓인다</li>
 * </ul>
 * 그래서 이 수는 <b>하한</b>이다. 여기서 이미 한도에 가깝다면 실제로는 넘었을 수 있다.
 *
 * <p>⚠️ 호출을 <b>줄이는</b> 장치가 아니다(공모전 규칙). 세기만 한다.
 */
@Component
public class KtoCallLog {

	private static final Logger log = LoggerFactory.getLogger(KtoCallLog.class);

	/**
	 * 활용신청 단위로 이름을 붙인다. <b>한도가 API마다 따로</b>라 이 단위로 세야 뜻이 있다.
	 *
	 * <p>경로 조각으로 가른다 — 오퍼레이션이 늘어도(searchKeyword2 · detailCommon2 …)
	 * 같은 활용신청이면 같은 칸에 쌓인다.
	 */
	private static final Map<String, String> API_NAMES = Map.of(
			"KorService2", "국문 관광정보",
			"TatsCnctrRateService", "집중률 예측",
			"TarRlteTarService1", "연관 관광지",
			"LocgoHubTarService1", "중심 관광지");

	/** 개발계정 기본값으로 알려진 값. <b>확인된 값이 아니다</b> — 포털 마이페이지에서 확인이 필요하다. */
	public static final int ASSUMED_DAILY_LIMIT = 1000;

	/** 이 비율을 넘어서면 로그로 경고한다. 넘고 나서 알면 이미 늦다. */
	private static final double[] WARN_AT = { 0.5, 0.8, 0.95 };

	private final Path directory;
	private final Clock clock;

	/** 이 프로세스가 이미 경고한 지점. 같은 경고를 매 호출마다 찍지 않기 위해서다. */
	private final Map<String, Integer> warnedLevel = new java.util.concurrent.ConcurrentHashMap<>();

	public KtoCallLog(Clock clock) {
		this.clock = clock;
		this.directory = Path.of("data", "kto-calls");
	}

	/**
	 * 호출 한 번을 남긴다. <b>실패도 남긴다</b> — 실패한 호출도 한도를 먹는다.
	 *
	 * <p>기록에 실패해도 요청을 깨뜨리지 않는다. 세는 일이 서비스를 멈출 이유는 없다.
	 */
	public void record(String path, boolean success) {
		String api = apiNameOf(path);
		LocalDateTime now = LocalDateTime.now(clock);
		try {
			Files.createDirectories(directory);
			Files.writeString(fileOf(now.toLocalDate()),
					"%s|%s|%s%n".formatted(now.withNano(0), api, success ? "OK" : "FAIL"),
					StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
		}
		catch (IOException e) {
			log.debug("공사 호출 기록에 실패했습니다. api={}", api, e);
			return;
		}
		warnIfNearLimit(api, todayCounts().getOrDefault(api, Counts.EMPTY).total());
	}

	/** 오늘 API별 호출 수. 파일에서 읽으므로 재시작·다중 프로세스와 무관하다. */
	public Map<String, Counts> todayCounts() {
		return countsOf(LocalDate.now(clock));
	}

	public Map<String, Counts> countsOf(LocalDate date) {
		Path file = fileOf(date);
		Map<String, Counts> result = new LinkedHashMap<>();
		// 표에 늘 같은 순서로 서게 한다. 안 부른 API가 사라지면 "안 불렀다"가 안 보인다.
		API_NAMES.values().stream().sorted().forEach(name -> result.put(name, Counts.EMPTY));
		if (!Files.exists(file)) {
			return result;
		}
		try (Stream<String> lines = Files.lines(file, StandardCharsets.UTF_8)) {
			lines.forEach(line -> {
				String[] parts = line.split("\\|");
				if (parts.length < 3) {
					return;
				}
				result.merge(parts[1], Counts.of("OK".equals(parts[2])), Counts::plus);
			});
		}
		catch (IOException e) {
			log.debug("공사 호출 기록을 읽지 못했습니다. date={}", date, e);
		}
		return result;
	}

	/** 기록이 남아 있는 날짜들. 최근이 앞이다. */
	public List<LocalDate> recordedDates() {
		if (!Files.exists(directory)) {
			return List.of();
		}
		try (Stream<Path> files = Files.list(directory)) {
			return files.map(path -> path.getFileName().toString())
					.filter(name -> name.endsWith(".log"))
					.map(name -> LocalDate.parse(name.substring(0, name.length() - 4)))
					.sorted(java.util.Comparator.reverseOrder())
					.toList();
		}
		catch (Exception e) {
			return List.of();
		}
	}

	private void warnIfNearLimit(String api, long total) {
		int level = 0;
		for (double ratio : WARN_AT) {
			if (total >= ASSUMED_DAILY_LIMIT * ratio) {
				level++;
			}
		}
		if (level == 0 || warnedLevel.getOrDefault(api, 0) >= level) {
			return;
		}
		warnedLevel.put(api, level);
		log.warn("[공사 API] ⚠️ {} 오늘 {}회 — 가정 한도 {}회의 {}%입니다. "
						+ "한도가 소진되면 하루 종일 막힙니다(OPEN_DECISIONS 15번).",
				api, total, ASSUMED_DAILY_LIMIT, Math.round(total * 100.0 / ASSUMED_DAILY_LIMIT));
	}

	private Path fileOf(LocalDate date) {
		return directory.resolve(date + ".log");
	}

	private static String apiNameOf(String path) {
		return API_NAMES.entrySet().stream()
				.filter(entry -> path.contains(entry.getKey()))
				.map(Map.Entry::getValue)
				.findFirst()
				// 새 API를 붙이면 여기 이름을 더한다. 그전까지는 경로를 그대로 남겨 눈에 띄게 한다.
				.orElse("기타(" + path + ")");
	}

	/** API 하나의 오늘 호출 수. 실패를 갈라 두는 이유는 <b>실패도 한도를 먹기 때문</b>이다. */
	public record Counts(long success, long failure) {

		public static final Counts EMPTY = new Counts(0, 0);

		static Counts of(boolean success) {
			return success ? new Counts(1, 0) : new Counts(0, 1);
		}

		Counts plus(Counts other) {
			return new Counts(success + other.success, failure + other.failure);
		}

		public long total() {
			return success + failure;
		}
	}
}
