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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.jwt.AuthenticatedMember;
import com.peakoff.course.dto.SaveCourseRequest;
import com.peakoff.course.dto.PublicCourseSummary;
import com.peakoff.course.dto.SavedCourseDetail;
import com.peakoff.course.dto.SavedCourseSummary;
import com.peakoff.course.service.SavedCourseService;
import com.peakoff.global.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

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

	/** 홈에 서는 카드 수. 한 열에 담기는 만큼만 */
	private static final int DEFAULT_RECENT_LIMIT = 4;

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
	/**
	 * GET /api/courses/recent?limit=4 — 다른 사람들이 최근에 저장한 코스.
	 *
	 * <p><b>로그인 없이 볼 수 있다.</b> 홈에 서는 목록이고, 게스트도 홈을 본다.
	 * 대신 나가는 것은 익명 요약이라 코스 id도 이름도 담기지 않는다.
	 *
	 * <p>로그인한 사람에게는 자기 코스를 뺀다 — 내가 저장한 것을 "다른 사람들의 여행"이라고
	 * 보여줄 수는 없다. 이 화면은 열려 있으므로 {@code member}가 {@code null}일 수 있다.
	 */
	@Operation(
			summary = "다른 사람들의 최근 코스 (익명)",
			description = """
					최근 저장된 코스를 익명으로 요약해 돌려준다. 로그인 없이 부를 수 있다.

					코스 id와 이름, 저장한 사람은 담기지 않는다. 이름은 사용자가 자기만 볼 줄 알고
					지은 것이라 공개에 동의한 적이 없고, id는 열어 볼 길을 아예 두지 않으려고 뺐다.

					지역·기간·총점과 <b>담긴 장소 전부</b>가 나간다. 홈에서 카드를 눌러 펼쳐 볼 수
					있는데, 상세 엔드포인트를 따로 열지 않고 이 목록에 내용을 실었다 —
					코스에 주소를 주면 번호를 훑어 남의 코스를 하나씩 여는 통로가 생긴다.
					카드에 보이는 앞 세 곳은 화면이 잘라 쓴다.

					로그인 상태면 자기 코스는 빠진다.""")
	@GetMapping("/recent")
	public ApiResponse<List<PublicCourseSummary>> findRecent(
			@AuthenticationPrincipal AuthenticatedMember member,

			@Parameter(description = "최대 개수")
			@RequestParam(defaultValue = "" + DEFAULT_RECENT_LIMIT)
			@Min(value = 1, message = "개수는 1 이상이어야 합니다.")
			@Max(value = 12, message = "한 번에 12개까지 볼 수 있습니다.")
			int limit) {

		return ApiResponse.ok(savedCourseService.recent(member == null ? null : member.id(), limit));
	}
}
