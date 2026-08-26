package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.dto.CourseDiagnosisRequest.SlotRequest;
import com.peakoff.global.support.Scores;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 코스 저장 요청.
 *
 * <p>슬롯 타입을 {@link CourseDiagnosisRequest}의 것을 그대로 쓴다. 모양이 똑같은데
 * 타입을 따로 만들면 한쪽만 고쳐지는 날이 온다. 프론트도 진단에 보낸 배열을 그대로 실어 보낸다.
 *
 * <h3>왜 총점을 클라이언트에서 받는가</h3>
 * 진단 요청과 반대로 여기서는 점수를 <b>받는다.</b> 성격이 다르기 때문이다.
 *
 * <p>진단은 "우리가 혼잡을 알려준다"는 서비스의 주장 자체라, 사용자가 점수를 적어 보내면
 * 제품이 무의미해진다. 저장은 <b>서버가 방금 내려준 답을 그대로 남기는 일</b>이다.
 * 같은 입력으로 다시 계산하면 같은 값이 나오므로, 저장할 때마다 공사 데이터를 한 번 더
 * 호출하는 것은 낭비다.
 *
 * <p>값을 조작해 보낼 수는 있다. 다만 그 코스는 <b>본인만 본다</b> — 순위도 보상도 없어
 * 왜곡되는 것은 자기 마이페이지의 숫자뿐이다. 범위 검증만 걸어 둔다.
 *
 * @param name           사용자가 붙인 여행 이름
 * @param totalQuietness 진단 화면이 받아 온 코스 총점 (0~100).
 *                       <b>진단되지 않은 코스는 {@code null}</b> — 여행일이 예측 창 밖이거나
 *                       (아직 없다) 밥집만 담았을 때다(영영 없다). 둘 다 저장을 막지 않는다:
 *                       저장은 재료를 남기는 일이고 점수는 있으면 함께 남기는 것이다.
 *                       {@code @Min}/{@code @Max}는 null을 통과시킨다
 */
public record SaveCourseRequest(

		@NotBlank(message = "여행 이름을 입력해 주세요.")
		@Size(max = SavedCourse.NAME_MAX_LENGTH,
				message = "여행 이름은 " + SavedCourse.NAME_MAX_LENGTH + "자 이하여야 합니다.")
		String name,

		@NotBlank(message = "지역이 필요합니다.")
		String region,

		@NotNull(message = "여행 시작일이 필요합니다.")
		LocalDate startDate,

		@Min(value = 0, message = "박 수는 0 이상이어야 합니다.")
		@Max(value = 6, message = "한 번에 계획할 수 있는 여행은 6박까지입니다.")
		int nights,

		@Min(value = Scores.MIN, message = "코스 총점은 0~100 범위여야 합니다.")
		@Max(value = Scores.MAX, message = "코스 총점은 0~100 범위여야 합니다.")
		Integer totalQuietness,

		/*
		 * 그 총점이 몇 곳을 근거로 한 값인지. 점수만 남기면 나중에 열었을 때
		 * 근거가 얇은 점수와 두꺼운 점수가 같은 무게로 나란히 선다.
		 *
		 * 없어도 저장은 된다 — 옛 화면이 보내는 요청을 거절하면 그 사용자는 저장을 못 한다.
		 */
		@Min(value = 0, message = "진단된 칸 수는 0 이상이어야 합니다.")
		Integer diagnosedCount,

		@Min(value = 0, message = "예측 대상 관광지 수는 0 이상이어야 합니다.")
		Integer forecastTargetCount,

		@NotEmpty(message = "코스에 장소가 하나 이상 있어야 저장할 수 있습니다.")
		@Size(max = 50, message = "한 번에 저장할 수 있는 장소는 50곳까지입니다.")
		// 목록 안쪽 원소까지 검사하려면 @Valid가 필요하다. 없으면 목록 크기만 보고 넘어간다.
		@Valid
		List<SlotRequest> slots) {
}
