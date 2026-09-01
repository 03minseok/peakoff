package com.peakoff.trip.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 여행 저장소.
 *
 * <p><b>조회 메서드가 전부 {@code memberId}를 함께 받는다.</b> {@code SavedCourseRepository}와
 * 같은 이유다 — 남의 것은 아예 찾아지지 않게 두면 소유권 확인을 빠뜨릴 자리가 없다.
 */
public interface TripRepository extends JpaRepository<Trip, Long> {

	/**
	 * 내 여행 목록. 최근 만든 것이 위로 온다.
	 *
	 * <p>연결과 코스까지 한 번에 읽는다. <b>코스의 장소 목록까지는 펼치지 않는다</b> —
	 * {@code Trip.courses}와 {@code SavedCourse.places}가 둘 다 List라 함께 펼치면
	 * 하이버네이트가 MultipleBagFetch로 거절한다. 장소는 코스별로 따로 읽히지만
	 * 여행 20개 × 코스 10개가 상한이라 감당되는 수다.
	 */
	@EntityGraph(attributePaths = { "courses", "courses.course" })
	List<Trip> findByMemberIdOrderByCreatedAtDesc(Long memberId);

	@EntityGraph(attributePaths = { "courses", "courses.course" })
	Optional<Trip> findByIdAndMemberId(Long id, Long memberId);

	long countByMemberId(Long memberId);

	/**
	 * 회원 탈퇴 정리. <b>연결부터 지운 뒤 불러야 한다</b>({@code TripCourseRepository}) —
	 * 벌크 삭제는 엔티티의 cascade를 타지 않는다.
	 */
	@Modifying
	@Query("delete from Trip t where t.member.id = :memberId")
	void deleteByMemberId(@Param("memberId") Long memberId);
}
