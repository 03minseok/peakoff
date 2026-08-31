package com.peakoff.external.kto;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.external.kto.support.KtoCallLog;
import com.peakoff.global.response.ApiResponse;

/**
 * 오늘 공사 API를 몇 번 불렀는지 본다.
 *
 * <p>일일 한도가 있고 소진되면 하루 종일 막히기 때문에({@code docs/OPEN_DECISIONS.md} 15번),
 * <b>넘기기 전에</b> 알아야 한다. 이 화면이 그 답을 준다.
 *
 * <h3>⚠️ 개발 기기에서만 뜬다</h3>
 * 개발 중에 보는 값이지 사용자에게 줄 값이 아니다. 무엇보다 <b>운영에서 열려 있으면
 * 우리 호출 습관이 그대로 밖으로 나간다.</b> {@code peakoff.dev.endpoints}가 켜져 있을 때만
 * 빈이 만들어진다 — 보안 설정으로만 막으면 "허용 목록에 실수로 넣는" 경로가 남는다.
 *
 * <p>⚠️ <b>프로파일로 가르지 않는다.</b> 이 저장소는 {@code spring.config.import}로
 * {@code application-local.yml}을 프로파일과 무관하게 불러온다. 그래서 "local 프로파일"은
 * 활성화되는 일이 없고 {@code @Profile("local")}은 영원히 꺼져 있다 —
 * 실제로 그렇게 만들었다가 이 경로가 열리지 않아 찾아낸 사실이다.
 */
@Tag(name = "개발용", description = "공사 API 호출 수 확인 (개발 기기 전용)")
@ConditionalOnProperty(name = "peakoff.dev.endpoints", havingValue = "true")
@RestController
@RequestMapping("/api/dev/kto-calls")
public class KtoCallLogController {

	private final KtoCallLog callLog;
	private final Clock clock;

	public KtoCallLogController(KtoCallLog callLog, Clock clock) {
		this.callLog = callLog;
		this.clock = clock;
	}

	@Operation(summary = "공사 API 호출 수",
			description = "날짜를 주지 않으면 오늘. 활용신청 단위(API별)로 센다 — 한도가 그 단위라서다.")
	@GetMapping
	public ApiResponse<Map<String, Object>> counts(@RequestParam(required = false) LocalDate date) {
		LocalDate target = date != null ? date : LocalDate.now(clock);
		Map<String, KtoCallLog.Counts> counts = callLog.countsOf(target);

		List<Map<String, Object>> rows = counts.entrySet().stream()
				.map(entry -> {
					KtoCallLog.Counts value = entry.getValue();
					Map<String, Object> row = new LinkedHashMap<>();
					row.put("api", entry.getKey());
					row.put("total", value.total());
					row.put("success", value.success());
					row.put("failure", value.failure());
					/*
					 * 한도 대비 몇 %인지 함께 준다. 숫자만 보면 "37회"가 많은지 적은지 모른다.
					 * ⚠️ 한도는 <b>가정값</b>이다 — 포털에서 확인되면 상수를 고친다.
					 */
					row.put("percentOfAssumedLimit",
							Math.round(value.total() * 1000.0 / KtoCallLog.ASSUMED_DAILY_LIMIT) / 10.0);
					return row;
				})
				.toList();

		Map<String, Object> body = new LinkedHashMap<>();
		body.put("date", target);
		body.put("assumedDailyLimit", KtoCallLog.ASSUMED_DAILY_LIMIT);
		body.put("apis", rows);
		body.put("totalAllApis", rows.stream().mapToLong(row -> (long) row.get("total")).sum());
		body.put("recordedDates", callLog.recordedDates());
		/*
		 * 이 수가 <b>하한</b>이라는 것을 응답이 직접 말한다. 분석 스크립트는 서버를 거치지 않고
		 * 공사를 부르므로 여기 안 남는다 — 그 사실을 문서에만 적어 두면 숫자를 볼 때 잊는다.
		 */
		body.put("note", "서버를 거친 호출만 셉니다. analysis/**의 파이썬 스크립트와 "
				+ "같은 인증키를 쓰는 다른 배포본의 호출은 여기 없습니다 — 이 수는 하한입니다.");
		return ApiResponse.ok(body);
	}
}
