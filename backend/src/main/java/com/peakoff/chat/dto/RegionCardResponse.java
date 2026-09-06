package com.peakoff.chat.dto;

import com.peakoff.chat.domain.RegionCard;

/**
 * 카드 한 장.
 *
 * <p>⚠️ <b>{@code quietShare}는 한적도가 아니라 비율이다.</b> 3단계 배지를 붙이지 말 것 —
 * 65/35 경계는 한적도의 경계라 이 값에는 뜻이 없다(OPEN_DECISIONS 11-2).
 * 이 값이 하는 일은 카드 셋을 나란히 놓았을 때 <b>차이를 보이는 것</b>이다.
 *
 * <p>⚠️ 문장을 누가 썼는지({@code CardLineSource})는 내려보내지 않는다.
 * 사용자에게는 그냥 한 줄이고, 우리가 알아야 할 값이지 화면이 알아야 할 값이 아니다.
 *
 * @param region       지역 slug. "이 지역에서 코스 발견하기"가 이 값으로 넘어간다
 * @param regionName   화면에 쓰는 짧은 이름
 * @param quietShare   이번 주 예측 중 한적한 관측의 비율 (0~100)
 * @param forecastSize 그 비율의 모수가 된 관광지 수
 * @param line         왜 이 지역인지 한 줄
 */
public record RegionCardResponse(
		String region,
		String regionName,
		int quietShare,
		int forecastSize,
		String line) {

	public static RegionCardResponse from(RegionCard card) {
		return new RegionCardResponse(
				card.region().slug(),
				card.region().shortName(),
				card.quietShare(),
				card.forecastSize(),
				card.line());
	}
}
