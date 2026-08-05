package com.peakoff.global.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 시간을 빈으로 꺼낸다.
 *
 * <p>{@code Instant.now()}를 코드 안에서 직접 부르면 그 값을 테스트에서 고정할 방법이 없다.
 * "가입 시각과 약관 동의 시각이 같은가" 같은 것을 확인하려면 시계를 밖에서 넣을 수 있어야 한다.
 */
@Configuration
public class TimeConfig {

	@Bean
	public Clock clock() {
		return Clock.systemUTC();
	}
}
