package com.peakoff.place.domain;

import com.peakoff.global.support.Texts;

/**
 * 여행 지역.
 *
 * <p>지역 지정은 반드시 <b>법정동 코드</b>를 쓴다. 구 지역코드 조회 체계는 26년 폐기 예정이므로
 * 필드명을 {@code legalDongCode}로 못 박아, 다른 체계의 코드가 섞여 들어오는 것을 코드 리뷰에서 잡을 수 있게 했다.
 *
 * <h3>⚠️ 왜 코드가 둘인가 (2026-08-31)</h3>
 * <b>공사 API들이 서로 다른 세대의 법정동 코드를 쓴다.</b> 여수를 넣다가 드러났다 —
 * 광주·전남이 <b>전남광주통합특별시</b>로 합쳐지면서 코드가 {@code 46}에서 {@code 12}로
 * 바뀌었는데, 옮겨간 API가 하나뿐이다.
 *
 * <pre>
 *                        여수시        옮겼나
 * 국문 관광정보          12 / 130       ✅ 통합 코드
 * 집중률 예측            46 / 46130     ❌ 옛 코드
 * 연관 관광지            46 / 46130     ❌
 * 중심 관광지            46 / 46130     ❌
 * </pre>
 *
 * <p>코드를 하나만 들고 있으면 <b>어느 쪽을 넣어도 절반이 빈다.</b> 그것도 오류가 아니라
 * {@code totalCount=0}이라 "여수에 관광지가 없다"로 조용히 읽힌다.
 * 그래서 관광정보용 코드를 따로 받는다 — 지금 갈리는 곳은 광주·전남뿐이고
 * 나머지 지역은 두 값이 같다.
 *
 * <p>⚠️ <b>이 어긋남은 시간이 지나면 뒤집힌다.</b> 나머지 API도 통합 코드로 옮겨가면
 * 그때는 {@code 46}이 조용히 비게 된다. 지역을 늘리거나 자료가 갑자기 비면
 * 두 코드를 모두 의심할 것.
 *
 * @param legalDongCode     법정동 코드. <b>집중률·연관·중심</b>이 쓴다
 * @param tourLegalDongCode 국문 관광정보(TourAPI)가 받는 법정동 코드.
 *                          대개 위와 같고, 광주·전남만 다르다
 * @param name              화면에 보여줄 지역명 (예: "제주시 애월읍")
 */
public record Region(String legalDongCode, String tourLegalDongCode, String name) {

	public Region {
		legalDongCode = Texts.requireNotBlank(legalDongCode, "법정동 코드");
		tourLegalDongCode = Texts.requireNotBlank(tourLegalDongCode, "관광정보 법정동 코드");
		name = Texts.requireNotBlank(name, "지역명");
	}

	/**
	 * 두 API가 같은 코드를 쓰는 지역. <b>대부분이 여기 해당한다.</b>
	 *
	 * <p>같은 값을 두 번 적게 하면 지역을 늘릴 때 한쪽만 고쳐진다.
	 */
	public Region(String legalDongCode, String name) {
		this(legalDongCode, legalDongCode, name);
	}
}
