package com.peakoff.course.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.course.dto.CourseDiagnosisRequest;
import com.peakoff.course.dto.CourseDiagnosisResponse;
import com.peakoff.course.service.CourseDiagnosisService;
import com.peakoff.global.response.ApiResponse;

@Tag(name = "코스", description = "사용자가 짠 코스의 진단")
@RestController
@RequestMapping("/api/courses")
public class CourseController {

	private final CourseDiagnosisService courseDiagnosisService;

	public CourseController(CourseDiagnosisService courseDiagnosisService) {
		this.courseDiagnosisService = courseDiagnosisService;
	}

	/**
	 * POST /api/courses/diagnose
	 *
	 * <p>조회지만 POST인 이유: 코스 전체를 본문으로 받아야 하는데, 슬롯 목록을
	 * 쿼리 스트링에 담으면 길이 제한과 인코딩 문제에 걸린다.
	 */
	@Operation(
			summary = "코스 진단",
			description = """
					코스를 받아 장소마다 그 날짜의 한적도를 매기고 코스 총점을 돌려준다.

					요청에는 한적도를 담지 않는다. 첫 코스는 사용자의 의도를 존중하고,
					점수는 서버가 진단해서 돌려주는 값이다.
					2일차 장소는 시작일 다음 날 기준으로 계산된다.""")
	@PostMapping("/diagnose")
	public ApiResponse<CourseDiagnosisResponse> diagnose(
			@Valid @RequestBody CourseDiagnosisRequest request) {
		return ApiResponse.ok(courseDiagnosisService.diagnose(request));
	}
}
