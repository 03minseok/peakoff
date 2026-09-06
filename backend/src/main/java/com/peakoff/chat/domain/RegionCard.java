package com.peakoff.chat.domain;

import java.util.Objects;

import com.peakoff.place.domain.SupportedRegion;

/**
 * 화면에 서는 카드 한 장.
 *
 * <h3>숫자와 문장의 역할이 다르다</h3>
 * <ul>
 *   <li>{@code quietShare} — <b>견주라고</b> 있는 값. 카드 셋을 나란히 놓았을 때
 *       22%와 65%의 차이가 이 서비스가 하려는 말이다</li>
 *   <li>{@code line} — <b>왜 이 지역인지</b>. 관심사가 있으면 그 몫을, 없으면 한적한 정도를 말한다</li>
 * </ul>
 *
 * <p>⚠️ {@code quietShare}는 한적도가 아니라 <b>비율</b>이다. 3단계 배지를 걸지 말 것 —
 * 65/35 경계는 한적도의 경계라 이 값에는 뜻이 없다. 이유는 {@link RegionProfile}에 적어 두었다.
 *
 * @param region       어느 지역
 * @param quietShare   이번 주 예측 중 한적한 관측의 비율 (0~100)
 * @param forecastSize 그 비율의 모수가 된 관광지 수
 * @param line         카드에 적을 한 줄
 * @param lineSource   그 줄을 누가 썼는지. 화면에는 안 나가고 우리가 본다
 */
public record RegionCard(
		SupportedRegion region,
		int quietShare,
		int forecastSize,
		String line,
		CardLineSource lineSource) {

	public RegionCard {
		Objects.requireNonNull(region, "지역은 필수입니다.");
		Objects.requireNonNull(line, "카드 문장은 필수입니다.");
		Objects.requireNonNull(lineSource, "문장 출처는 필수입니다.");
	}
}
