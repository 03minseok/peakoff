package com.peakoff.favorite.dto;

import java.time.Instant;

import com.peakoff.favorite.domain.FavoritePlace;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.PlaceResponse;

/**
 * 찜한 장소 하나.
 *
 * <p>⚠️ <b>한적도가 없다.</b> 찜은 날짜가 없는 표시라("언젠가 가고 싶다") 어느 날 기준으로
 * 재야 할지 정해지지 않는다. 날짜 없이 점수를 붙이면 화면이 재지 않은 것을 말하게 된다 —
 * 한적도는 여행 날짜가 정해진 진단 화면의 몫이다.
 *
 * @param placeName    찜한 시점의 이름. 목록을 열 때 공사를 다시 부르지 않으려고 남겨둔 값이다
 * @param categoryName ⚠️ <b>null일 수 있다.</b> 이 칸이 생기기 전에 찜한 행이 그렇다 —
 *                     자세한 사정은 {@link FavoritePlace}의 컬럼 주석. 화면은 그 자리를 비운다
 * @param imageUrl     대표 이미지. 이미지가 빈 관광지가 흔해 처음부터 null을 허용한다
 */
public record FavoritePlaceResponse(
		/**
		 * 지금의 장소. <b>좌표까지 든 온전한 값이다.</b>
		 *
		 * <p>찜해 둔 곳으로 여행을 시작하면 그 장소가 코스에 담기는데, 화면은 코스에 담긴
		 * id를 <b>이름과 좌표로 되살릴 수 있어야</b> 한다({@code placeCache}). 목록이
		 * 이름 문자열만 주면 편집 화면에서 그 칸이 숫자 id로 보인다 — 실제로 그랬다.
		 *
		 * <p>⚠️ <b>지역을 아는 찜에만 담는다.</b> 지역을 알면 그 카탈로그(6시간 캐시)에서
		 * 메모리 조회로 끝나지만, 모르는 장소를 찾으려 들면 공사 낱개 조회가
		 * <b>목록을 열 때마다 찜 수만큼</b> 나간다. 지역을 모르는 찜은 어차피
		 * "여행가기" 문이 서지 않으므로 되살릴 일도 없다.
		 *
		 * <p>못 찾으면 {@code null}이고, 그때는 아래 스냅샷이 카드를 그린다.
		 */
		PlaceResponse place,
		String placeId,
		String placeName,
		String categoryName,
		String imageUrl,
		String region,
		String regionName,
		Instant createdAt) {

	public static FavoritePlaceResponse from(FavoritePlace favorite, Place place) {
		/*
		 * 지역을 슬러그와 이름 <b>둘 다</b> 내려보낸다. 슬러그는 "이 장소로 여행가기"가
		 * 조건 화면에 넘길 값이고, 이름은 화면에 적을 것이다 — 화면이 슬러그로 이름을
		 * 만들게 두면 표기 규칙이 두 곳에 생긴다.
		 *
		 * 지역이 없는 찜(이 칸이 생기기 전에 찜했거나 카탈로그에 없는 장소)은 둘 다 null이다.
		 */
		String region = favorite.region();
		return new FavoritePlaceResponse(
				place == null ? null : PlaceResponse.from(place),
				favorite.placeId(),
				favorite.placeName(),
				favorite.categoryName(),
				favorite.imageUrl(),
				region,
				region == null ? null : SupportedRegion.fromSlug(region).shortName(),
				favorite.createdAt());
	}
}
