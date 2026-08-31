package com.peakoff.favorite.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 찜한 장소 저장소.
 *
 * <p>모든 조회가 {@code memberId}를 함께 받는다. 찜은 회원마다 따로이고, 남의 것을 볼 길이
 * 있어서는 안 된다 — 저장 코스가 같은 규칙을 쓴다({@code findByIdAndMemberId}).
 */
public interface FavoritePlaceRepository extends JpaRepository<FavoritePlace, Long> {

	/** 최근에 찜한 것부터. 목록 화면이 그 순서로 읽힌다 */
	List<FavoritePlace> findByMemberIdOrderByCreatedAtDesc(Long memberId);

	Optional<FavoritePlace> findByMemberIdAndPlaceId(Long memberId, String placeId);

	boolean existsByMemberIdAndPlaceId(Long memberId, String placeId);
}
