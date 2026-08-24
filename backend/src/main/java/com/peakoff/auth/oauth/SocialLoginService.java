package com.peakoff.auth.oauth;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.auth.dto.AuthResponse;
import com.peakoff.auth.dto.SocialLinkRequest;
import com.peakoff.auth.dto.SocialLoginResponse;
import com.peakoff.auth.jwt.JwtProvider;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.member.domain.SocialAccount;
import com.peakoff.member.domain.SocialAccountRepository;
import com.peakoff.member.domain.SocialProvider;

/**
 * 소셜 로그인.
 *
 * <h3>세 갈래</h3>
 * <ol>
 *   <li><b>이미 연결된 계정</b> — 그대로 로그인시킨다</li>
 *   <li><b>확인된 이메일이 기존 계정과 같다</b> — 곧바로 잇지 않고 비밀번호를 묻는다</li>
 *   <li><b>그 밖</b> — 새 계정을 만들고 로그인시킨다</li>
 * </ol>
 *
 * <h3>2번에서 자동으로 잇지 않는 이유 (중요)</h3>
 * 우리 가입은 이메일을 인증하지 않는다. 그래서 누구나 남의 이메일로 계정을 만들어 둘 수 있다.
 * 이메일이 같다는 이유로 이어버리면, 공격자가 미리 만들어 둔 계정에 진짜 주인이 로그인하게 된다.
 * 주인은 자기 계정인 줄 알고 코스를 저장하는데, 공격자는 원래 알던 비밀번호로 언제든 들어와
 * 그것을 들여다볼 수 있다.
 *
 * <p>비밀번호를 한 번 물으면 연결되는 순간 <b>두 가지가 동시에 증명</b>된다 —
 * 카카오 계정의 주인이라는 것(OAuth가 증명)과 기존 계정의 주인이라는 것(비밀번호가 증명).
 * 공격자는 피해자의 카카오를 가질 수 없으므로 아무것도 얻지 못한다.
 *
 * <h3>확인되지 않은 이메일은 아예 쓰지 않는다</h3>
 * 제공자가 "확인했다"고 표시하지 않은 이메일은 저장하지도, 계정을 찾는 데 쓰지도 않는다.
 * 저장하면 그 주소의 진짜 주인이 나중에 가입하려 할 때 "이미 가입된 이메일"로 막히고,
 * 찾는 데 쓰면 위의 구멍이 그대로 열린다.
 */
@Service
@Transactional(readOnly = true)
public class SocialLoginService {

	/** 이름을 못 받았을 때 쓸 값. 빈 이름으로 계정을 만들면 화면 곳곳이 빈자리가 된다. */
	private static final String FALLBACK_NICKNAME = "여행자";

	private final Map<SocialProvider, SocialLoginClient> clients;
	private final MemberRepository memberRepository;
	private final SocialAccountRepository socialAccountRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtProvider jwtProvider;
	private final Clock clock;

	/**
	 * 구현체를 {@code List}로 받아 제공자별로 정리해 둔다.
	 *
	 * <p>카카오 클라이언트를 이름으로 직접 주입받지 않는 이유: 네이버를 추가할 때
	 * 이 생성자와 분기를 다시 고쳐야 한다. 스프링이 찾아온 구현체를 전부 받아 표로 만들어 두면,
	 * 새 제공자는 클래스를 하나 추가하는 것만으로 붙는다.
	 */
	public SocialLoginService(
			List<SocialLoginClient> clients,
			MemberRepository memberRepository,
			SocialAccountRepository socialAccountRepository,
			PasswordEncoder passwordEncoder,
			JwtProvider jwtProvider,
			Clock clock) {

		this.clients = new EnumMap<>(SocialProvider.class);
		clients.forEach(client -> this.clients.put(client.provider(), client));
		this.memberRepository = memberRepository;
		this.socialAccountRepository = socialAccountRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtProvider = jwtProvider;
		this.clock = clock;
	}

	/**
	 * 사용자를 보낼 로그인 창 주소.
	 *
	 * <p>화면은 이 주소로 이동만 하면 된다. 인증키가 없는 배포라면 여기서 걸려,
	 * 사용자가 카카오 오류 화면을 보기 전에 우리 말로 알릴 수 있다.
	 */
	public String authorizeUrl(SocialProvider provider, String state) {
		return clientFor(provider).authorizeUrl(state);
	}

	/**
	 * 인가 코드를 받아 로그인시킨다.
	 *
	 * @param state 로그인을 시작할 때 화면이 만든 값. 네이버는 토큰 교환에도 이 값을 요구한다.
	 *              이 값으로 <b>여기서 무엇을 판단하지는 않는다</b> — 우리가 시작한 로그인인지는
	 *              화면이 이미 확인했고(서버는 값을 보관하지 않으므로 대조할 상대가 없다),
	 *              서버는 제공자에게 되돌려주는 역할만 한다
	 * @return 로그인이 끝났거나, 연결 확인이 필요하다는 답
	 */
	@Transactional
	public SocialLoginResponse login(SocialProvider provider, String code, String state) {
		SocialProfile profile = clientFor(provider).fetchProfile(code, state);

		// 1. 이미 연결된 수단이면 그 계정의 주인이 맞다. OAuth가 방금 증명했다.
		Optional<SocialAccount> connected =
				socialAccountRepository.findByProviderAndProviderUserId(provider, profile.providerUserId());
		if (connected.isPresent()) {
			return SocialLoginResponse.loggedIn(toAuthResponse(connected.get().member()));
		}

		// 2. 확인된 이메일이 있고, 그 이메일로 가입한 계정이 있으면 본인 확인을 거친다.
		if (profile.hasVerifiedEmail()) {
			Optional<Member> sameEmail = memberRepository.findByEmail(Member.normalizeEmail(profile.email()));
			if (sameEmail.isPresent()) {
				Member candidate = sameEmail.get();
				/*
				 * 비밀번호가 없는 계정(다른 소셜로만 가입)과는 이 방법으로 이을 수 없다.
				 * 확인할 수단이 없으므로 잇지 않고 새 계정으로 보낸다 — 확인 없이 잇는 것보다
				 * 계정이 둘로 나뉘는 편이 낫다.
				 */
				if (candidate.hasPassword()) {
					return SocialLoginResponse.linkRequired(
							candidate.email(),
							provider,
							jwtProvider.createLinkTicket(
									candidate.id(), provider.name(), profile.providerUserId()));
				}
			}
		}

		// 3. 새 계정.
		return SocialLoginResponse.loggedIn(toAuthResponse(createMember(provider, profile)));
	}

	/**
	 * 비밀번호로 본인을 확인하고 소셜 수단을 기존 계정에 붙인다.
	 *
	 * <p>여기 오는 티켓은 "카카오 인증을 통과했다"만 증명한다. <b>누구의 계정인지는 아직
	 * 증명되지 않았다</b> — 그것을 비밀번호가 한다. 그래서 티켓이 유효해도 비밀번호가 틀리면
	 * 아무 일도 일어나지 않는다.
	 */
	@Transactional
	public AuthResponse link(SocialLinkRequest request) {
		JwtProvider.LinkTicket ticket = jwtProvider.parseLinkTicket(request.linkTicket());
		if (ticket == null) {
			// 만료가 대부분이다. 다시 시도하면 되는 일이라 그렇게 말한다.
			throw new UnauthorizedException("연결 정보가 만료됐어요.\n다시 시도해 주세요.");
		}

		Member member = memberRepository.findById(ticket.memberId())
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다.\n다시 시도해 주세요."));

		if (!member.hasPassword() || !passwordEncoder.matches(request.password(), member.passwordHash())) {
			throw new UnauthorizedException("비밀번호가 올바르지 않습니다.");
		}

		SocialProvider provider = SocialProvider.valueOf(ticket.provider());
		/*
		 * 기다리는 사이에 그 소셜 계정이 다른 곳에 붙었을 수 있다(사용자가 창을 두 개 열었다면).
		 * 같은 계정에 붙은 것이면 이미 끝난 일이라 그대로 로그인시키고,
		 * 다른 계정에 붙었으면 옮겨 붙이지 않는다 — 그 판단은 사용자가 해야 한다.
		 */
		Optional<SocialAccount> existing =
				socialAccountRepository.findByProviderAndProviderUserId(provider, ticket.providerUserId());
		if (existing.isPresent()) {
			if (!existing.get().member().id().equals(member.id())) {
				throw new ConflictException("이미 다른 계정에 연결된 %s 계정이에요.".formatted(provider.displayName()));
			}
			return toAuthResponse(member);
		}

		socialAccountRepository.save(
				SocialAccount.connect(member, provider, ticket.providerUserId(), Instant.now(clock)));
		return toAuthResponse(member);
	}

	/**
	 * 소셜 전용 계정을 만든다.
	 *
	 * <p>이메일은 <b>확인된 것만</b> 담는다. 확인되지 않은 값을 담으면 그 주소의 진짜 주인이
	 * 나중에 가입하려 할 때 "이미 가입된 이메일"에 막힌다 — 우리가 대신 자리를 차지한 꼴이다.
	 */
	private Member createMember(SocialProvider provider, SocialProfile profile) {
		String email = profile.hasVerifiedEmail() ? Member.normalizeEmail(profile.email()) : null;
		Member member = Member.registerSocial(
				email, Member.shortenNickname(profile.nickname(), FALLBACK_NICKNAME), Instant.now(clock));

		try {
			memberRepository.save(member);
			socialAccountRepository.save(
					SocialAccount.connect(member, provider, profile.providerUserId(), Instant.now(clock)));
			return member;
		} catch (DataIntegrityViolationException e) {
			/*
			 * 같은 사람이 로그인 버튼을 두 번 눌러 두 요청이 겹치면, 위의 "이미 연결됐는가" 검사를
			 * 둘 다 통과한 뒤 저장에서 부딪힌다. 그때는 먼저 들어간 쪽이 만든 계정이 정답이다.
			 */
			return socialAccountRepository.findByProviderAndProviderUserId(provider, profile.providerUserId())
					.map(SocialAccount::member)
					.orElseThrow(() -> e);
		}
	}

	private SocialLoginClient clientFor(SocialProvider provider) {
		SocialLoginClient client = clients.get(provider);
		if (client == null || !client.isConfigured()) {
			/*
			 * 인증키가 없는 배포다. 사용자가 고칠 수 있는 문제가 아니라 우리 설정 문제이므로
			 * 500으로 나간다 — 400대로 답하면 "사용자가 뭔가 잘못했다"는 뜻이 되어,
			 * 로그를 보기 전까지 원인을 엉뚱한 곳에서 찾게 된다.
			 */
			throw new IllegalStateException(
					"%s 로그인 설정이 없습니다. client-id와 redirect-uri를 확인하세요.".formatted(provider));
		}
		return client;
	}

	private AuthResponse toAuthResponse(Member member) {
		return AuthResponse.of(
				jwtProvider.createToken(member.id(), member.nickname()),
				jwtProvider.validitySeconds(),
				member);
	}
}
