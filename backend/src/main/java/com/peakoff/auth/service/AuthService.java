package com.peakoff.auth.service;

import java.time.Clock;
import java.time.Instant;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.auth.dto.AuthResponse;
import com.peakoff.auth.dto.LoginRequest;
import com.peakoff.auth.dto.MemberResponse;
import com.peakoff.auth.dto.SignupRequest;
import com.peakoff.auth.jwt.JwtProvider;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;

/**
 * 가입과 로그인.
 *
 * <p>요청의 모양(빈 값·이메일 형식·길이·약관 동의)은 컨트롤러의 {@code @Valid}가 이미 걸렀다.
 * 여기서는 여러 값을 함께 봐야 알 수 있는 것만 판단한다 — 비밀번호와 확인이 같은지,
 * 이미 가입된 이메일인지, 비밀번호가 맞는지.
 */
@Service
public class AuthService {

	private final MemberRepository memberRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtProvider jwtProvider;
	private final Clock clock;

	/**
	 * {@link Clock}을 주입받는 이유: 가입 시각을 테스트에서 고정할 수 있어야 한다.
	 * {@code Instant.now()}를 직접 부르면 "가입 시각과 약관 동의 시각이 같은가" 같은 것을
	 * 검증할 방법이 사라진다.
	 */
	public AuthService(
			MemberRepository memberRepository,
			PasswordEncoder passwordEncoder,
			JwtProvider jwtProvider,
			Clock clock) {
		this.memberRepository = memberRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtProvider = jwtProvider;
		this.clock = clock;
	}

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
	@Transactional(readOnly = true)
	public AuthResponse login(LoginRequest request) {
		Member member = memberRepository.findByEmail(Member.normalizeEmail(request.email()))
				.orElseThrow(() -> new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다."));

		if (!passwordEncoder.matches(request.password(), member.passwordHash())) {
			throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
		}

		return toAuthResponse(member);
	}

	/** 토큰이 가리키는 회원의 지금 정보. 닉네임이 바뀌었을 수도 있어 DB에서 다시 읽는다. */
	@Transactional(readOnly = true)
	public MemberResponse findById(Long memberId) {
		Member member = memberRepository.findById(memberId)
				// 토큰은 유효한데 회원이 없다 — 탈퇴했거나 DB가 초기화된 경우다.
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다. 다시 로그인해 주세요."));
		return MemberResponse.from(member);
	}

	private AuthResponse toAuthResponse(Member member) {
		String token = jwtProvider.createToken(member.id(), member.nickname());
		return AuthResponse.of(token, jwtProvider.validitySeconds(), member);
	}
}
