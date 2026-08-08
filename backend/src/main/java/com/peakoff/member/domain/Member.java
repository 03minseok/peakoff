package com.peakoff.member.domain;

import java.time.Instant;
import java.util.Objects;

import com.peakoff.global.support.Texts;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 가입한 회원.
 *
 * <p>담는 것은 이메일·비밀번호 해시·닉네임·가입 시각·약관 동의 시각뿐이다.
 * 이 서비스가 계정으로 하는 일은 "코스를 저장하고 비교하는 것" 하나라 그 밖의 정보는
 * 받아둘 이유가 없다. <b>안 받은 정보는 샐 일도 없다.</b>
 *
 * <p>비밀번호는 <b>해시만</b> 들어온다. 원문을 이 클래스가 보지 못하게 하려고
 * 해싱은 바깥({@code AuthService})에서 끝내고 결과만 넘긴다. 여기서 해싱하면
 * 엔티티가 인코더를 알아야 하고, 그러면 평문을 받는 생성자가 생긴다.
 *
 * <p>약관 동의 시각을 <b>불리언이 아니라 시각</b>으로 남기는 이유: "동의했다"만 남기면
 * 언제 어느 버전에 동의했는지 사라진다. 약관이 바뀌었을 때 재동의를 받아야 하는지
 * 판단할 근거가 없어진다.
 */
@Entity
@Table(name = "members")
public class Member {

	/** 닉네임 최대 길이. 화면의 입력 제한과 같은 값이어야 한다. */
	public static final int NICKNAME_MAX_LENGTH = 12;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 로그인 아이디. 대소문자를 구분하지 않으려고 소문자로 눕혀 저장한다.
	 *
	 * <p>{@code unique = true}가 최후의 방어선이다. 서비스에서 중복을 미리 확인하지만,
	 * 두 요청이 동시에 들어오면 그 확인을 둘 다 통과할 수 있다. 그때는 DB가 막는다.
	 */
	@Column(nullable = false, unique = true, length = 320)
	private String email;

	/** BCrypt 해시. 원문은 어디에도 저장하지 않는다. */
	@Column(nullable = false, length = 60)
	private String passwordHash;

	@Column(nullable = false, length = NICKNAME_MAX_LENGTH)
	private String nickname;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/** 필수 약관에 동의한 시각. */
	@Column(nullable = false)
	private Instant termsAgreedAt;

	/** JPA가 프록시를 만들 때 쓴다. 애플리케이션 코드에서 부르지 않는다. */
	protected Member() {
	}

	private Member(String email, String passwordHash, String nickname, Instant now) {
		this.email = normalizeEmail(email);
		this.passwordHash = Texts.requireNotBlank(passwordHash, "비밀번호 해시");
		this.nickname = validateNickname(nickname);
		this.createdAt = Objects.requireNonNull(now, "가입 시각은 필수입니다.");
		// 가입과 동의가 같은 순간이다. 나중에 동의를 따로 받게 되면 이 값만 갱신하면 된다.
		this.termsAgreedAt = now;
	}

	/**
	 * 새 회원을 만든다.
	 *
	 * <p>정적 팩터리로 둔 이유: 생성자만 있으면 {@code new Member(email, password, ...)}처럼
	 * 평문을 넘겨도 컴파일된다. 이름에 {@code Hash}를 박아두면 호출부에서 무엇을 넘겨야 하는지
	 * 헷갈리지 않는다.
	 *
	 * @param passwordHash 이미 해싱된 비밀번호. 평문을 넘기면 안 된다
	 * @param now          가입 시각이자 약관 동의 시각
	 */
	public static Member register(String email, String passwordHash, String nickname, Instant now) {
		return new Member(email, passwordHash, nickname, now);
	}

	/**
	 * 이메일 비교·저장은 항상 소문자로 한다.
	 *
	 * <p>이렇게 하지 않으면 {@code A@x.com}과 {@code a@x.com}이 서로 다른 계정이 되어,
	 * 가입해놓고 로그인이 안 되는 상태가 만들어진다.
	 */
	public static String normalizeEmail(String email) {
		return Texts.requireNotBlank(email, "이메일").toLowerCase();
	}

	/**
	 * 닉네임을 바꾼다.
	 *
	 * <p>가입 때와 <b>같은 검사</b>를 통과한다. 세터를 열어두고 서비스에서 길이를 확인하는 방식이면
	 * 검사가 두 곳에 생기고, 새로 부르는 자리가 늘 때마다 빠뜨릴 자리도 함께 는다.
	 */
	public void changeNickname(String nickname) {
		this.nickname = validateNickname(nickname);
	}

	/**
	 * 비밀번호를 바꾼다.
	 *
	 * <p>{@link #register}와 같은 이유로 <b>해시만</b> 받는다. 평문을 받으면 이 클래스가
	 * 인코더를 알아야 하고, 그 순간 원문이 엔티티까지 흘러든다.
	 *
	 * <p>이 메서드는 <b>본인 확인을 하지 않는다.</b> "현재 비밀번호가 맞는가"는 인코더가 있어야
	 * 판단할 수 있어 {@code AuthService}가 먼저 확인하고 부른다.
	 *
	 * @param passwordHash 이미 해싱된 새 비밀번호
	 */
	public void changePassword(String passwordHash) {
		this.passwordHash = Texts.requireNotBlank(passwordHash, "비밀번호 해시");
	}

	private static String validateNickname(String nickname) {
		String trimmed = Texts.requireNotBlank(nickname, "닉네임");
		if (trimmed.length() > NICKNAME_MAX_LENGTH) {
			throw new IllegalArgumentException(
					"닉네임은 %d자 이하여야 합니다. 입력값 길이: %d".formatted(NICKNAME_MAX_LENGTH, trimmed.length()));
		}
		return trimmed;
	}

	public Long id() {
		return id;
	}

	public String email() {
		return email;
	}

	public String passwordHash() {
		return passwordHash;
	}

	public String nickname() {
		return nickname;
	}

	public Instant createdAt() {
		return createdAt;
	}

	public Instant termsAgreedAt() {
		return termsAgreedAt;
	}
}
