package com.peakoff.auth.service;

import java.time.Clock;
import java.time.Instant;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.auth.dto.AuthResponse;
import com.peakoff.auth.dto.ChangeNicknameRequest;
import com.peakoff.auth.dto.ChangePasswordRequest;
import com.peakoff.auth.dto.DeleteAccountRequest;
import com.peakoff.auth.dto.LoginRequest;
import com.peakoff.auth.dto.MemberResponse;
import com.peakoff.auth.dto.SignupRequest;
import com.peakoff.auth.jwt.JwtProvider;
import com.peakoff.course.domain.SavedCourseRepository;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.member.domain.SocialAccountRepository;

/**
 * 가입·로그인과 계정 관리.
 *
 * <p>요청의 모양(빈 값·이메일 형식·길이·약관 동의)은 컨트롤러의 {@code @Valid}가 이미 걸렀다.
 * 여기서는 여러 값을 함께 봐야 알 수 있는 것만 판단한다 — 비밀번호와 확인이 같은지,
 * 이미 가입된 이메일인지, 비밀번호가 맞는지.
 *
 * <h3>토큰을 되돌릴 수 없다는 것</h3>
 * 비밀번호를 바꿔도 <b>이미 나간 토큰은 만료될 때까지 살아 있다.</b> 서버가 로그인 상태를
 * 들고 있지 않기 때문이다. 무효화하려면 토큰 목록을 서버에 쌓아야 하는데, 그러면 무상태를
 * 포기하는 셈이라 이 규모에서는 유효기간(7일)으로 감당한다.
 *
 * <p>탈퇴는 다르다. 회원이 사라지면 그 토큰으로 오는 요청은 전부
 * "회원 정보를 찾을 수 없습니다"로 막힌다 — 조회하는 자리마다 회원을 다시 읽기 때문이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

	/**
	 * 로그인 실패에 쓰는 <b>단 하나의</b> 문구.
	 *
	 * <p>이메일이 없든, 비밀번호가 틀렸든, 소셜로만 가입해 비밀번호가 아예 없든 같은 말을 한다.
	 * 나눠 알려주면 "이 이메일은 가입돼 있다"를 확인하는 통로가 된다.
	 *
	 * <p>뒤 문장은 <b>누구에게나 똑같이</b> 나가므로 아무것도 알려주지 않는다. 대신 카카오로
	 * 가입해놓고 이메일 로그인을 시도한 사람에게는 나갈 길을 알려준다 — 그 사람은 여기서
	 * 막히면 맞는 비밀번호가 존재하지 않는 화면을 계속 두드리게 된다.
	 */
	private static final String LOGIN_FAILED =
			"이메일 또는 비밀번호가 올바르지 않습니다.\n간편 로그인으로 가입하셨다면 카카오·네이버 버튼을 이용해 주세요.";

	private final MemberRepository memberRepository;
	/*
	 * 탈퇴할 때 저장된 코스를 함께 지우려고 참조한다.
	 *
	 * 코스 쪽에 "회원이 지워졌다"를 알리는 이벤트를 두는 방법도 있지만, 지울 대상이 하나뿐인
	 * 지금 그렇게 하면 삭제 순서가 코드에서 사라져 추적하기 어려워진다. 대상이 늘면 그때 옮긴다.
	 */
	private final SavedCourseRepository savedCourseRepository;
	private final com.peakoff.trip.domain.TripRepository tripRepository;
	private final com.peakoff.trip.domain.TripCourseRepository tripCourseRepository;
	/* 탈퇴할 때 연결된 소셜 수단도 함께 지운다. 남겨두면 사라진 회원을 가리키는 행이 된다. */
	private final SocialAccountRepository socialAccountRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtProvider jwtProvider;
	private final Clock clock;

	/**
	 * {@link Clock}을 주입받는 이유: 가입 시각을 테스트에서 고정할 수 있어야 한다.
	 * {@code Instant.now()}를 직접 부르면 "가입 시각과 약관 동의 시각이 같은가" 같은 것을
	 * 검증할 방법이 사라진다.
	 */

	@Transactional
	public AuthResponse signup(SignupRequest request) {
		if (!request.passwordMatchesConfirm()) {
			throw new IllegalArgumentException("비밀번호가 서로 다릅니다.");
		}

		String email = Member.normalizeEmail(request.email());
		if (memberRepository.existsByEmail(email)) {
			throw new ConflictException("이미 가입된 이메일입니다.");
		}

		Instant now = Instant.now(clock);
		Member member = Member.register(
				email, passwordEncoder.encode(request.password()), request.nickname(), now);

		try {
			memberRepository.save(member);
		} catch (DataIntegrityViolationException e) {
			/*
			 * 위의 existsByEmail을 두 요청이 동시에 통과할 수 있다.
			 * 그때는 DB의 unique 제약이 막는데, 그대로 두면 500이 나간다.
			 * 사용자에게는 순서와 상관없이 "이미 가입된 이메일"이 맞는 설명이다.
			 */
			throw new ConflictException("이미 가입된 이메일입니다.");
		}

		return toAuthResponse(member);
	}

	/**
	 * 로그인.
	 *
	 * <p>이메일이 없든 비밀번호가 틀리든 <b>같은 메시지</b>를 돌려준다.
	 * 나눠 알려주면 "이 이메일은 가입돼 있다"는 사실을 확인하는 통로가 된다.
	 */
	public AuthResponse login(LoginRequest request) {
		Member member = memberRepository.findByEmail(Member.normalizeEmail(request.email()))
				.orElseThrow(() -> new UnauthorizedException(LOGIN_FAILED));

		/*
		 * 소셜로만 가입한 계정은 비밀번호가 없다.
		 *
		 * 이 갈래가 없으면 matches(입력, null)이 그냥 false를 돌려주어 "비밀번호가 틀렸다"가 된다.
		 * 사용자는 맞는 비밀번호를 영영 찾지 못한 채 같은 화면을 반복한다.
		 */
		if (!member.hasPassword() || !passwordEncoder.matches(request.password(), member.passwordHash())) {
			throw new UnauthorizedException(LOGIN_FAILED);
		}

		return toAuthResponse(member);
	}

	/** 토큰이 가리키는 회원의 지금 정보. 닉네임이 바뀌었을 수도 있어 DB에서 다시 읽는다. */
	public MemberResponse findById(Long memberId) {
		return MemberResponse.from(getMember(memberId));
	}

	/**
	 * 닉네임 변경.
	 *
	 * <p><b>토큰을 새로 발급해 돌려준다.</b> 지금 토큰 안에 닉네임이 들어 있어서, 그대로 두면
	 * 화면 상단에 옛 닉네임이 계속 뜬다. 화면이 자기 상태만 고치게 두면 새로고침하는 순간
	 * 토큰에서 옛 이름이 되살아난다.
	 */
	@Transactional
	public AuthResponse changeNickname(Long memberId, ChangeNicknameRequest request) {
		Member member = getMember(memberId);
		// 길이 검사는 엔티티가 한다. 가입 때와 같은 규칙을 지나게 하려는 것이다.
		member.changeNickname(request.nickname());
		return toAuthResponse(member);
	}

	/**
	 * 비밀번호 변경.
	 *
	 * <p>현재 비밀번호부터 확인한다. 통과하지 못하면 나머지는 볼 것도 없다 —
	 * 새 비밀번호가 규칙에 맞는지 먼저 알려주면, 권한 없는 사람에게 입력 규칙만 가르쳐 준다.
	 */
	@Transactional
	public void changePassword(Long memberId, ChangePasswordRequest request) {
		Member member = getMember(memberId);
		verifyPassword(member, request.currentPassword());

		if (!request.newPasswordMatchesConfirm()) {
			throw new IllegalArgumentException("새 비밀번호가 서로 다릅니다.");
		}
		if (passwordEncoder.matches(request.newPassword(), member.passwordHash())) {
			// 바꿨다고 알렸는데 실제로는 그대로인 상태를 만들지 않는다.
			throw new IllegalArgumentException("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
		}

		member.changePassword(passwordEncoder.encode(request.newPassword()));
	}

	/**
	 * 회원 탈퇴.
	 *
	 * <p>저장한 코스를 <b>먼저</b> 지우고 회원을 지운다. 순서를 바꾸면 코스가 가리키는 회원이
	 * 사라져 외래키 제약에 걸린다. DB 캐스케이드에 맡기면 이 순서가 코드에서 보이지 않는다 —
	 * "탈퇴하면 무엇이 함께 사라지는가"는 스키마가 아니라 여기서 읽혀야 한다.
	 */
	@Transactional
	public void deleteAccount(Long memberId, DeleteAccountRequest request) {
		Member member = getMember(memberId);
		verifyPassword(member, request.password());

		/*
		 * 순서가 규칙이다: 연결 → 여행 → 코스. 연결이 여행과 코스를 둘 다 가리키므로
		 * 연결이 먼저 사라져야 나머지가 외래키에 걸리지 않는다.
		 * 벌크 삭제는 엔티티 cascade를 타지 않아 손으로 순서를 지킨다.
		 */
		tripCourseRepository.deleteByTripMemberId(memberId);
		tripRepository.deleteByMemberId(memberId);
		savedCourseRepository.deleteByMemberId(memberId);
		/*
		 * 연결된 소셜 수단도 함께 지운다. 남겨두면 사라진 회원을 가리키는 행이 되어
		 * 외래키 제약에 걸리고, 설령 지워지더라도 그 카카오 계정으로 다시 로그인했을 때
		 * 없는 회원을 가리키는 수단을 타고 들어오게 된다.
		 */
		socialAccountRepository.deleteByMemberId(memberId);
		memberRepository.delete(member);
	}

	private Member getMember(Long memberId) {
		return memberRepository.findById(memberId)
				// 토큰은 유효한데 회원이 없다 — 탈퇴했거나 DB가 초기화된 경우다.
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다.\n다시 로그인해 주세요."));
	}

	/**
	 * 지금 앉아 있는 사람이 본인인지 확인한다.
	 *
	 * <p>토큰은 "이 브라우저가 언젠가 로그인했다"는 증거일 뿐이다. 되돌릴 수 없는 일
	 * (비밀번호 변경·탈퇴) 앞에서는 그것으로 부족하다.
	 */
	private void verifyPassword(Member member, String rawPassword) {
		/*
		 * 비밀번호가 없는 계정(소셜 전용)은 이 방법으로 본인을 확인할 수 없다.
		 *
		 * 여기서 막지 않으면 "비밀번호가 올바르지 않습니다"가 나가는데, 그 계정에는 맞는
		 * 비밀번호가 존재하지 않으므로 사용자는 탈퇴할 방법을 잃는다. 확인 수단을 다른 것으로
		 * 바꿔주기 전까지는 <b>왜 안 되는지</b>를 말한다.
		 */
		if (!member.hasPassword()) {
			throw new UnauthorizedException("간편 로그인으로 가입한 계정이라 비밀번호로 확인할 수 없어요.");
		}
		if (!passwordEncoder.matches(rawPassword, member.passwordHash())) {
			throw new UnauthorizedException("비밀번호가 올바르지 않습니다.");
		}
	}

	private AuthResponse toAuthResponse(Member member) {
		String token = jwtProvider.createToken(member.id(), member.nickname());
		return AuthResponse.of(token, jwtProvider.validitySeconds(), member);
	}
}
