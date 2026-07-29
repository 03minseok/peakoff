package com.peakoff.place.domain;

import java.util.Objects;

import com.peakoff.global.support.Texts;

/**
 * 관광지 한 곳. 화면을 그리는 데 필요한 최소 정보만 담는다.
 *
 * <p>이 데이터는 매 요청마다 외부 공공데이터 API에서 받아 조립하며 DB에 적재하지 않는다.
 * 그래서 {@code id}는 우리가 발급한 식별자가 아니라 외부 데이터의 콘텐츠 ID다.
 * 숫자로 보이더라도 형식이 바뀔 수 있어 {@code String}으로 받는다.
 *
 * @param id        외부 데이터 콘텐츠 ID
 * @param name      관광지명
 * @param latitude  위도
 * @param longitude 경도
 * @param category  신분류 코드 기반 분류
 * @param imageUrl  대표 이미지 URL. <b>없을 수 있다</b> (이미지가 비어 있는 관광지가 많다)
 */
public record Place(
		String id,
		String name,
		double latitude,
		double longitude,
		PlaceCategory category,
		String imageUrl) {

	public Place {
		id = Texts.requireNotBlank(id, "관광지 ID");
		name = Texts.requireNotBlank(name, "관광지명");
		validateCoordinate(latitude, -90, 90, "위도");
		validateCoordinate(longitude, -180, 180, "경도");
		Objects.requireNonNull(category, "분류는 필수입니다.");
		// 이미지가 없는 관광지는 정상이므로 null을 허용하되, 공백 문자열은 없는 것으로 통일한다.
		imageUrl = Texts.trimToNull(imageUrl);
	}

	/**
	 * 좌표 누락을 걸러내기 위한 최소 검증.
	 *
	 * <p>지도에 찍어야 하는 값이라 0.0 같은 기본값이 조용히 흘러들면 엉뚱한 위치에 표시된다.
	 * 한국 영역으로 좁히지 않은 이유는, 원본 좌표 정밀도를 우리가 임의로 재단하지 않기 위해서다.
	 */
	private static void validateCoordinate(double value, double min, double max, String fieldName) {
		if (Double.isNaN(value) || value < min || value > max) {
			throw new IllegalArgumentException(
					"%s는 %s~%s 범위여야 합니다. 입력값: %s".formatted(fieldName, min, max, value));
		}
	}

	public boolean hasImage() {
		return imageUrl != null;
	}
}
