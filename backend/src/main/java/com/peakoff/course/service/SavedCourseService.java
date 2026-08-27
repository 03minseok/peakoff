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
import com.peakoff.course.dto.PublicCourseSummary;
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
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다.\n다시 로그인해 주세요."));

		if (savedCourseRepository.countByMemberId(memberId) >= SavedCourse.MAX_PER_MEMBER) {
			throw new ConflictException(
					"저장할 수 있는 코스는 %d개까지입니다.\n쓰지 않는 코스를 지우고 다시 시도해 주세요."
							.formatted(SavedCourse.MAX_PER_MEMBER));
		}

		/*
		 * 장소 이름을 여기서 찾아 함께 저장한다.
		 *
		 * 저장은 자주 일어나는 일이 아니다. 여기서 한 번 조회해두면 이후 목록·상세를
		 * 열 때마다 하던 조회가 통째로 사라진다 — 자주 도는 쪽에서 비용을 걷어내고
		 * 가끔 도는 쪽에 한 번 두는 맞바꿈이다.
		 *
		 * 요청에서 이름을 받지 않는 이유: 화면에 남을 이름을 클라이언트가 정하게 두면
		 * 저장된 코스가 실제 장소와 다른 것을 가리킬 수 있다. 출처가 서버여야 믿을 수 있다.
		 */
		List<PlaceEntry> entries = request.slots().stream()
				.map(slot -> new PlaceEntry(
						slot.day(),
						slot.order(),
						slot.placeId(),
						placeProvider.findById(slot.placeId())
								// 없는 장소가 섞인 코스를 저장하면 열 때마다 빈칸이 남는다.
								// 진단도 같은 이유로 거절하므로 여기서도 막는다.
								.orElseThrow(() -> new NotFoundException(
										"존재하지 않는 장소입니다: " + slot.placeId()))
								.name()))
				.toList();

		Instant now = Instant.now(clock);
		SavedCourse course = SavedCourse.save(
				member,
				request.name(),
				request.region(),
				request.startDate(),
				request.nights(),
				request.totalQuietness(),
				request.diagnosedCount(),
				request.forecastTargetCount(),
				// 고른 적 없는 요청은 비공개다. wantsPublic()이 null을 그렇게 읽는다.
				request.wantsPublic(),
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
	 * 저장된 내용만으로 응답을 만든다. <b>장소 쪽에 묻지 않는다.</b>
	 *
	 * <p>이름을 저장 시점에 남겨두었기 때문이다. 매번 다시 물으면 바깥에서 그 id의 내용이
	 * 바뀌는 순간 저장된 코스가 사용자 몰래 달라지고, 코스에 담긴 장소 수만큼 조회가 나간다.
	 */
	private SavedCourseDetail toDetail(SavedCourse course) {
		return SavedCourseDetail.from(course);
	}
	/**
	 * 최근 저장된 남의 코스 몇 개. 익명 요약이라 로그인 없이도 볼 수 있다.
	 *
	 * @param viewerId 보고 있는 사람. 로그인하지 않았으면 {@code null}.
	 *                 자기 코스는 "다른 사람들의 여행"이 아니므로 뺀다
	 */
	@Transactional(readOnly = true)
	public List<PublicCourseSummary> recent(Long viewerId, int limit) {
		List<SavedCourse> courses = viewerId == null
				? savedCourseRepository.findTop12ByOrderByCreatedAtDesc()
				: savedCourseRepository.findTop12ByMemberIdNotOrderByCreatedAtDesc(viewerId);

		/*
		 * <b>진단되지 않은 코스는 뺀다.</b> 총점이 없으면 홈 카드의 원형 게이지와 배지가
		 * 성립하지 않는다 — 그리고 애초에 "다른 사람들의 여행"으로 아직 재보지도 않은
		 * 코스를 내밀 이유가 없다. 이 목록의 값은 "남들은 얼마나 한적하게 다녔나"다.
		 *
		 * 거르기를 limit 앞에 둔다. 뒤에 두면 진단 안 된 코스가 자리를 차지해
		 * 보여줄 수 있는 코스가 있는데도 목록이 짧아진다.
		 */
		return courses.stream()
				/*
				 * 저장할 때 <b>공개하기로 고른 코스만</b> 내보낸다.
				 * 고른 적 없는 옛 코스도 여기서 빠진다(SavedCourse.isPublic 참고).
				 */
				.filter(SavedCourse::isPublic)
				.filter(course -> course.totalQuietness() != null)
				.limit(limit)
				.map(PublicCourseSummary::from)
				.toList();
	}
}
