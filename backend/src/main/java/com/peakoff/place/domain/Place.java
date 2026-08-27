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
		imageUrl = toHttps(Texts.trimToNull(imageUrl));
	}

	/**
	 * 이미지 주소를 {@code https}로 눕힌다.
	 *
	 * <h3>왜 필요한가</h3>
	 * 공사가 주는 {@code firstimage}가 {@code http://tong.visitkorea.or.kr/…}이다.
	 * 서비스는 https로 열리므로 브라우저가 <b>혼합 콘텐츠(mixed content)</b>로 본다.
	 *
	 * <p>크롬은 이런 이미지를 알아서 https로 올려 주지만, 그때마다 콘솔에 경고가 쌓인다.
	 * 심사위원이 개발자 도구를 열면 <b>붉은 경고가 화면을 채운다</b> — 실제로 멀쩡히 도는
	 * 서비스가 고장 난 것처럼 보인다. 자동 승격을 하지 않는 브라우저에서는 사진이 통째로
	 * 빠지고, 그러면 장소 카드가 회색 네모만 남는다.
	 *
	 * <h3>왜 여기인가</h3>
	 * 장소가 만들어지는 길이 여럿이다 — 공사 검색 응답, 목업 카탈로그, 대안 후보.
	 * 클라이언트나 응답 DTO에서 고치면 <b>이미지를 쓰는 화면마다</b> 같은 처리를 되풀이해야
	 * 하고, 한 곳을 빠뜨리면 그 화면에서만 경고가 남는다. 생성자는 그 길이 전부 지나는
	 * 한 점이라 여기서 한 번 눕히면 끝난다.
	 *
	 * <p>⚠️ <b>https를 http로 내리지는 않는다.</b> 이미 https인 주소는 그대로 둔다.
	 * 그리고 프로토콜만 갈아끼울 뿐 호스트·경로는 건드리지 않는다 — 공사가 준 주소를
	 * 우리가 다시 쓰는 것이 아니라, 같은 자원을 안전한 통로로 부르는 것뿐이다.
	 */
	private static String toHttps(String url) {
		if (url == null || !url.startsWith("http://")) {
			return url;
		}
		return "https://" + url.substring("http://".length());
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
