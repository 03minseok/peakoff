package com.peakoff.congestion.domain;

import java.time.LocalDate;

import com.peakoff.global.support.Texts;

/**
 * 코스에 배치된 방문 하나. <b>"어느 장소를 며칠차에 가는가"</b>이다.
 *
 * <h3>왜 장소 목록이 아니라 방문 단위인가</h3>
 * 날짜 대안은 "시작일을 옮기면 코스가 얼마나 한적해지는가"를 답한다. 그런데 2일차 장소는
 * 시작일이 아니라 <b>그 다음 날</b>에 간다. 장소만 평평하게 넘기면 모든 곳을 시작일 하루로
 * 계산하게 되어, 여러 날 일정에서는 틀린 답이 나온다.
 *
 * <p>진단({@code CourseDiagnosisService})은 이미 이렇게 계산하고 있었다.
 * 날짜 대안만 장소를 평평하게 받고 있어서 두 화면의 숫자가 어긋났다.
 *
 * <h3>같은 곳을 두 번 가면 두 번 센다</h3>
 * 목록에서 중복을 제거하지 않는다. 이틀 연속 들르는 장소는 <b>각 날짜의 자료로 각각</b>
 * 계산되어야 평균이 실제 일정을 반영한다. 중복을 합치면 그 장소가 한 번만 반영돼
 * 코스 평균이 실제보다 한쪽으로 기운다.
 *
 * @param day     일차. 1부터 시작한다
 * @param placeId 장소 ID
 */
public record PlannedVisit(int day, String placeId) {

	/**
	 * 질의 문자열에서 일차와 장소를 가르는 문자.
	 *
	 * <p><b>첫 번째 것에서만 자른다.</b> 장소 ID에 콜론이 들어와도(공공데이터 식별자 체계가
	 * 바뀔 수 있다) 뒤쪽은 그대로 ID로 남는다.
	 */
	private static final char SEPARATOR = ':';

	public PlannedVisit {
		if (day < 1) {
			throw new IllegalArgumentException("일차는 1 이상이어야 합니다. 입력값: " + day);
		}
		placeId = Texts.requireNotBlank(placeId, "장소 ID");
	}

	/**
	 * {@code "2:mock-seokguram"} 같은 질의값을 읽는다.
	 *
	 * <p>질의 파라미터를 두 벌(일차 배열 + 장소 배열)로 나누지 않은 이유: 두 목록의 길이나
	 * 순서가 어긋나면 <b>조용히 엉뚱한 날짜로 계산된다.</b> 한 문자열에 묶어 두면
	 * 짝이 깨질 수가 없다.
	 */
	public static PlannedVisit parse(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new IllegalArgumentException("방문 항목이 비어 있습니다. \"일차:장소ID\" 형식이어야 합니다.");
		}
		String text = raw.trim();
		int separator = text.indexOf(SEPARATOR);
		if (separator <= 0) {
			throw new IllegalArgumentException(
					"방문 항목은 \"일차:장소ID\" 형식이어야 합니다. 입력값: " + raw);
		}

		String dayPart = text.substring(0, separator).trim();
		String placePart = text.substring(separator + 1).trim();
		try {
			return new PlannedVisit(Integer.parseInt(dayPart), placePart);
		}
		catch (NumberFormatException e) {
			throw new IllegalArgumentException("일차가 숫자가 아닙니다. 입력값: " + raw, e);
		}
	}

	/**
	 * 시작일이 {@code startDate}일 때 이 방문의 실제 날짜.
	 *
	 * <p>후보 시작일마다 다시 부른다 — 그래서 "9월 14일로 옮기면 2일차는 9월 15일"이
	 * 저절로 따라온다.
	 */
	public LocalDate dateFrom(LocalDate startDate) {
		return startDate.plusDays(day - 1L);
	}
}
