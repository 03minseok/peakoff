package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 진단 요청. 사용자가 직접 짠 코스가 그대로 들어온다.
 *
 * <p>슬롯에 한적도가 없는 것이 핵심이다. <b>첫 코스는 사용자의 의도를 존중한다.</b>
 * 점수는 사용자가 제출하는 값이 아니라 서버가 진단해서 돌려주는 값이다.
 *
 * <p>검증 애노테이션은 <b>요청의 모양</b>만 본다. "1박 2일 일정에 5일차 슬롯이 있는가" 같은
 * 여러 필드를 함께 봐야 하는 규칙은 {@code Course} 생성자가 계속 맡는다.
 * 필드 하나만 보고 판단할 수 없는 것은 애노테이션으로 표현되지 않는다.
 *
 * @param region    지역 슬러그 (예: "gyeongju")
 * @param startDate 여행 시작일 (yyyy-MM-dd)
 * @param nights    박 수. 당일치기는 0
 * @param slots     일자·순서대로 담은 방문지
 */
public record CourseDiagnosisRequest(
		@NotBlank(message = "지역이 필요합니다.")
		String region,

		@NotNull(message = "여행 시작일이 필요합니다.")
		LocalDate startDate,

		@Min(value = 0, message = "박 수는 0 이상이어야 합니다.")
		@Max(value = 6, message = "한 번에 계획할 수 있는 여행은 6박까지입니다.")
		int nights,

		@NotEmpty(message = "코스에 장소가 하나 이상 있어야 진단할 수 있습니다.")
		@Size(max = 50, message = "한 번에 진단할 수 있는 장소는 50곳까지입니다.")
		// 목록 안쪽 원소까지 검사하려면 @Valid가 필요하다. 없으면 목록 크기만 보고 넘어간다.
		@Valid
		List<SlotRequest> slots) {

	public record SlotRequest(
			@Min(value = 1, message = "일차는 1 이상이어야 합니다.")
			int day,

			@Min(value = 1, message = "순서는 1 이상이어야 합니다.")
			int order,

			@NotBlank(message = "장소를 지정해야 합니다.")
			String placeId) {
	}
}
