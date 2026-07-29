package com.peakoff.place.domain;

import com.peakoff.global.support.Texts;

/**
 * 여행 지역.
 *
 * <p>지역 지정은 반드시 <b>법정동 코드</b>를 쓴다. 구 지역코드 조회 체계는 26년 폐기 예정이므로
 * 필드명을 {@code legalDongCode}로 못 박아, 다른 체계의 코드가 섞여 들어오는 것을 코드 리뷰에서 잡을 수 있게 했다.
 *
 * @param legalDongCode 법정동 코드
 * @param name          화면에 보여줄 지역명 (예: "제주시 애월읍")
 */
public record Region(String legalDongCode, String name) {

	public Region {
		legalDongCode = Texts.requireNotBlank(legalDongCode, "법정동 코드");
		name = Texts.requireNotBlank(name, "지역명");
	}
}
