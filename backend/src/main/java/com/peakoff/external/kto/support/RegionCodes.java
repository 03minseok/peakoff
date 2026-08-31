package com.peakoff.external.kto.support;

import com.peakoff.place.domain.Region;

/**
 * 법정동 코드를 공사 API가 받는 조각으로 자른다.
 *
 * <p>지역 정의는 {@code SupportedRegion} 한 곳에만 두기로 했으므로, 여기서 코드를 다시
 * 적지 않고 잘라 쓴다. 두 벌로 적으면 지역을 늘릴 때 한쪽만 고쳐진다.
 *
 * <h3>API마다 부르는 이름이 다르다</h3>
 * 같은 값인데 파라미터 이름이 갈린다 — 집중률·연관·중심은 {@code areaCd}/{@code signguCd},
 * 국문 관광정보는 {@code lDongRegnCd}/{@code lDongSignguCd}다. 게다가 국문 관광정보의
 * 시군구는 <b>앞 두 자리를 뗀 세 자리</b>다(47130 → 130). 이 차이를 클라이언트마다
 * 기억하게 두면 언젠가 하나가 틀린다.
 *
 * <p>구 지역코드({@code areaCode}/{@code sigunguCode})는 26년 폐기 예정이라 쓰지 않는다.
 */
public final class RegionCodes {

	private RegionCodes() {
	}

	/** 시도 코드. 법정동 코드 앞 2자리. (4713000000 → 47 경상북도) — 집중률·연관·중심용 */
	public static String areaCodeOf(Region region) {
		return checked(region.legalDongCode()).substring(0, 2);
	}

	/** 시군구 코드. 앞 5자리. (4713000000 → 47130 경주시) — 집중률·연관·중심용 */
	public static String sigunguCodeOf(Region region) {
		return checked(region.legalDongCode()).substring(0, 5);
	}

	/**
	 * 국문 관광정보가 받는 시도 코드.
	 *
	 * <p>⚠️ <b>{@link #areaCodeOf}와 다를 수 있다.</b> 광주·전남이 통합되면서 코드가
	 * {@code 46} → {@code 12}로 바뀌었는데 국문 관광정보만 옮겨갔다.
	 * 자세한 것은 {@link Region} 주석에 적어 두었다.
	 */
	public static String lDongRegnCodeOf(Region region) {
		return checked(region.tourLegalDongCode()).substring(0, 2);
	}

	/**
	 * 국문 관광정보가 받는 시군구 코드. <b>시도 두 자리를 뗀 세 자리다.</b> (47130 → 130)
	 *
	 * <p>같은 지역을 가리키는데 자릿수가 다르다. 5자리를 그대로 넣으면 결과가 0건으로 오고,
	 * 오류가 아니라 빈 응답이라 <b>"경주에 관광지가 없다"로 잘못 읽힌다.</b>
	 */
	public static String lDongSignguCodeOf(Region region) {
		return checked(region.tourLegalDongCode()).substring(2, 5);
	}

	private static String checked(String code) {
		if (code == null || code.length() < 5) {
			throw new KtoApiException("법정동 코드가 5자리 이상이어야 시군구를 가릅니다. 입력값: " + code);
		}
		return code;
	}
}
