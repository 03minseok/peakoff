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
 * <h3>중분류를 함께 든다</h3>
 * 대분류만으로는 <b>대분류 하나가 여러 성격을 품는 경우</b>를 가릴 수 없다. {@code VE}가 그렇다 —
 * 박물관과 워터파크와 리조트가 한 코드 아래 있어서, 대분류만 보고 호환시키면
 * "역사 유적 자리에 워터파크"가 추천된다.
 *
 * <p>공사 응답은 중분류({@code lclsSystm2})를 <b>빠짐없이 채워 준다</b>(3개 지역 2,768곳 실측,
 * 2026-08-25). 다만 목업 카탈로그에는 없으므로 {@code null}을 허용하고, 없으면
 * 대분류만으로 판단한다.
 *
 * @param code    신분류 대분류 코드 (예: {@code VE})
 * @param subCode 신분류 중분류 코드 (예: {@code VE07}). 모르면 {@code null}
 * @param name    화면에 보여줄 분류명 (예: "자연관광지")
 */
public record PlaceCategory(String code, String subCode, String name) {

	public PlaceCategory {
		code = Texts.requireNotBlank(code, "신분류 코드");
		name = Texts.requireNotBlank(name, "분류명");
		if (subCode != null && subCode.isBlank()) {
			// 빈 문자열과 null이 섞이면 "모른다"를 두 가지로 표현하게 된다.
			subCode = null;
		}
	}

	/** 중분류를 모르는 자리(목업·옛 데이터)에서 쓴다. */
	public PlaceCategory(String code, String name) {
		this(code, null, name);
	}
}
