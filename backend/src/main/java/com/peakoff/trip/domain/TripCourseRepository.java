package com.peakoff.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 여행-코스 연결 저장소. <b>정리 전용이다.</b>
 *
 * <p>일상 조작(담기·빼기)은 {@code Trip} 엔티티의 컬렉션을 거친다 — 상한·중복 검사가
 * 도메인에 있어서다. 여기 있는 것은 코스나 회원이 사라질 때 연결이 허공을 가리키지 않게
 * 치우는 벌크 삭제뿐이다.
 */
public interface TripCourseRepository extends JpaRepository<TripCourse, Long> {

	/** 코스 삭제 정리. 이 코스를 담고 있던 모든 여행에서 빠진다. */
	@Modifying
	@Query("delete from TripCourse tc where tc.course.id = :courseId")
	void deleteByCourseId(@Param("courseId") Long courseId);

	/** 회원 탈퇴 정리. {@code TripRepository.deleteByMemberId} <b>앞</b>에 불러야 한다. */
	@Modifying
	@Query("delete from TripCourse tc where tc.trip.member.id = :memberId")
	void deleteByTripMemberId(@Param("memberId") Long memberId);

	/** 이 코스를 담고 있는 여행 수. 코스 삭제 확인 문구에 쓸 수 있게 열어 둔다. */
	long countByCourseId(Long courseId);
}
