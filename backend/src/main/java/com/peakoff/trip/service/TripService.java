package com.peakoff.trip.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.domain.SavedCourseRepository;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.global.error.UnauthorizedException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.trip.domain.Trip;
import com.peakoff.trip.domain.TripRepository;
import com.peakoff.trip.dto.TripResponse;

/**
 * 여행 만들기·코스 담기.
 *
 * <p>코스 담기의 소유권 검사가 <b>두 겹</b>이다 — 여행도 내 것이어야 하고 코스도 내 것이어야
 * 한다. 둘 다 저장소 조회가 {@code memberId}를 함께 받는 방식이라, 남의 것은 아예 찾아지지
 * 않아 404가 된다. 어느 한쪽이라도 빠지면 남의 코스를 내 여행에 담는 통로가 열린다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TripService {

	private final TripRepository tripRepository;
	private final SavedCourseRepository savedCourseRepository;
	private final MemberRepository memberRepository;
	private final Clock clock;

	public List<TripResponse> list(Long memberId) {
		return tripRepository.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
				.map(TripResponse::from)
				.toList();
	}

	@Transactional
	public TripResponse create(Long memberId, String name) {
		Member member = memberRepository.findById(memberId)
				.orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다.\n다시 로그인해 주세요."));

		if (tripRepository.countByMemberId(memberId) >= Trip.MAX_PER_MEMBER) {
			throw new ConflictException(
					"만들 수 있는 여행은 %d개까지입니다.\n쓰지 않는 여행을 지우고 다시 시도해 주세요."
							.formatted(Trip.MAX_PER_MEMBER));
		}

		Trip trip = Trip.create(member, name, Instant.now(clock));
		return TripResponse.from(tripRepository.save(trip));
	}

	@Transactional
	public TripResponse addCourse(Long memberId, Long tripId, Long courseId) {
		Trip trip = getOwned(memberId, tripId);
		SavedCourse course = savedCourseRepository.findByIdAndMemberId(courseId, memberId)
				.orElseThrow(() -> new NotFoundException("코스를 찾을 수 없습니다."));

		trip.add(course);   // 상한·중복 검사는 도메인이 한다
		return TripResponse.from(trip);
	}

	@Transactional
	public TripResponse removeCourse(Long memberId, Long tripId, Long courseId) {
		Trip trip = getOwned(memberId, tripId);
		trip.remove(courseId);
		return TripResponse.from(trip);
	}

	/** 여행을 지운다. <b>담긴 코스는 지워지지 않는다</b> — 여행은 코스를 가리킬 뿐 소유하지 않는다. */
	@Transactional
	public void delete(Long memberId, Long tripId) {
		tripRepository.delete(getOwned(memberId, tripId));
	}

	private Trip getOwned(Long memberId, Long tripId) {
		return tripRepository.findByIdAndMemberId(tripId, memberId)
				.orElseThrow(() -> new NotFoundException("여행을 찾을 수 없습니다."));
	}
}
