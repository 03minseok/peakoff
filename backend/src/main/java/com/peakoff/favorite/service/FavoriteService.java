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
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;

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

	/**
	 * 내가 찜한 곳. 최근에 찜한 것부터.
	 *
	 * <p>지역을 아는 찜에는 <b>지금의 장소를 함께 싣는다.</b> 화면이 코스에 담긴 id를
	 * 이름과 좌표로 되살리는 데 쓴다 — 자세한 사정은 {@link FavoritePlaceResponse}.
	 *
	 * <p>⚠️ <b>저장해 둔 지역으로 곧장 찾는다</b>({@code findInRegion}). 한때
	 * {@code findById}를 썼는데 그것은 지역을 모를 때 쓰는 것이라 일곱 지역을 차례로 훑는다 —
	 * 캐시가 비어 있으면 춘천 장소 하나를 되살리려고 앞선 여섯 지역 카탈로그를 전부 받아왔다.
	 * <b>찜할 때 지역을 남겨 두는 이유가 이것이다.</b>
	 *
	 * <p>지역을 모르는 찜은 아예 찾지 않는다. 그런 찜에는 "여행가기" 문이 서지 않으므로
	 * 되살릴 일이 없고, 찾으려 들면 공사 호출이 목록을 열 때마다 나간다.
	 */
	@Transactional(readOnly = true)
	public List<FavoritePlaceResponse> findMine(Long memberId) {
		return favoriteRepository.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
				.map(favorite -> FavoritePlaceResponse.from(favorite, livePlaceOf(favorite)))
				.toList();
	}

	private Place livePlaceOf(FavoritePlace favorite) {
		if (favorite.region() == null) {
			return null;
		}
		Region region = SupportedRegion.fromSlug(favorite.region()).toRegion();
		return placeProvider.findInRegion(region, favorite.placeId()).orElse(null);
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

		/*
		 * 지역도 함께 남긴다. "이 장소로 여행가기"가 어느 지역으로 조건 화면을 열지
		 * 알아야 하는데, 장소 ID에는 지역이 묻어 있지 않다.
		 *
		 * <p>못 찾으면 null로 둔다 — 지어내면 엉뚱한 지역으로 코스가 열리고,
		 * 그 장소는 검색으로도 찾을 수 없는 칸이 된다.
		 */
		SupportedRegion region = placeProvider.regionOf(placeId).orElse(null);
		favoriteRepository.save(FavoritePlace.of(member, place, region, clock.instant()));
	}

	/** 찜을 푼다. 찜한 적 없으면 아무 일도 하지 않는다 */
	@Transactional
	public void remove(Long memberId, String placeId) {
		favoriteRepository.findByMemberIdAndPlaceId(memberId, placeId)
				.ifPresent(favoriteRepository::delete);
	}
}
