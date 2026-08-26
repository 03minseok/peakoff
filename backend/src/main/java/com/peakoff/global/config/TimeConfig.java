package com.peakoff.global.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 시간을 빈으로 꺼낸다.
 *
 * <p>{@code Instant.now()}를 코드 안에서 직접 부르면 그 값을 테스트에서 고정할 방법이 없다.
 * "가입 시각과 약관 동의 시각이 같은가" 같은 것을 확인하려면 시계를 밖에서 넣을 수 있어야 한다.
 *
 * <h3>UTC가 아니라 서울인 이유 (2026-08-26)</h3>
 * 예전에는 {@code Clock.systemUTC()}였다. {@code Instant}만 볼 때는 시간대가 상관없지만
 * <b>{@code LocalDate.now(clock)}은 갈린다.</b> 한국이 UTC+9라 <b>자정부터 오전 9시까지는
 * 어제 날짜</b>가 나온다.
 *
 * <p>그 시간대에 홈을 열면 "오늘의 경주"가 어제를 보여주고, 날짜 대안이 이미 지난 날을
 * 후보로 올린다. 서버가 어디에 뜨든(UTC로 도는 클라우드가 흔하다) 같은 답이 나와야 한다.
 *
 * <p>서비스 지역이 경주·제주뿐이라 사용자의 "오늘"은 언제나 한국 날짜다.
 * 시간대를 사용자에게서 받아올 필요가 없다.
 */
@Configuration
public class TimeConfig {

	@Bean
	public Clock clock() {
		return Clock.system(ZoneId.of("Asia/Seoul"));
	}
}
