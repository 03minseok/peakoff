package com.peakoff.trip.controller;

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
import com.peakoff.global.response.ApiResponse;
import com.peakoff.trip.dto.AddTripCourseRequest;
import com.peakoff.trip.dto.CreateTripRequest;
import com.peakoff.trip.dto.TripResponse;
import com.peakoff.trip.service.TripService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 여행 — 저장한 코스의 묶음.
 *
 * <p>전부 로그인해야 쓸 수 있다. 이 파일에 그런 표시가 없는 이유는
 * {@code SavedCourseController}와 같다 — {@code SecurityConfig}의 허용 목록에 넣지 않아
 * {@code anyRequest().authenticated()}가 자동으로 막는다. 실수로 빠뜨렸을 때
 * 열리는 쪽이 아니라 닫히는 쪽으로 넘어진다.
 */
@Tag(name = "여행", description = "저장한 코스를 묶는 여행의 생성·조회·편집")
@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

	private final TripService tripService;

	@Operation(summary = "내 여행 목록", description = "최근 만든 것이 위로 온다. 담긴 코스는 담은 순서 그대로다.")
	@GetMapping
	public ApiResponse<List<TripResponse>> list(@AuthenticationPrincipal AuthenticatedMember member) {
		return ApiResponse.ok(tripService.list(member.id()));
	}

	@Operation(summary = "여행 만들기",
			description = "이름만 받는다. 코스는 만들고 나서 담는다 — 빈 여행도 여행이다.")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<TripResponse> create(
			@AuthenticationPrincipal AuthenticatedMember member,
			@Valid @RequestBody CreateTripRequest request) {
		return ApiResponse.ok(tripService.create(member.id(), request.name()));
	}

	@Operation(summary = "여행에 코스 담기",
			description = """
					내 코스를 여행 맨 뒤에 담는다. 같은 여행에 같은 코스는 한 번만 담긴다.

					담고 난 여행 전체를 돌려준다 — 화면이 목록을 다시 조회하지 않아도 된다.""")
	@PostMapping("/{tripId}/courses")
	public ApiResponse<TripResponse> addCourse(
			@AuthenticationPrincipal AuthenticatedMember member,
			@PathVariable Long tripId,
			@Valid @RequestBody AddTripCourseRequest request) {
		return ApiResponse.ok(tripService.addCourse(member.id(), tripId, request.courseId()));
	}

	@Operation(summary = "여행에서 코스 빼기",
			description = "코스는 여행에서만 빠진다. 저장 목록에는 그대로 남는다.")
	@DeleteMapping("/{tripId}/courses/{courseId}")
	public ApiResponse<TripResponse> removeCourse(
			@AuthenticationPrincipal AuthenticatedMember member,
			@PathVariable Long tripId,
			@PathVariable Long courseId) {
		return ApiResponse.ok(tripService.removeCourse(member.id(), tripId, courseId));
	}

	/**
	 * ⚠️ <b>204가 아니라 200 + 빈 본문이다.</b> 화면의 {@code apiRequest}가 모든 응답을
	 * {@code ApiResponse} 봉투로 읽으므로, 본문 없는 204를 받으면 JSON 해석에 실패해
	 * <b>성공한 삭제가 오류로 처리된다</b> — 실제로 여행이 화면에서 지워지지 않았다.
	 * 코스 삭제({@code SavedCourseController})도 같은 이유로 {@code ApiResponse<Void>}다.
	 */
	@Operation(summary = "여행 삭제", description = "묶음만 사라진다. 담겨 있던 코스는 저장 목록에 그대로 남는다.")
	@DeleteMapping("/{tripId}")
	public ApiResponse<Void> delete(
			@AuthenticationPrincipal AuthenticatedMember member,
			@PathVariable Long tripId) {
		tripService.delete(member.id(), tripId);
		return ApiResponse.ok(null);
	}
}
