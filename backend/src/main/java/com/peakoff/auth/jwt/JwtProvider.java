package com.peakoff.auth.jwt;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * 토큰을 만들고 검증한다.
 *
 * <p>세션 대신 JWT를 쓰는 이유: 서버가 로그인 상태를 들고 있지 않아도 된다.
 * 코스 진단은 이미 무상태이고, 여기에 세션 저장소를 붙이면 배포에 붙일 것이 하나 늘어난다.
 *
 * <p>토큰에 담는 것은 <b>회원 식별자와 닉네임뿐</b>이다. JWT 본문은 서명만 될 뿐 암호화되지 않아
 * 누구나 열어볼 수 있다. 이메일을 넣으면 토큰을 주운 사람이 그대로 읽는다.
 */
@Component
public class JwtProvider {

	private static final Logger log = LoggerFactory.getLogger(JwtProvider.class);

	/** 닉네임을 담는 클레임 이름. 화면 인사말에 쓰려고 함께 싣는다. */
	private static final String NICKNAME_CLAIM = "nickname";

	/** HS256이 요구하는 최소 키 길이(바이트). 이보다 짧은 비밀값은 거부된다. */
	private static final int MIN_SECRET_BYTES = 32;

	private final SecretKey key;
	private final long validitySeconds;

	public JwtProvider(JwtProperties properties) {
		this.key = resolveKey(properties.secret());
		this.validitySeconds = properties.validity().toSeconds();
	}

	/**
	 * 서명 키를 정한다.
	 *
	 * <p>비밀값이 없으면 <b>임의 키를 만들어 띄운다.</b> 그냥 뜨지 않게 막으면 로컬 개발이
	 * 매번 막히고, 고정된 기본값을 코드에 박아두면 그 값이 그대로 배포되어 누구나 토큰을 위조할 수 있다.
	 * 임의 키는 서버를 재시작할 때마다 바뀌므로 기존 토큰이 무효가 된다 — 그 사실을 경고로 남긴다.
	 */
	private static SecretKey resolveKey(String secret) {
		if (secret == null || secret.isBlank()) {
			log.warn("""
					PEAKOFF_JWT_SECRET이 설정되지 않아 임의 키로 시작합니다.
					서버를 재시작하면 발급된 토큰이 모두 무효가 되어 다시 로그인해야 합니다.
					배포 환경에서는 반드시 환경변수로 값을 넣으세요.""");
			return Jwts.SIG.HS256.key().build();
		}

		byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < MIN_SECRET_BYTES) {
			// 짧은 키는 서명을 추측하기 쉬워진다. 조용히 늘려주면 안전하다고 착각하게 되므로 막는다.
			throw new IllegalStateException(
					"PEAKOFF_JWT_SECRET은 %d바이트 이상이어야 합니다. 현재: %d바이트"
							.formatted(MIN_SECRET_BYTES, bytes.length));
		}
		return Keys.hmacShaKeyFor(bytes);
	}

	public String createToken(Long memberId, String nickname) {
		Instant now = Instant.now();
		return Jwts.builder()
				.subject(String.valueOf(memberId))
				.claim(NICKNAME_CLAIM, nickname)
				.issuedAt(Date.from(now))
				.expiration(Date.from(now.plusSeconds(validitySeconds)))
				.signWith(key)
				.compact();
	}

	/**
	 * 토큰을 검증하고 안에 든 회원 정보를 꺼낸다.
	 *
	 * <p>서명 불일치·만료·형식 오류를 <b>구분하지 않고</b> 하나로 묶어 돌려준다.
	 * "서명이 틀렸다"와 "만료됐다"를 나눠 알려주면 토큰을 맞춰보는 쪽에 힌트가 된다.
	 *
	 * @return 유효하면 회원 정보, 아니면 null
	 */
	public AuthenticatedMember parse(String token) {
		try {
			Claims claims = Jwts.parser()
					.verifyWith(key)
					.build()
					.parseSignedClaims(token)
					.getPayload();

			return new AuthenticatedMember(
					Long.valueOf(claims.getSubject()), claims.get(NICKNAME_CLAIM, String.class));
		} catch (JwtException | IllegalArgumentException e) {
			// 잘못된 토큰은 흔한 일이라(만료·오타) 로그를 남기지 않는다. 남기면 로그가 잡음으로 찬다.
			return null;
		}
	}

	public long validitySeconds() {
		return validitySeconds;
	}
}
