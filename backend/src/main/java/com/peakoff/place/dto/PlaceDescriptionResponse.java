package com.peakoff.place.dto;

import com.peakoff.place.domain.PlaceDescription;

/**
 * 장소 하나의 읽을거리 응답.
 *
 * <p>화면이 <b>"설명 보기"를 펼칠 때만</b> 부른다. 목록에 붙이면 N곳 = 공사 호출 N번이 되고,
 * 그것이 2026-08-26 한도 소진 사고의 모양이었다({@code docs/OPEN_DECISIONS.md} 15번).
 *
 * @param address  도로명 주소. 없을 수 있다
 * @param overview 소개글. 없을 수 있다.
 *                 <b>{@code <br>} 같은 HTML 조각이 섞여 온다</b> — 공사가 그렇게 준다.
 *                 화면에서 다루되 <b>innerHTML로 넣지 말 것</b>(우리가 만든 문자열이 아니다)
 */
public record PlaceDescriptionResponse(String address, String overview) {

	public static PlaceDescriptionResponse from(PlaceDescription description) {
		return new PlaceDescriptionResponse(description.address(), description.overview());
	}

	/**
	 * 읽을거리를 못 구했을 때. <b>404가 아니라 빈 값으로 답한다.</b>
	 *
	 * <p>장소는 있는데 소개글이 없는 것이 정상이고(공사가 안 채워 둔 경우), 조회가 막혀서
	 * 못 가져오는 경우도 있다. 곁들이는 정보라 없다고 화면이 오류를 띄울 일은 아니다 —
	 * 펼쳤는데 "설명이 없어요"가 나오는 편이 정직하다.
	 */
	public static PlaceDescriptionResponse empty() {
		return new PlaceDescriptionResponse(null, null);
	}
}
