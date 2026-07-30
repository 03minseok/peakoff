package com.peakoff.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

/**
 * API 문서 설정. Swagger UI는 {@code /swagger-ui.html}에서 열린다.
 *
 * <p>문서를 두는 이유가 두 가지다. 하나는 프론트 담당이 서버를 띄우지 않고도 규격을 볼 수 있는 것,
 * 다른 하나는 심사 때 "어떤 API를 어떻게 쓰는지"를 화면으로 보여줄 수 있는 것이다.
 *
 * <p>설명 문구에 특정 기관명을 쓰지 않는다. 출처는 "공공데이터"로만 표기한다.
 */
@Configuration
public class OpenApiConfig {

	@Bean
	public OpenAPI peakoffOpenApi() {
		return new OpenAPI().info(new Info()
				.title("PEAKOFF API")
				.version("v1")
				.description("""
						예측 기반 혼잡 회피 여행 플래너.

						사용자가 직접 짠 코스를 공공데이터로 진단하고, 더 한적한 장소와 날짜를 제안한다.

						한적도·추천도는 모두 0~100 정수이며 클수록 한적하다.
						혼잡 값은 실시간 관측이 아니라 예측·통계에 기반한 값이다.
						"""));
	}
}
