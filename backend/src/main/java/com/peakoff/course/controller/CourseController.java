package com.peakoff.course.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.course.domain.CourseDraft;
import com.peakoff.course.dto.CourseDiagnosisRequest;
import com.peakoff.course.dto.CourseDiagnosisResponse;
import com.peakoff.course.dto.CourseDraftResponse;
import com.peakoff.course.dto.CourseRecommendRequest;
import com.peakoff.course.service.CourseDiagnosisService;
import com.peakoff.course.service.CourseDraftService;
import com.peakoff.global.response.ApiResponse;
import com.peakoff.place.domain.SupportedRegion;

@Tag(name = "코스", description = "사용자가 짠 코스의 진단과 설문 기반 코스 추천")
@RestController
@RequestMapping("/api/courses")
public class CourseController {

	private final CourseDiagnosisService courseDiagnosisService;
	private final CourseDraftService courseDraftService;

	public CourseController(
			CourseDiagnosisService courseDiagnosisService, CourseDraftService courseDraftService) {
		this.courseDiagnosisService = courseDiagnosisService;
		this.courseDraftService = courseDraftService;
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

	/**
	 * POST /api/courses/recommend
	 *
	 * <p>경주를 모르는 사용자의 진입점이다. 지금 흐름은 어디를 갈지 이미 아는 사람만 쓸 수 있다.
	 */
	@Operation(
			summary = "설문 기반 코스 추천",
			description = """
					설문 4문항을 받아 코스 초안을 만든다. 편집 화면에 그대로 얹을 수 있다.

					슬롯마다 왜 그곳이 뽑혔는지 근거와 추천도 구성 내역이 함께 나간다.
					점수는 교체 추천과 같은 추천도이고, 혼잡 민감도가 그 반영 비율을 바꾼다.

					같은 답을 다시 보내면 다른 코스가 나온다. 상위 후보군에서 가중 무작위로 뽑기
					때문이다 — 모든 사용자에게 같은 곳을 추천하면 그곳이 새로운 혼잡지가 된다.

					각 답이 무슨 값을 뜻하는지는 서버가 들고 있다.
					슬롯 수·반영 비율·반경은 응답에 그대로 드러난다.""")
	@PostMapping("/recommend")
	public ApiResponse<CourseDraftResponse> recommend(
			@Valid @RequestBody CourseRecommendRequest request) {

		SupportedRegion region = SupportedRegion.fromSlug(request.region());
		CourseDraft draft = courseDraftService.draft(
				region, request.startDate(), request.nights(), request.toAnswers());

		return ApiResponse.ok(CourseDraftResponse.from(draft, region.slug()));
	}
}
