package com.peakoff.course.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.peakoff.course.domain.survey.CrowdSensitivity;
import com.peakoff.course.domain.survey.ItineraryDensity;
import com.peakoff.course.domain.survey.SurveyAnswers;

/**
 * 설문 기반 코스 추천 요청.
 *
 * <p>앞의 세 필드(지역·시작일·박 수)는 진단 요청과 같다. 여행 조건 입력 화면을 그대로 쓴다.
 *
 * <p><b>각 답이 무슨 숫자를 뜻하는지는 여기 없다.</b> 밀도가 몇 슬롯인지, 민감도가 한적도를
 * 몇 퍼센트 반영하는지는 전부 서버 안(설문 enum)에 있다. 프론트는 {@code QUIET}라는 이름만
 * 보내고 그것이 85%인지 90%인지 모른다 — 분석 결과로 값이 바뀔 때 화면을 고치지 않기 위해서다.
 * 한적도 임계값을 서버에 둔 것과 같은 이유다.
 *
 * <p>⚠️ {@code styles}(여행 스타일)와 {@code transport}(이동수단)를
 * <b>2026-08-27에 뺐다.</b> 요청 본문이 바뀌는 변경이라 화면과 함께 나가야 한다.
 * 이유는 {@code SurveyAnswers}에 적어 두었다.
 *
 * @param region      지역 슬러그 (예: "gyeongju")
 * @param startDate   여행 시작일 (yyyy-MM-dd)
 * @param nights      박 수. 당일치기는 0
 * @param density     일정 밀도
 * @param sensitivity 혼잡 민감도
 */
public record CourseRecommendRequest(
		@NotBlank(message = "지역이 필요합니다.")
		String region,

		@NotNull(message = "여행 시작일이 필요합니다.")
		LocalDate startDate,

		@Min(value = 0, message = "박 수는 0 이상이어야 합니다.")
		@Max(value = 6, message = "한 번에 계획할 수 있는 여행은 6박까지입니다.")
		int nights,

		@NotNull(message = "일정 밀도를 골라야 합니다.")
		ItineraryDensity density,

		@NotNull(message = "혼잡 민감도를 골라야 합니다.")
		CrowdSensitivity sensitivity) {

	/** 바깥과의 계약(DTO)을 안에서 쓰는 값(도메인)으로 옮긴다. */
	public SurveyAnswers toAnswers() {
		return new SurveyAnswers(density, sensitivity);
	}
}
