package com.peakoff.chat.controller;

import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.jwt.AuthenticatedMember;
import com.peakoff.chat.dto.ChatRequest;
import com.peakoff.chat.dto.ChatResponse;
import com.peakoff.chat.service.RegionChatService;
import com.peakoff.global.response.ApiResponse;

/**
 * 여행지 추천 챗봇.
 *
 * <h3>게스트도 쓴다</h3>
 * "어디 갈까"는 <b>여행 계획의 첫 결정</b>이라 로그인 뒤에 두면 아무도 못 만난다.
 * 인증은 코스를 저장하기 위한 것이지 진입 장벽이 아니다(CLAUDE.md 인증 1층).
 *
 * <h3>⚠️ 인증키는 서버에만 있다</h3>
 * 화면은 LLM을 직접 부르지 않는다. 브라우저에 키를 내려보내면 <b>소스를 열면 보인다</b> —
 * 크레딧이 유한한데 키가 공개되면 하루가 아니라 전부가 사라진다.
 */
@Tag(name = "챗봇", description = "질문으로 여행 지역 찾기")
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

	/**
	 * 프록시가 원래 주소를 적어 주는 헤더.
	 *
	 * <p>⚠️ <b>이걸 안 보면 게스트가 전부 한 사람이 된다.</b> 화면은 Vercel을 거쳐 서버에 닿으므로
	 * {@code getRemoteAddr()}이 보는 것은 언제나 <b>Vercel 엣지 하나</b>다. 그러면 개인 제한이
	 * 사실상 전체 제한이 되어, 심사위원 한 분이 연타하면 나머지 전원이 막힌다.
	 *
	 * <p>여러 프록시를 거치면 값이 쉼표로 이어지고 <b>맨 앞이 원래 주소</b>다.
	 */
	private static final String FORWARDED_FOR = "X-Forwarded-For";

	private final RegionChatService chatService;

	@Operation(summary = "챗봇 사용 가능 여부",
			description = "화면이 처음 뜰 때 한 번 묻는다. 꺼져 있으면 설문으로 안내한다.")
	@GetMapping("/status")
	public ApiResponse<Map<String, Boolean>> status() {
		return ApiResponse.ok(Map.of("enabled", chatService.isAvailable()));
	}

	@Operation(summary = "질문으로 지역 찾기",
			description = "지역 둘~셋을 카드로 돌려준다. 무관한 질문이나 챗봇이 쉬는 중일 때도 "
					+ "200으로 나가고 status로 갈린다 — 화면 한 칸이 오류로 죽으면 안 된다.")
	@PostMapping("/regions")
	public ApiResponse<ChatResponse> ask(
			@Valid @RequestBody ChatRequest request,
			@AuthenticationPrincipal AuthenticatedMember member,
			HttpServletRequest servletRequest) {

		return ApiResponse.ok(
				chatService.answer(request.question(), callerKeyOf(member, servletRequest)));
	}

	/**
	 * 누구의 호출인지.
	 *
	 * <p>회원은 <b>기기를 옮겨도 같은 사람</b>이고, 게스트는 주소로 가른다.
	 * 회원을 IP로 세면 같은 와이파이를 쓰는 일행이 서로의 몫을 깎는다.
	 */
	private static String callerKeyOf(AuthenticatedMember member, HttpServletRequest request) {
		if (member != null) {
			return "member:" + member.id();
		}
		return "ip:" + clientIpOf(request);
	}

	private static String clientIpOf(HttpServletRequest request) {
		String forwarded = request.getHeader(FORWARDED_FOR);
		if (forwarded == null || forwarded.isBlank()) {
			return request.getRemoteAddr();
		}
		String first = forwarded.split(",")[0].strip();
		return first.isEmpty() ? request.getRemoteAddr() : first;
	}
}
