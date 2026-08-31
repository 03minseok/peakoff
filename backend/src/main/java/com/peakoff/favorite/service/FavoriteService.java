package com.peakoff.favorite.service;

import java.time.Clock;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.peakoff.favorite.domain.FavoritePlace;
import com.peakoff.favorite.domain.FavoritePlaceRepository;
import com.peakoff.favorite.dto.FavoritePlaceResponse;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;

/**
 * 장소 찜하기.
 *
 * <h2>두 동작 다 <b>멱등</b>이다</h2>
 * 이미 찜한 곳을 또 찜하거나, 찜하지 않은 곳을 취소해도 조용히 성공한다.
 * 화면이 하트 하나로 켜고 끄는 자리라 <b>같은 요청이 두 번 가는 일이 실제로 생긴다</b> —
 * 연타, 두 탭, 느린 응답에 다시 누르기. 그때 409나 404로 답하면 화면은 아무 잘못도 하지
 * 않았는데 오류를 띄우게 되고, 사용자가 보는 결과("켜져 있다")는 어느 쪽이든 같다.
 */
@Service
@RequiredArgsConstructor
public class FavoriteService {

	private final FavoritePlaceRepository favoriteRepository;
	private final MemberRepository memberRepository;
	private final PlaceProvider placeProvider;
	private final Clock clock;

	/** 내가 찜한 곳. 최근에 찜한 것부터 */
	@Transactional(readOnly = true)
	public List<FavoritePlaceResponse> findMine(Long memberId) {
		return favoriteRepository.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
				.map(FavoritePlaceResponse::from)
				.toList();
	}

	/**
	 * 찜한다.
	 *
	 * <p><b>이름은 여기서 찾아 담는다.</b> 요청에서 받으면 목록이 실제 장소와 다른 것을
	 * 가리킬 수 있다 — 출처가 서버여야 믿을 수 있다. 없는 장소는 거절한다.
	 * 담고 나서 이름이 빈 카드가 목록에 남는 것보다, 누른 그 자리에서 실패하는 편이 낫다.
	 */
	@Transactional
	public void add(Long memberId, String placeId) {
		if (favoriteRepository.existsByMemberIdAndPlaceId(memberId, placeId)) {
			return;
		}
		Member member = memberRepository.findById(memberId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 회원입니다."));
		Place place = placeProvider.findById(placeId)
				.orElseThrow(() -> new NotFoundException("존재하지 않는 장소입니다: " + placeId));

		favoriteRepository.save(
				FavoritePlace.of(member, placeId, place.name(), clock.instant()));
	}

	/** 찜을 푼다. 찜한 적 없으면 아무 일도 하지 않는다 */
	@Transactional
	public void remove(Long memberId, String placeId) {
		favoriteRepository.findByMemberIdAndPlaceId(memberId, placeId)
				.ifPresent(favoriteRepository::delete);
	}
}
