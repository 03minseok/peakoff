package com.peakoff.global.health;

import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서버 생존 확인용 엔드포인트.
 * 프론트엔드-백엔드 연결과 배포 상태 점검에만 쓰이며, 도메인 로직은 담지 않는다.
 */
@Tag(name = "점검", description = "서버 생존 확인")
@RestController
@RequestMapping("/api")
public class HealthController {

	@Operation(summary = "서버 생존 확인", description = "배포와 프론트 연결 점검에만 쓴다.")
	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("status", "ok");
	}
}
