package com.peakoff.course.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.domain.SavedCourse.PlaceEntry;
import com.peakoff.course.domain.SavedCoursePlace;
import com.peakoff.course.domain.SavedCourseRepository;
import com.peakoff.course.dto.SaveCourseRequest;
import com.peakoff.course.dto.SavedCourseDetail;
import com.peakoff.course.dto.SavedCourseSummary;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.dto.PlaceResponse;

/**
 * 코스 저장·조회·삭제.
 *
 * <p>요청의 모양(이름 길이·슬롯 개수·점수 범위)은 컨트롤러의 {@code @Valid}가 이미 걸렀고,
 * 코스로서 말이 되는지(기간을 벗어난 일차 등)는 {@code SavedCourse} 생성자가 본다.
 * 여기서 판단하는 것은 <b>누구의 것이며 몇 개까지 되는가</b>뿐이다.
 *
 * <p><b>진단을 다시 돌리지 않는다.</b> 총점은 진단 화면이 서버에서 받아 온 값을 그대로 싣고 온다.
 * 같은 입력으로 다시 계산하면 같은 값이 나오므로, 저장할 때마다 공사 데이터를 한 번 더
 * 호출할 이유가 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SavedCourseService {

	private final SavedCourseRepository savedCourseRepository;
	private final MemberRepository memberRepository;
	private final PlaceProvider placeProvider;
	private final Clock clock;

	@Transactional
	public SavedCourseDetail save(Long memberId, SaveCourseRequest request) {
		Member member = memberRepository.findById(memberId)
				// 토큰은 유효한데 회원이 없다 — 탈퇴했거나 DB가 초기화된 경우다.
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다. 다시 로그인해 주세요."));

		if (savedCourseRepository.countByMemberId(memberId) >= SavedCourse.MAX_PER_MEMBER) {
			throw new ConflictException(
					"저장할 수 있는 코스는 %d개까지입니다. 쓰지 않는 코스를 지우고 다시 시도해 주세요."
							.formatted(SavedCourse.MAX_PER_MEMBER));
		}

		List<PlaceEntry> entries = request.slots().stream()
				.map(slot -> new PlaceEntry(slot.day(), slot.order(), slot.placeId()))
				.toList();

		Instant now = Instant.now(clock);
		SavedCourse course = SavedCourse.save(
				member,
				request.name(),
				request.region(),
				request.startDate(),
				request.nights(),
				request.totalQuietness(),
				entries,
				now);

		return toDetail(savedCourseRepository.save(course));
	}

	public List<SavedCourseSummary> findMine(Long memberId) {
		return savedCourseRepository.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
				.map(SavedCourseSummary::from)
				.toList();
	}

	public SavedCourseDetail findOne(Long memberId, Long courseId) {
		return toDetail(getOwned(memberId, courseId));
	}

	@Transactional
	public void delete(Long memberId, Long courseId) {
		// 존재 확인과 소유권 확인이 같은 질의에서 끝난다.
		savedCourseRepository.delete(getOwned(memberId, courseId));
	}

	/**
	 * 내 코스를 꺼낸다.
	 *
	 * <p>남의 코스 번호를 넣으면 <b>404</b>가 난다. 403으로 답하면 "그 코스는 있는데 네 것이 아니다"를
	 * 알려주는 셈이라, 번호를 훑어 남의 코스가 몇 개인지 세는 통로가 된다.
	 * 조회 자체를 회원 조건과 함께 걸어 두 경우를 구분할 수 없게 만든다.
	 */
	private SavedCourse getOwned(Long memberId, Long courseId) {
		return savedCourseRepository.findByIdAndMemberId(courseId, memberId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 코스입니다."));
	}

	/**
	 * 장소 정보를 한 번에 찾아 붙인다.
	 *
	 * <p>저장된 것은 {@code placeId}뿐이라 이름·좌표는 매번 장소 쪽에서 가져온다.
	 * 저장 시점에 베껴두면 두 벌이 되어 언젠가 어긋난다.
	 *
	 * <p>찾지 못한 장소는 표에 넣지 않는다. {@code SavedPlace.place}가 null이 되어
	 * 화면이 "정보를 찾을 수 없는 장소"로 그린다 — 코스 하나가 통째로 안 열리는 것보다 낫다.
	 */
	private SavedCourseDetail toDetail(SavedCourse course) {
		Map<String, PlaceResponse> placesById = course.places().stream()
				.map(SavedCoursePlace::placeId)
				.distinct()
				.map(placeProvider::findById)
				.flatMap(Optional::stream)
				.collect(Collectors.toMap(Place::id, PlaceResponse::from, (a, b) -> a));

		return SavedCourseDetail.of(course, placesById);
	}
}
