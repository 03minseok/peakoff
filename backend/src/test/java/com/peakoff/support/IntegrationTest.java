package com.peakoff.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;

/**
 * 서버 전체를 띄우는 테스트에 붙인다.
 *
 * <p>붙이는 이유가 두 가지다.
 *
 * <p><b>1. 테스트가 실제 DB 파일을 건드리지 않게 한다.</b>
 * 운영 설정은 {@code jdbc:h2:file:./data/peakoff}라 그대로 두면 테스트를 돌릴 때마다
 * 개발 중인 DB에 계정이 쌓이고, 이메일 중복 테스트가 두 번째 실행부터 실패한다.
 *
 * <p><b>2. 토큰 서명 키를 고정한다.</b>
 * 키가 없으면 {@code JwtProvider}가 임의 키를 만들어 경고를 남기는데,
 * 테스트마다 경고가 찍히면 진짜 문제를 가린다.
 *
 * <p>설정 값을 모든 테스트가 <b>똑같이</b> 쓰는 것이 중요하다. 클래스마다 다르게 주면
 * 스프링이 컨텍스트를 따로 만들어 캐시가 갈리고, 테스트 전체가 느려진다.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
		"spring.datasource.url=jdbc:h2:mem:peakoff-test;DB_CLOSE_DELAY=-1",
		"spring.jpa.hibernate.ddl-auto=create-drop",
		// 실제 키가 아니다. 길이 조건(32바이트 이상)만 맞춘 테스트 전용 값이다.
		"peakoff.jwt.secret=peakoff-test-signing-key-for-junit-only-32b"
})
public @interface IntegrationTest {
}
