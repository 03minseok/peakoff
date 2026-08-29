package com.peakoff.place.domain;

import com.peakoff.global.support.Texts;

/**
 * 장소 하나의 <b>읽을거리</b> — 주소와 소개글.
 *
 * <h3>왜 {@link Place}에 넣지 않았는가</h3>
 * 소개글이 실측 중앙값 <b>528자</b>이고 길면 1,400자다({@code 경주 대릉원 일원}).
 * {@code Place}에 넣으면 검색 결과 30건마다 그것이 함께 실려 나가는데,
 * 목록에서는 <b>아무도 읽지 않는 글</b>이다. 필요한 때는 "하나를 자세히 볼 때"뿐이라
 * 그때만 따로 부른다.
 *
 * <h3>⚠️ 이 값은 카탈로그에 없다</h3>
 * 지역 카탈로그({@code areaBasedList2})는 목록용이라 소개글을 주지 않는다.
 * 오직 상세 조회({@code detailCommon2})에만 있으므로 <b>장소마다 한 번씩 공사를 부른다.</b>
 * 그래서 화면이 <b>펼칠 때만</b> 요청하게 해 두었다 — 목록에 붙이면 N곳 = N번이 되고,
 * 그것이 2026-08-26 한도 소진 사고의 모양이었다({@code docs/OPEN_DECISIONS.md} 15번).
 *
 * <p>대신 <b>추가 파라미터는 필요 없다.</b> 지금 보내는 요청({@code contentId}만)에
 * 이미 28개 필드가 오고 그 안에 소개글이 들어 있다 — 우리가 읽지 않고 버리고 있었을 뿐이다.
 * ⚠️ 옛 문서에 나오는 {@code overviewYN=Y}를 붙이면 오히려 응답이 깨진다(실측 2026-08-29).
 *
 * @param address  도로명 주소. 실측 18곳 전부 값이 있었지만 없을 수 있으므로 null을 허용한다
 * @param overview 소개글. <b>HTML 조각이 섞여 온다</b>({@code <br>} 등) — 화면에서 다룬다
 */
public record PlaceDescription(String address, String overview) {

	public PlaceDescription {
		// 빈 문자열과 없음을 한 가지로 통일한다. 화면이 "있는데 비었다"를 따로 다루지 않게.
		address = Texts.trimToNull(address);
		overview = Texts.trimToNull(overview);
	}

	/** 둘 다 없으면 보여줄 것이 없다. 그때는 화면이 펼침 자체를 열지 않는다. */
	public boolean isEmpty() {
		return address == null && overview == null;
	}
}
