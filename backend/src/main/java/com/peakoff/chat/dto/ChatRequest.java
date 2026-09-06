package com.peakoff.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 챗봇에게 던지는 질문.
 *
 * <p>길이를 막는 이유는 <b>토큰이 곧 돈</b>이라서다. 긴 글을 붙여 넣으면 그만큼 청구되는데,
 * 여행지를 묻는 문장이 200자를 넘을 일이 없다.
 *
 * <p>⚠️ {@code String}으로 받는다. 원시 타입으로 받으면 값이 빠질 때
 * 요청 전체가 400이 된다(OPEN_DECISIONS 13번) — 여기는 애초에 필수라 상관없지만,
 * 검증 메시지를 우리가 정해야 화면이 그대로 띄울 수 있다.
 */
public record ChatRequest(

		@NotBlank(message = "질문을 입력해 주세요.")
		@Size(max = 200, message = "질문은 200자까지 입력할 수 있어요.")
		String question) {
}
