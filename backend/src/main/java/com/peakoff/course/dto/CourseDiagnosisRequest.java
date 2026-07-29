package com.peakoff.course.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 진단 요청. 사용자가 직접 짠 코스가 그대로 들어온다.
 *
 * <p>슬롯에 한적도가 없는 것이 핵심이다. <b>첫 코스는 사용자의 의도를 존중한다.</b>
 * 점수는 사용자가 제출하는 값이 아니라 서버가 진단해서 돌려주는 값이다.
 *
 * @param region    지역 슬러그 (예: "gyeongju")
 * @param startDate 여행 시작일 (yyyy-MM-dd)
 * @param nights    박 수. 당일치기는 0
 * @param slots     일자·순서대로 담은 방문지
 */
public record CourseDiagnosisRequest(
		String region,
		LocalDate startDate,
		int nights,
		List<SlotRequest> slots) {

	public record SlotRequest(int day, int order, String placeId) {
	}
}
