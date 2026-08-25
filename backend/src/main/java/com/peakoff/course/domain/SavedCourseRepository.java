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

	/**
	 * 최근 저장된 코스. <b>주인을 가리지 않는다</b> — 홈의 "다른 사람들의 여행"에 쓴다.
	 *
	 * <p>이 저장소의 다른 메서드가 전부 {@code memberId}를 받는 것과 어긋나 보이지만,
	 * 여기서 나가는 것은 코스 자체가 아니라 <b>익명 요약</b>이다({@code PublicCourseSummary}).
	 * 이름도 id도 담기지 않아 열어 볼 길이 없다.
	 *
	 * <p>둘로 나눈 이유: 로그인한 사람에게 자기 코스를 "다른 사람들의 여행"이라고
	 * 보여줄 수는 없다. 게스트는 가릴 것이 없어 위쪽을 쓴다.
	 */
	@EntityGraph(attributePaths = "places")
	List<SavedCourse> findTop12ByOrderByCreatedAtDesc();

	@EntityGraph(attributePaths = "places")
	List<SavedCourse> findTop12ByMemberIdNotOrderByCreatedAtDesc(Long memberId);

	/** 저장 상한을 넘었는지 확인할 때 쓴다. */
	long countByMemberId(Long memberId);

	/**
	 * 그 회원의 코스를 전부 지운다. 탈퇴할 때 쓴다.
	 *
	 * <p>파생 삭제 메서드는 <b>엔티티를 읽어 하나씩 지운다.</b> 그래서
	 * {@code SavedCourse.places}의 {@code cascade}·{@code orphanRemoval}이 그대로 걸려
	 * 담긴 장소도 함께 사라진다. {@code deleteAllInBatch} 같은 일괄 삭제로 바꾸면
	 * 그 연쇄가 건너뛰어져 장소만 남고 외래키 제약에 걸린다.
	 */
	void deleteByMemberId(Long memberId);
}
