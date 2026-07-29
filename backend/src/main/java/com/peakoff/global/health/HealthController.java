package com.peakoff.global.health;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서버 생존 확인용 엔드포인트.
 * 프론트엔드-백엔드 연결과 배포 상태 점검에만 쓰이며, 도메인 로직은 담지 않는다.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("status", "ok");
	}
}
