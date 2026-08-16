package com.peakoff.global.config;

import java.util.concurrent.ThreadLocalRandom;
import java.util.random.RandomGenerator;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 난수를 빈으로 꺼낸다.
 *
 * <p>{@link TimeConfig}의 시계와 같은 이유다. 추천 분산은 일부러 결과를 흔드는 장치라,
 * 코드 안에서 난수를 직접 만들면 <b>"거리 제한을 지켰는가", "같은 장소가 두 번 들어가지 않는가"</b>
 * 같은 것을 테스트에서 확인할 방법이 사라진다. 씨앗을 고정한 난수를 밖에서 넣을 수 있어야 한다.
 */
@Configuration
public class RandomConfig {

	/**
	 * 스레드별 난수원을 쓴다.
	 *
	 * <p>{@code RandomGenerator}의 기본 구현들은 내부 상태를 들고 있어 여러 스레드가 나눠 쓰면
	 * 경합이 생긴다. 웹 요청은 스레드가 제각각이므로, 상태를 스레드마다 따로 두는 쪽이 안전하다.
	 */
	@Bean
	public RandomGenerator randomGenerator() {
		return new RandomGenerator() {
			@Override
			public long nextLong() {
				return ThreadLocalRandom.current().nextLong();
			}
		};
	}
}
