package com.peakoff.place.domain;

import com.peakoff.global.support.Texts;

/**
 * 관광지 분류.
 *
 * <p>분류 지정은 반드시 <b>신분류 코드</b>를 쓴다. 구 서비스 분류코드 체계는 26년 폐기 예정이다.
 *
 * <p>코드와 표시명을 한 덩어리로 묶은 이유: 화면에는 이름이 필요하고 재조회에는 코드가 필요한데,
 * 둘을 따로 들고 다니면 짝이 어긋난 상태가 만들어질 수 있다.
 *
 * @param code 신분류 코드
 * @param name 화면에 보여줄 분류명 (예: "자연관광지")
 */
public record PlaceCategory(String code, String name) {

	public PlaceCategory {
		code = Texts.requireNotBlank(code, "신분류 코드");
		name = Texts.requireNotBlank(name, "분류명");
	}
}
