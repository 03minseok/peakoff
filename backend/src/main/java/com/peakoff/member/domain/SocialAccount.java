package com.peakoff.member.domain;

import java.time.Instant;
import java.util.Objects;

import com.peakoff.global.support.Texts;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 회원에게 연결된 소셜 로그인 수단 한 줄.
 *
 * <h3>왜 회원 테이블의 컬럼이 아니라 별도 테이블인가</h3>
 * {@code members}에 {@code provider} 컬럼 하나를 두면 회원 한 명이 로그인 수단을
 * <b>하나만</b> 가질 수 있다. 그러면 이메일로 가입한 사람이 카카오를 연결하는 순간
 * 그 컬럼이 KAKAO로 바뀌어 비밀번호 로그인이 사라지거나, 연결을 포기해야 한다.
 * 수단을 따로 떼면 한 계정에 "이메일 + 카카오 + 네이버"가 함께 붙는다.
 *
 * <h3>신원의 기준은 이메일이 아니다</h3>
 * 기준은 {@link #providerUserId} — 카카오·네이버가 회원에게 매긴 고유 번호다.
 * 이메일은 사용자가 그쪽 서비스에서 바꿀 수 있지만 이 번호는 바뀌지 않는다.
 * 이메일을 기준으로 삼으면 사용자가 카카오에서 이메일을 바꾼 순간 우리와 남남이 된다.
 *
 * <h3>제공자 토큰을 저장하지 않는다</h3>
 * 카카오가 준 access token은 "이 사람이 누구인지" 한 번 묻는 데만 쓰고 버린다.
 * 우리가 그 토큰으로 할 일이 더 없는데 보관하면, 유출됐을 때 남의 카카오 계정을
 * 건드릴 수 있는 열쇠를 우리가 대신 흘리는 셈이 된다. <b>안 가진 것은 샐 일이 없다.</b>
 */
@Entity
@Table(name = "social_accounts",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_social_accounts_provider_user",
				columnNames = { "provider", "provider_user_id" }))
public class SocialAccount {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 이 수단이 붙은 계정.
	 *
	 * <p>{@code LAZY}인 이유는 {@code SavedCourse}와 같다 — 수단을 찾는 자리에서는
	 * 대개 회원 식별자만 필요하다. 다만 로그인 흐름은 곧바로 회원을 쓰므로 그때는 한 번 더 읽는다.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "member_id", nullable = false)
	private Member member;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private SocialProvider provider;

	/**
	 * 제공자가 매긴 고유 식별자.
	 *
	 * <p>카카오는 숫자, 네이버는 문자열을 준다. 숫자라고 {@code Long}으로 받으면
	 * 네이버를 붙일 때 타입이 갈라지므로 처음부터 문자열로 통일한다.
	 */
	@Column(name = "provider_user_id", nullable = false, length = 64)
	private String providerUserId;

	/** 연결한 시각. "언제부터 이 수단으로 들어왔는가"를 나중에 설명할 수 있어야 한다. */
	@Column(nullable = false, updatable = false)
	private Instant connectedAt;

	/** JPA가 프록시를 만들 때 쓴다. 애플리케이션 코드에서 부르지 않는다. */
	protected SocialAccount() {
	}

	private SocialAccount(Member member, SocialProvider provider, String providerUserId, Instant now) {
		this.member = Objects.requireNonNull(member, "연결할 회원은 필수입니다.");
		this.provider = Objects.requireNonNull(provider, "제공자는 필수입니다.");
		this.providerUserId = Texts.requireNotBlank(providerUserId, "제공자 회원 식별자");
		this.connectedAt = Objects.requireNonNull(now, "연결 시각은 필수입니다.");
	}

	/**
	 * 회원에게 소셜 수단을 붙인다.
	 *
	 * <p>이 메서드는 <b>본인 확인을 하지 않는다.</b> "이 카카오 계정의 주인이 맞는가"는
	 * OAuth가, "이 회원 계정의 주인이 맞는가"는 비밀번호 확인이 답한다.
	 * 둘 다 통과한 뒤에 서비스가 이것을 부른다.
	 */
	public static SocialAccount connect(
			Member member, SocialProvider provider, String providerUserId, Instant now) {
		return new SocialAccount(member, provider, providerUserId, now);
	}

	public Long id() {
		return id;
	}

	public Member member() {
		return member;
	}

	public SocialProvider provider() {
		return provider;
	}

	public String providerUserId() {
		return providerUserId;
	}

	public Instant connectedAt() {
		return connectedAt;
	}
}
