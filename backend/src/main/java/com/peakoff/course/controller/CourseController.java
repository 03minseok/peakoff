package com.peakoff.course.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.course.dto.CourseDiagnosisRequest;
import com.peakoff.course.dto.CourseDiagnosisResponse;
import com.peakoff.course.service.CourseDiagnosisService;
import com.peakoff.global.response.ApiResponse;

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
	@PostMapping("/diagnose")
	public ApiResponse<CourseDiagnosisResponse> diagnose(@RequestBody CourseDiagnosisRequest request) {
		return ApiResponse.ok(courseDiagnosisService.diagnose(request));
	}
}
