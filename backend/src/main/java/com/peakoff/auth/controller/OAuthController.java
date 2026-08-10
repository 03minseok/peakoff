package com.peakoff.auth.controller;

import java.util.Locale;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.dto.AuthResponse;
import com.peakoff.auth.dto.AuthorizeUrlResponse;
import com.peakoff.auth.dto.SocialLinkRequest;
import com.peakoff.auth.dto.SocialLoginRequest;
import com.peakoff.auth.dto.SocialLoginResponse;
import com.peakoff.auth.oauth.SocialLoginService;
import com.peakoff.global.response.ApiResponse;
import com.peakoff.member.domain.SocialProvider;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 소셜 로그인 창구.
 *
 * <p>{@code AuthController}와 파일을 나눈 이유: 이메일 로그인과 흐름이 다르다.
 * 이쪽은 바깥 서비스와 두 번 통신하고, 끝이 하나가 아니라 둘이다(로그인 / 연결 확인).
 * 한 파일에 두면 "이 컨트롤러가 무엇을 하는 곳인가"가 흐려진다.
 */
@Tag(name = "소셜 로그인", description = "카카오·네이버 계정으로 로그인한다. 게스트는 쓰지 않아도 된다")
@RestController
@RequestMapping("/api/auth/oauth")
public class OAuthController {

	private final SocialLoginService socialLoginService;

	public OAuthController(SocialLoginService socialLoginService) {
		this.socialLoginService = socialLoginService;
	}

	@Operation(
			summary = "로그인 창 주소",
			description = """
					사용자를 보낼 제공자 로그인 화면 주소를 만들어 준다. 화면은 이 주소로 이동만 한다.

					화면이 직접 조립하지 않는 이유: 주소에 들어가는 client_id·redirect_uri가
					서버 설정과 화면 코드 두 곳에 존재하게 되고, 배포하면서 한쪽만 바뀌면
					제공자가 KOE006(Redirect URI 불일치)으로 거절한다.

					state는 화면이 만든 임의의 값이다. 돌아올 때 같은 값인지 확인해
					남이 시작한 로그인이 아님을 가린다.""")
	@GetMapping("/{provider}/authorize")
	public ApiResponse<AuthorizeUrlResponse> authorizeUrl(
			@PathVariable String provider, @RequestParam String state) {

		return ApiResponse.ok(
				new AuthorizeUrlResponse(socialLoginService.authorizeUrl(toProvider(provider), state)));
	}

	@Operation(
			summary = "소셜 로그인",
			description = """
					제공자가 돌려준 인가 코드를 받아 로그인시킨다.

					끝이 둘이다.
					- LOGGED_IN: 토큰이 함께 온다. 이메일 로그인과 똑같이 처리하면 된다
					- LINK_REQUIRED: 같은 이메일로 가입한 계정이 있다. 비밀번호를 받아
					  /api/auth/oauth/link 로 보내야 연결된다

					인가 코드는 한 번만 쓸 수 있다. 같은 코드로 두 번 호출하면 실패한다.""")
	@PostMapping("/{provider}")
	public ApiResponse<SocialLoginResponse> login(
			@PathVariable String provider, @Valid @RequestBody SocialLoginRequest request) {

		return ApiResponse.ok(socialLoginService.login(toProvider(provider), request.code()));
	}

	@Operation(
			summary = "기존 계정에 소셜 계정 연결",
			description = """
					로그인 응답이 LINK_REQUIRED였을 때, 비밀번호를 확인하고 연결한 뒤 로그인시킨다.

					티켓만으로는 연결되지 않는다. 이메일 인증을 하지 않는 서비스라
					"이메일이 같다"는 사실만으로 이으면 남이 미리 만들어 둔 계정에
					진짜 주인을 밀어 넣을 수 있다. 비밀번호가 그 구멍을 막는다.

					티켓은 5분간 유효하다.""")
	@PostMapping("/link")
	public ApiResponse<AuthResponse> link(@Valid @RequestBody SocialLinkRequest request) {
		return ApiResponse.ok(socialLoginService.link(request));
	}

	/**
	 * 주소의 {@code kakao}를 {@link SocialProvider#KAKAO}로 바꾼다.
	 *
	 * <p>스프링에 맡기지 않고 직접 바꾸는 이유: 자동 변환은 대소문자를 가려서 {@code /kakao}가
	 * 아니라 {@code /KAKAO}로만 동작한다. 주소를 대문자로 쓰는 것은 어색하고, 그렇다고
	 * 실패했을 때 나가는 기본 메시지는 자바 타입 이름이 섞여 있어 사용자에게 보여줄 수 없다.
	 */
	private static SocialProvider toProvider(String provider) {
		try {
			return SocialProvider.valueOf(provider.toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException e) {
			throw new IllegalArgumentException("지원하지 않는 로그인 방식입니다: %s".formatted(provider));
		}
	}
}
