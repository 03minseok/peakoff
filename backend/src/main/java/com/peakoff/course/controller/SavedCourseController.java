package com.peakoff.course.controller;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.jwt.AuthenticatedMember;
import com.peakoff.course.dto.SaveCourseRequest;
import com.peakoff.course.dto.SavedCourseDetail;
import com.peakoff.course.dto.SavedCourseSummary;
import com.peakoff.course.service.SavedCourseService;
import com.peakoff.global.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 저장된 코스.
 *
 * <p>여기 있는 것은 전부 로그인해야 쓸 수 있다. 그런데 이 파일에는 그런 표시가 없다 —
 * {@code SecurityConfig}의 허용 목록에 넣지 않았기 때문에 {@code anyRequest().authenticated()}가
 * 자동으로 막는다. 실수로 빠뜨렸을 때 열리는 쪽이 아니라 닫히는 쪽으로 넘어진다.
 *
 * <p>{@code CourseController}(진단)와 같은 {@code /api/courses}를 쓴다. 같은 자원을 다루므로
 * 경로를 나눌 이유가 없고, {@code POST /diagnose}와 {@code POST /}는 서로 부딪히지 않는다.
 */
@Tag(name = "저장 코스", description = "회원이 저장해둔 코스의 저장·조회·삭제")
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class SavedCourseController {

	private final SavedCourseService savedCourseService;

	@Operation(
			summary = "코스 저장",
			description = """
					진단을 마친 코스를 이름과 함께 계정에 저장한다.

					총점은 진단 화면이 서버에서 받아 온 값을 그대로 싣고 온다.
					같은 입력으로 다시 계산하면 같은 값이 나오므로 저장할 때 다시 진단하지 않는다.

					회원당 50개까지 저장할 수 있고, 넘으면 409가 나간다.""")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<SavedCourseDetail> save(
			@AuthenticationPrincipal AuthenticatedMember member,
			@Valid @RequestBody SaveCourseRequest request) {

		// 여기 도달했다는 것은 SecurityConfig가 이미 인증을 확인했다는 뜻이라 null 검사가 필요 없다.
		return ApiResponse.ok(savedCourseService.save(member.id(), request));
	}

	@Operation(
			summary = "내 코스 목록",
			description = "최근 저장한 것이 먼저 온다. 장소 목록은 담기지 않고 장소 수만 내려간다.")
	@GetMapping
	public ApiResponse<List<SavedCourseSummary>> findMine(
			@AuthenticationPrincipal AuthenticatedMember member) {
		return ApiResponse.ok(savedCourseService.findMine(member.id()));
	}

	@Operation(
			summary = "코스 상세",
			description = """
					담긴 장소까지 함께 돌려준다.

					남의 코스 번호를 넣으면 403이 아니라 404가 나간다.
					403은 "그 코스는 있는데 네 것이 아니다"를 알려주는 셈이라,
					번호를 훑어 남의 코스를 세는 통로가 된다.""")
	@GetMapping("/{courseId}")
	public ApiResponse<SavedCourseDetail> findOne(
			@AuthenticationPrincipal AuthenticatedMember member,
			@PathVariable Long courseId) {
		return ApiResponse.ok(savedCourseService.findOne(member.id(), courseId));
	}

	/**
	 * 204가 아니라 200으로 답한다.
	 *
	 * <p>204는 본문이 없는데, 프론트의 공통 호출 처리는 모든 응답을 {@code ApiResponse} 봉투로
	 * 읽는다. 여기서만 빈 본문을 주면 그 자리에서 "응답을 해석할 수 없습니다"가 된다.
	 */
	@Operation(summary = "코스 삭제", description = "남의 코스는 404. 담긴 장소도 함께 지워진다.")
	@DeleteMapping("/{courseId}")
	public ApiResponse<Void> delete(
			@AuthenticationPrincipal AuthenticatedMember member,
			@PathVariable Long courseId) {

		savedCourseService.delete(member.id(), courseId);
		return ApiResponse.ok(null);
	}
}
