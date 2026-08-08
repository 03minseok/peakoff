package com.peakoff.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.dto.AuthResponse;
import com.peakoff.auth.dto.ChangeNicknameRequest;
import com.peakoff.auth.dto.ChangePasswordRequest;
import com.peakoff.auth.dto.DeleteAccountRequest;
import com.peakoff.auth.dto.LoginRequest;
import com.peakoff.auth.dto.MemberResponse;
import com.peakoff.auth.dto.SignupRequest;
import com.peakoff.auth.jwt.AuthenticatedMember;
import com.peakoff.auth.service.AuthService;
import com.peakoff.global.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "인증", description = "회원가입·로그인과 계정 관리. 코스를 저장할 때만 필요하다")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@Operation(
			summary = "회원가입",
			description = """
					이메일·비밀번호·닉네임과 필수 약관 동의를 받아 계정을 만들고 토큰을 돌려준다.

					가입 직후 바로 로그인 상태가 된다 — 방금 만든 계정으로 다시 로그인하게 하면
					단계가 하나 늘 뿐이다.

					비밀번호는 BCrypt로 해싱해 저장하며 원문은 어디에도 남기지 않는다.""")
	@PostMapping("/signup")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
		return ApiResponse.ok(authService.signup(request));
	}

	@Operation(
			summary = "로그인",
			description = """
					이메일과 비밀번호로 토큰을 받는다.

					이메일이 없든 비밀번호가 틀리든 같은 401 메시지가 나간다.
					나눠 알려주면 어떤 이메일이 가입돼 있는지 확인하는 통로가 된다.""")
	@PostMapping("/login")
	public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
		return ApiResponse.ok(authService.login(request));
	}

	/**
	 * 토큰이 살아 있는지 확인하는 자리이기도 하다.
	 *
	 * <p>화면이 새로고침될 때 저장해둔 토큰으로 이걸 한 번 불러, 만료됐으면 로그아웃 처리한다.
	 */
	@Operation(
			summary = "내 정보",
			description = "Authorization 헤더의 토큰으로 로그인한 회원 정보를 돌려준다. 토큰이 없거나 만료되면 401.")
	@GetMapping("/me")
	public ApiResponse<MemberResponse> me(@AuthenticationPrincipal AuthenticatedMember member) {
		// 여기 도달했다는 것은 SecurityConfig가 이미 인증을 확인했다는 뜻이라 null 검사가 필요 없다.
		return ApiResponse.ok(authService.findById(member.id()));
	}

	/*
	 * 아래 셋은 계정 관리 화면이 쓴다. PUT이 아니라 PATCH인 이유는 회원의 일부만 바꾸기
	 * 때문이다. PUT은 "이 내용으로 통째로 덮어써라"라서, 보내지 않은 필드를 지워야 맞다.
	 *
	 * 로그인 필수라는 표시가 여기 없는 것은 SavedCourseController와 같은 이유다 —
	 * SecurityConfig 허용 목록에 없으므로 anyRequest().authenticated()가 자동으로 막는다.
	 */

	@Operation(
			summary = "닉네임 변경",
			description = """
					닉네임만 바꾸고 새 토큰을 돌려준다.

					토큰 안에 닉네임이 들어 있어서, 다시 발급하지 않으면 새로고침할 때마다
					옛 닉네임이 되살아난다. 화면은 받은 토큰으로 갈아끼워야 한다.

					비밀번호를 묻지 않는다 — 언제든 되돌릴 수 있는 변경이다.""")
	@PatchMapping("/me/nickname")
	public ApiResponse<AuthResponse> changeNickname(
			@AuthenticationPrincipal AuthenticatedMember member,
			@Valid @RequestBody ChangeNicknameRequest request) {

		return ApiResponse.ok(authService.changeNickname(member.id(), request));
	}

	@Operation(
			summary = "비밀번호 변경",
			description = """
					현재 비밀번호를 함께 받아 확인한 뒤 바꾼다. 틀리면 401.

					토큰은 다시 발급하지 않는다 — 담긴 내용(회원 번호·닉네임)이 그대로다.
					이미 나간 토큰도 만료 전까지는 계속 쓸 수 있다.""")
	@PatchMapping("/me/password")
	public ApiResponse<Void> changePassword(
			@AuthenticationPrincipal AuthenticatedMember member,
			@Valid @RequestBody ChangePasswordRequest request) {

		authService.changePassword(member.id(), request);
		// 204가 아니라 200이다. 프론트가 모든 응답을 ApiResponse 봉투로 읽는다.
		return ApiResponse.ok(null);
	}

	@Operation(
			summary = "회원 탈퇴",
			description = """
					비밀번호를 확인한 뒤 계정과 저장된 코스를 함께 지운다. 되돌릴 수 없다.

					지운 뒤에도 토큰 자체는 만료 전까지 형태가 유효하지만, 회원이 없으므로
					그 토큰으로 오는 요청은 전부 401이 된다.""")
	@DeleteMapping("/me")
	public ApiResponse<Void> deleteAccount(
			@AuthenticationPrincipal AuthenticatedMember member,
			@Valid @RequestBody DeleteAccountRequest request) {

		authService.deleteAccount(member.id(), request);
		return ApiResponse.ok(null);
	}
}
