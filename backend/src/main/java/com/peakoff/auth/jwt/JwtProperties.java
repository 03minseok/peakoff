package com.peakoff.auth.jwt;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT 설정. {@code application.yaml}의 {@code peakoff.jwt} 아래 값을 받는다.
 *
 * @param secret   서명 키. 환경변수 {@code PEAKOFF_JWT_SECRET}로 넣는다.
 *                 비어 있으면 {@link JwtProvider}가 임의 키를 만들어 뜬다
 * @param validity 토큰 유효 기간
 */
@ConfigurationProperties(prefix = "peakoff.jwt")
public record JwtProperties(String secret, Duration validity) {
}
