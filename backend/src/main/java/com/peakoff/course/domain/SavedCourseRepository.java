package com.peakoff.course.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 저장된 코스 저장소.
 *
 * <p><b>조회 메서드가 전부 {@code memberId}를 함께 받는다.</b> 이것이 소유권 검사다.
 * {@code findById(courseId)}로 먼저 꺼낸 뒤 "내 것인가"를 확인하는 방식이면
 * 확인을 한 곳에서라도 빠뜨리는 순간 남의 코스가 열린다. 아예 남의 것은 찾아지지 않게 두면
 * 그 실수를 할 자리가 없어진다.
 *
 * <p>그래서 남의 코스를 물으면 "없음"이 되어 404가 나간다. 403으로 답하면
 * "그 코스는 있는데 네 것이 아니다"를 알려주는 셈이라, 남의 코스 존재 여부를 확인하는 통로가 된다.
 */
public interface SavedCourseRepository extends JpaRepository<SavedCourse, Long> {

	/**
	 * 내 코스 목록. 최근 저장한 것이 위로 온다.
	 *
	 * <p>{@code @EntityGraph}로 장소까지 한 번에 읽는다. 없으면 코스마다 장소를 따로 읽어
	 * 목록에 10개가 있을 때 쿼리가 11번 나간다(N+1). 화면이 장소 수를 보여주므로 어차피 필요하다.
	 */
	@EntityGraph(attributePaths = "places")
	List<SavedCourse> findByMemberIdOrderByCreatedAtDesc(Long memberId);

	@EntityGraph(attributePaths = "places")
	Optional<SavedCourse> findByIdAndMemberId(Long id, Long memberId);

	/** 저장 상한을 넘었는지 확인할 때 쓴다. */
	long countByMemberId(Long memberId);
}
