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
	 * 이메일 로그인 아이디. 대소문자를 구분하지 않으려고 소문자로 눕혀 저장한다.
	 *
	 * <p>{@code unique = true}가 최후의 방어선이다. 서비스에서 중복을 미리 확인하지만,
	 * 두 요청이 동시에 들어오면 그 확인을 둘 다 통과할 수 있다. 그때는 DB가 막는다.
	 *
	 * <p><b>비어 있을 수 있다.</b> 카카오는 이메일 제공이 선택 동의라 주지 않을 수 있고,
	 * 이미 그 이메일을 쓰는 계정이 있으면 소셜 회원에게 채워 넣을 수도 없다(unique).
	 * 이 값이 없다고 반쪽짜리 계정은 아니다 — 신원은 {@link SocialAccount}가 책임진다.
	 */
	@Column(unique = true, length = 320)
	private String email;

	/**
	 * BCrypt 해시. 원문은 어디에도 저장하지 않는다.
	 *
	 * <p><b>비어 있을 수 있다.</b> 소셜로만 가입한 회원은 비밀번호 자체가 없다.
	 * 없다는 것과 틀렸다는 것은 다르므로, 비밀번호를 요구하는 자리(로그인·탈퇴)는
	 * {@link #hasPassword()}로 먼저 갈라야 한다.
	 */
	@Column(length = 60)
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
		this.email = email;
		this.passwordHash = passwordHash;
		this.nickname = validateNickname(nickname);
		this.createdAt = Objects.requireNonNull(now, "가입 시각은 필수입니다.");
		// 가입과 동의가 같은 순간이다. 나중에 동의를 따로 받게 되면 이 값만 갱신하면 된다.
		this.termsAgreedAt = now;
	}

	/**
	 * 이메일과 비밀번호로 가입한 회원을 만든다.
	 *
	 * <p>정적 팩터리로 둔 이유: 생성자만 있으면 {@code new Member(email, password, ...)}처럼
	 * 평문을 넘겨도 컴파일된다. 이름에 {@code Hash}를 박아두면 호출부에서 무엇을 넘겨야 하는지
	 * 헷갈리지 않는다.
	 *
	 * <p>두 값을 <b>여기서 검사한다.</b> 필드가 nullable이 된 것은 소셜 회원 때문이지,
	 * 이메일 가입이 느슨해졌다는 뜻이 아니다. 규칙이 컬럼에서 빠졌으면 팩터리가 대신 든다.
	 *
	 * @param passwordHash 이미 해싱된 비밀번호. 평문을 넘기면 안 된다
	 * @param now          가입 시각이자 약관 동의 시각
	 */
	public static Member register(String email, String passwordHash, String nickname, Instant now) {
		return new Member(
				normalizeEmail(email), Texts.requireNotBlank(passwordHash, "비밀번호 해시"), nickname, now);
	}

	/**
	 * 소셜로 가입한 회원을 만든다.
	 *
	 * <p>비밀번호가 없다. 임의의 문자열을 넣어 채우는 방법도 있지만 그러면 "비밀번호가 있는 계정"과
	 * 구분되지 않아, 비밀번호를 묻는 화면이 소셜 회원에게도 열린다. <b>없는 것은 없는 채로 둔다.</b>
	 *
	 * <p>이메일은 있을 수도 없을 수도 있다. 카카오가 주지 않았거나, 줬더라도 이미 그 이메일을 쓰는
	 * 계정이 있어 채울 수 없는 경우다. 후자에서 이메일을 억지로 넣으면 unique 제약에 걸려
	 * <b>로그인 자체가 실패</b>한다 — 남의 이메일 자리를 빼앗지 않으려면 비우는 것이 맞다.
	 *
	 * @param email 제공자가 준 이메일. 없으면 {@code null}
	 */
	public static Member registerSocial(String email, String nickname, Instant now) {
		return new Member(email == null ? null : normalizeEmail(email), null, nickname, now);
	}

	/**
	 * 이메일과 비밀번호로도 들어올 수 있는 계정인가.
	 *
	 * <p>비밀번호를 요구하는 자리는 전부 이것으로 먼저 갈라야 한다. 소셜 전용 계정에
	 * {@code passwordEncoder.matches(입력, null)}을 그대로 태우면 "비밀번호가 틀렸다"는
	 * 답이 돌아오는데, 실제로는 <b>애초에 비밀번호가 없는</b> 계정이라 사용자는
	 * 맞는 비밀번호를 영원히 찾지 못한다.
	 */
	public boolean hasPassword() {
		return passwordHash != null;
	}

	/**
	 * 제공자가 준 이름을 우리 규칙에 맞게 줄인다.
	 *
	 * <p>카카오·네이버 닉네임은 우리 상한({@value #NICKNAME_MAX_LENGTH}자)보다 길 수 있다.
	 * 길다고 가입을 거절하면 사용자는 <b>고칠 방법이 없는 이유로</b> 로그인에 실패한다 —
	 * 그 이름은 우리 화면에서 바꾸는 값이 아니기 때문이다. 그래서 자르고 들여보낸 뒤,
	 * 마음에 들지 않으면 마이페이지에서 바꾸게 한다.
	 *
	 * <p>이름을 아예 못 받았을 때 쓸 값도 여기서 정한다. 빈 이름으로 계정을 만들면
	 * 화면 곳곳이 이름 없는 자리로 남는다.
	 */
	public static String shortenNickname(String rawNickname, String fallback) {
		String source = rawNickname == null || rawNickname.isBlank() ? fallback : rawNickname.trim();
		return source.length() > NICKNAME_MAX_LENGTH ? source.substring(0, NICKNAME_MAX_LENGTH) : source;
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
