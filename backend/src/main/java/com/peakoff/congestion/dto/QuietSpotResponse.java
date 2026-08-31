package com.peakoff.congestion.dto;

import java.time.LocalDate;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.QuietSpot;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.dto.PlaceResponse;

/**
 * "이번 주 한적한 곳" 한 줄.
 *
 * <p>장소는 {@link PlaceResponse}를 <b>그대로 품는다.</b> 대안 응답도 같은 모양이라
 * 화면이 장소 카드를 그리는 코드를 두 번 쓰지 않는다.
 *
 * <p>지역을 슬러그와 이름 <b>둘 다</b> 내려보낸다. 이름은 카드에 적을 것이고,
 * 슬러그는 "이 장소로 여행가기"가 여행 조건 화면에 넘길 값이다.
 * 화면이 이름으로 슬러그를 되찾게 두면 표기가 바뀌는 순간 그 길이 끊긴다.
 *
 * @param date      이번 주 중 <b>가장 한적한 날</b>. 이 값이 있어야 카드가
 *                  "9월 3일 수요일에 한적해요"라고 말할 수 있다
 * @param quietness 그 날의 한적도. 배지의 등급과 함께 원본 수치도 화면에 남긴다
 */
public record QuietSpotResponse(
		PlaceResponse place,
		String region,
		String regionName,
		LocalDate date,
		int quietness,
		CongestionLevel level,
		String levelLabel) {

	public static QuietSpotResponse of(QuietSpot spot, SupportedRegion region) {
		CongestionLevel level = spot.level();
		return new QuietSpotResponse(
				PlaceResponse.from(spot.place()),
				region.slug(),
				region.shortName(),
				spot.date(),
				spot.quietness(),
				level,
				level.label());
	}
}
