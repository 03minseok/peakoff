package com.peakoff.favorite.controller;

import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.peakoff.auth.jwt.AuthenticatedMember;
import com.peakoff.favorite.dto.FavoritePlaceResponse;
import com.peakoff.favorite.service.FavoriteService;
import com.peakoff.global.response.ApiResponse;

/**
 * 장소 찜하기.
 *
 * <p><b>로그인이 필요하다.</b> {@code SecurityConfig}의 허용 목록에 없으므로
 * {@code anyRequest().authenticated()}가 자동으로 막는다 — 여기 따로 적을 것이 없다.
 *
 * <p>게스트에게 열지 않은 이유: 이 저장소는 기기 저장(localStorage)을 걷어냈고
 * 저장되는 것은 계정에만 있다. 찜만 예외로 두면 "어디에 남는지"가 기능마다 달라진다.
 * 게스트에게는 화면이 로그인을 권한다.
 */
@Tag(name = "찜", description = "장소 찜하기와 찜 목록")
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

	private final FavoriteService favoriteService;

	/** GET /api/favorites — 내가 찜한 곳 */
	@Operation(
			summary = "내 찜 목록",
			description = """
					최근에 찜한 것부터 돌려준다.

					⚠️ 한적도는 담기지 않는다. 찜은 날짜가 없는 표시라 어느 날 기준으로 재야 할지
					정해지지 않는다 — 날짜 없이 점수를 붙이면 재지 않은 것을 말하게 된다.""")
	@GetMapping
	public ApiResponse<List<FavoritePlaceResponse>> findMine(
			@AuthenticationPrincipal AuthenticatedMember member) {
		return ApiResponse.ok(favoriteService.findMine(member.id()));
	}

	/**
	 * PUT /api/favorites/{placeId} — 찜한다.
	 *
	 * <p>POST가 아니라 PUT인 이유: 이 요청은 <b>몇 번을 보내도 결과가 같다</b>("찜한 상태").
	 * 화면이 하트 하나로 토글하는 자리라 연타나 두 탭에서 같은 요청이 실제로 두 번 간다.
	 *
	 * <p>⚠️ <b>204가 아니라 200 + 빈 봉투다.</b> 이 저장소의 모든 응답은 {@code ApiResponse}
	 * 봉투를 갖고, 화면은 그것을 <b>예외 없이</b> 파싱한다. 204로 본문을 비웠더니
	 * {@code response.json()}이 터져 "서버 응답을 해석할 수 없습니다"가 됐다 —
	 * 서버는 성공했는데 화면만 실패로 읽고 하트를 되돌렸다.
	 * 삭제 엔드포인트들이 모두 {@code ApiResponse<Void>}인 이유가 이것이다.
	 */
	@Operation(
			summary = "찜하기",
			description = """
					이미 찜한 곳이면 아무 일도 하지 않고 성공한다.

					장소 이름은 서버가 찾아 함께 남긴다 — 목록을 열 때마다 장소 수만큼
					공사를 부르지 않기 위해서다. 없는 장소는 거절한다.""")
	@PutMapping("/{placeId}")
	public ApiResponse<Void> add(
			@AuthenticationPrincipal AuthenticatedMember member,

			@Parameter(description = "장소 ID", example = "126508")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId) {
		favoriteService.add(member.id(), placeId);
		return ApiResponse.ok(null);
	}

	/** DELETE /api/favorites/{placeId} — 찜을 푼다. 찜한 적 없어도 성공한다 */
	@Operation(summary = "찜 취소", description = "찜한 적 없는 곳이어도 조용히 성공한다.")
	@DeleteMapping("/{placeId}")
	public ApiResponse<Void> remove(
			@AuthenticationPrincipal AuthenticatedMember member,

			@Parameter(description = "장소 ID", example = "126508")
			@PathVariable @NotBlank(message = "장소를 지정해야 합니다.") String placeId) {
		favoriteService.remove(member.id(), placeId);
		return ApiResponse.ok(null);
	}
}
