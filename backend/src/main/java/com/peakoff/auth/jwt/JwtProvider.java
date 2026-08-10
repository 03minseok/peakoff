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

	/**
	 * 토큰의 용도. <b>이 서비스가 서명한 것이라고 다 로그인 토큰은 아니다.</b>
	 *
	 * <p>소셜 계정 연결에 쓰는 티켓도 같은 키로 서명한다. 용도를 적어두지 않으면 그 티켓을
	 * Authorization 헤더에 실어 보냈을 때 서명이 맞으니 통과해, <b>비밀번호를 확인하기도 전에
	 * 로그인한 셈</b>이 된다. 연결 확인을 넣은 이유가 통째로 사라지는 구멍이다.
	 */
	private static final String TYPE_CLAIM = "typ";
	private static final String TYPE_ACCESS = "access";
	private static final String TYPE_LINK = "link";

	/** 연결 티켓의 수명. 비밀번호를 입력할 시간이면 충분하고, 주워도 오래 쓰지 못할 만큼 짧다. */
	private static final long LINK_TICKET_VALIDITY_SECONDS = 300;

	private static final String MEMBER_ID_CLAIM = "memberId";
	private static final String PROVIDER_CLAIM = "provider";
	private static final String PROVIDER_USER_ID_CLAIM = "providerUserId";

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
				.claim(TYPE_CLAIM, TYPE_ACCESS)
				.issuedAt(Date.from(now))
				.expiration(Date.from(now.plusSeconds(validitySeconds)))
				.signWith(key)
				.compact();
	}

	/**
	 * 소셜 계정 연결을 위한 <b>짧은 수명의 티켓</b>을 만든다.
	 *
	 * <p>왜 필요한가: 카카오 인가 코드는 <b>한 번만</b> 쓸 수 있다. 그런데 "이 이메일로 가입한
	 * 계정이 있으니 비밀번호를 확인하겠다"는 화면을 한 번 거치면, 사용자가 비밀번호를 입력해
	 * 돌아왔을 때 그 코드는 이미 써버린 뒤다. 그렇다고 카카오 인증을 다시 시키면 사용자는
	 * 같은 동의 절차를 두 번 겪는다. 그래서 "카카오 인증은 끝났다"는 사실만 서명해 건네고,
	 * 화면이 그것을 비밀번호와 함께 돌려보낸다.
	 *
	 * <p>이 티켓은 <b>로그인 토큰이 아니다.</b> 그래서 두 겹으로 막는다.
	 * <ul>
	 *   <li>용도를 {@code typ=link}로 박는다 — {@link #parse}가 이 값을 보고 거절한다</li>
	 *   <li>subject를 숫자가 아닌 문자열로 둔다 — 설령 용도 검사를 빠져나가도
	 *       회원 번호로 해석되지 않아 남의 계정이 되지 않는다</li>
	 * </ul>
	 *
	 * @param memberId 연결 대상 계정. <b>아직 이 사람의 것이라고 확인되지 않았다</b> —
	 *                 확인은 비밀번호가 한다
	 */
	public String createLinkTicket(Long memberId, String provider, String providerUserId) {
		Instant now = Instant.now();
		return Jwts.builder()
				.subject("link:" + providerUserId)
				.claim(TYPE_CLAIM, TYPE_LINK)
				.claim(MEMBER_ID_CLAIM, memberId)
				.claim(PROVIDER_CLAIM, provider)
				.claim(PROVIDER_USER_ID_CLAIM, providerUserId)
				.issuedAt(Date.from(now))
				.expiration(Date.from(now.plusSeconds(LINK_TICKET_VALIDITY_SECONDS)))
				.signWith(key)
				.compact();
	}

	/**
	 * 연결 티켓을 검증하고 내용을 꺼낸다.
	 *
	 * <p>{@link #parse}와 거울처럼 반대다 — 여기서는 <b>{@code typ=link}가 아니면 거절</b>한다.
	 * 로그인 토큰을 연결 요청에 실어 보내 비밀번호 확인을 건너뛰지 못하게 하려는 것이다.
	 *
	 * @return 유효하면 내용, 아니면 null
	 */
	public LinkTicket parseLinkTicket(String ticket) {
		try {
			Claims claims = Jwts.parser()
					.verifyWith(key)
					.build()
					.parseSignedClaims(ticket)
					.getPayload();

			if (!TYPE_LINK.equals(claims.get(TYPE_CLAIM, String.class))) {
				return null;
			}
			return new LinkTicket(
					claims.get(MEMBER_ID_CLAIM, Long.class),
					claims.get(PROVIDER_CLAIM, String.class),
					claims.get(PROVIDER_USER_ID_CLAIM, String.class));
		} catch (JwtException | IllegalArgumentException e) {
			// 만료가 흔한 경우다(5분). 사용자 실수에 가까워 로그를 남기지 않는다.
			return null;
		}
	}

	/**
	 * 연결 티켓에 담긴 내용.
	 *
	 * @param memberId       연결할 계정
	 * @param provider       어느 소셜 제공자인가
	 * @param providerUserId 그쪽이 매긴 고유 번호
	 */
	public record LinkTicket(Long memberId, String provider, String providerUserId) {
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

			/*
			 * 로그인 토큰이 아닌 것을 걸러낸다.
			 *
			 * 연결 티켓도 같은 키로 서명하므로 서명 검사만으로는 통과한다. 그대로 두면
			 * 비밀번호를 확인하기 전에 받은 티켓으로 로그인이 되어, 연결 확인 절차가 무력해진다.
			 *
			 * 값이 없는 토큰은 받아준다 — 이 클레임을 넣기 전에 발급된 토큰이 아직 살아 있다.
			 * 유효기간이 7일이라, 막으면 지금 로그인해 있는 사람들이 이유 없이 튕겨 나간다.
			 */
			String type = claims.get(TYPE_CLAIM, String.class);
			if (type != null && !TYPE_ACCESS.equals(type)) {
				return null;
			}

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
