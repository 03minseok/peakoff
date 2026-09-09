package com.peakoff.chat.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * 카드 문장을 따로 받아 갈 때 화면이 되돌려 보내는 것.
 *
 * <p>서버가 앞 답을 기억해 두지 않으므로 문장을 쓰는 데 필요한 것을 화면이 다시 준다.
 * 기억해 두면 세션이 생기고, "완성된 답을 캐시하지 않는다"는 규칙과도 부딪힌다.
 *
 * <p>⚠️ 여기 담긴 값으로 <b>카드의 숫자를 다시 그리지 않는다.</b> 화면이 보낸 것이라 믿을 수
 * 없고, 믿을 필요도 없다 — 돌아가는 것은 문장뿐이다. {@code quietShare}는 문장의 말투를
 * 고르는 데만 쓰인다("한적한 곳이 많은 편" / "덜 붐비는 편").
 */
public record ChatLinesRequest(

		@NotBlank(message = "질문을 입력해 주세요.")
		@Size(max = 200, message = "질문은 200자까지 입력할 수 있어요.")
		String question,

		/** 앞 응답의 {@code interestCode}를 그대로. 모르는 값은 관심사 없음으로 읽는다 */
		String interest,

		@NotEmpty(message = "문장을 쓸 지역이 필요합니다.")
		@Size(max = 4, message = "지역은 4곳까지입니다.")
		@Valid
		List<Region> regions) {

	/** 앞 응답의 카드 하나. 화면이 그대로 옮겨 담는다 */
	public record Region(
			@NotBlank(message = "지역이 필요합니다.")
			String slug,
			Integer quietShare) {
	}
}
