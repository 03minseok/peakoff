package com.peakoff.global.health;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 서버가 떴는지 묻는 자리. 도커 헬스체크와 배포 스크립트가 부른다.
 *
 * <h2>왜 필요한가</h2>
 * 컨테이너를 새로 올린 뒤 <b>언제부터 요청을 받아도 되는지</b>를 알아야 한다.
 * 스프링은 뜨는 데 몇 초가 걸리는데, 그 사이에 옛 컨테이너를 내리면 그 몇 초 동안
 * 심사위원이 빈 화면을 본다. 이 응답이 200이 될 때까지 기다렸다가 바꾸면 된다.
 *
 * <h2>actuator를 넣지 않은 이유</h2>
 * {@code spring-boot-starter-actuator}는 헬스체크 하나 때문에 의존성과 엔드포인트 한 벌을
 * 더 연다. 우리에게 필요한 것은 "떴는가" 하나뿐이고, 그건 이 다섯 줄이면 된다.
 * 모니터링을 붙이게 되면 그때 바꿔도 늦지 않다.
 *
 * <h2>⚠️ 공사 API나 DB를 확인하지 않는다</h2>
 * 여기서 외부를 찔러 보면 <b>헬스체크가 부를 때마다 공사 호출이 나간다.</b>
 * 도커는 이걸 30초마다 부르는데, 그러면 하루 2,880번이다 —
 * 일일 한도를 태운 사고(문서 15번)를 헬스체크로 재현하는 꼴이 된다.
 *
 * <p>DB도 마찬가지다. 이 응답의 뜻은 <b>"서버 프로세스가 요청을 받을 수 있다"</b>까지다.
 */
@Tag(name = "상태", description = "서버가 떴는지 확인")
@RestController
public class HealthController {

	/**
	 * GET /health
	 *
	 * <p>공통 응답 봉투({@code ApiResponse})를 쓰지 않는다. 이건 사람이나 화면이 아니라
	 * <b>도커와 배포 스크립트가</b> 읽는 자리라, 껍데기 없이 상태 코드와 짧은 본문이면 된다.
	 */
	@Operation(summary = "헬스체크", description = "떠 있으면 200. 도커 헬스체크와 배포 스크립트가 쓴다.")
	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("status", "UP");
	}
}
