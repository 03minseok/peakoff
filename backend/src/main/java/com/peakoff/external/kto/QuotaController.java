package com.peakoff.external.kto;

import java.time.Clock;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.external.kto.support.KtoCallLog;
import com.peakoff.global.response.ApiResponse;

/**
 * 오늘 공사 OpenAPI를 몇 번 불렀나 — 읽기 전용, 로그인 없이 열린다.
 *
 * <h2>왜 dev 게이트 밖에 두나</h2>
 * 같은 숫자를 {@code /api/dev/kto-calls}가 이미 내려주지만 그쪽은 {@code PEAKOFF_DEV_ENDPOINTS=true}일 때만
 * 뜬다(운영 기본 off). 이 값은 <b>심사에서 보여줄 것</b>이다 — 공모전 규칙 1("공사 OpenAPI로 가져온다,
 * 파일·DB 적재로 대체하지 않는다")은 인증키 호출 이력으로 검증되는데, 그 이력을 화면으로 가리켜
 * "실제로 부르고 있다"고 답하는 자리가 있어야 한다. 한도는 로그에 묻어 두는 값이 아니라
 * 화면에 세우는 일급 값이다.
 *
 * <p>감출 이유가 없다. 개인과 무관한 집계이고, 한도가 얼마나 남았는지는 우리를 공격할 단서가 아니라
 * 우리가 스스로 봐야 할 계기다(2026-08-26에 한도를 태운 뒤 만든 기록이다).
 *
 * <p>화면은 {@code /preview}의 "백엔드 연결" 아래에서 그린다. 홈에 두지 않는 이유: 사용자에게는
 * 뜻이 없는 숫자다 — 이것은 운영·심사용 계기판이다.
 */
@Tag(name = "운영", description = "공사 OpenAPI 호출 이력")
@RestController
@RequestMapping("/api/quotas")
public class QuotaController {

	private final KtoCallLog callLog;
	private final Clock clock;

	public QuotaController(KtoCallLog callLog, Clock clock) {
		this.callLog = callLog;
		this.clock = clock;
	}

	@Operation(summary = "공사 API 호출 수",
			description = """
					날짜를 주지 않으면 오늘. 활용신청 단위(API별)로 센다 — 한도가 그 단위라서다.

					한도(assumedDailyLimit)는 포털이 알려주지 않아 서버가 가정한 값이다. 비율도 그 가정 기준이다.
					안 부른 API도 0으로 함께 선다 — "안 불렀다"가 보여야 한다.""")
	@GetMapping
	public ApiResponse<KtoCallLog.Summary> today(
			@Parameter(description = "조회할 날짜(yyyy-MM-dd). 비우면 오늘")
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return ApiResponse.ok(callLog.summaryOf(date != null ? date : LocalDate.now(clock)));
	}
}
