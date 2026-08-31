package com.peakoff.favorite.dto;

import java.time.Instant;

import com.peakoff.favorite.domain.FavoritePlace;

/**
 * 찜한 장소 하나.
 *
 * <p>⚠️ <b>한적도가 없다.</b> 찜은 날짜가 없는 표시라("언젠가 가고 싶다") 어느 날 기준으로
 * 재야 할지 정해지지 않는다. 날짜 없이 점수를 붙이면 화면이 재지 않은 것을 말하게 된다 —
 * 한적도는 여행 날짜가 정해진 진단 화면의 몫이다.
 *
 * @param placeName 찜한 시점의 이름. 목록을 열 때 공사를 다시 부르지 않으려고 남겨둔 값이다
 */
public record FavoritePlaceResponse(
		String placeId,
		String placeName,
		String categoryName,
		String imageUrl,
		Instant createdAt) {

	public static FavoritePlaceResponse from(FavoritePlace favorite) {
		return new FavoritePlaceResponse(
				favorite.placeId(),
				favorite.placeName(),
				favorite.categoryName(),
				favorite.imageUrl(),
				favorite.createdAt());
	}
}
