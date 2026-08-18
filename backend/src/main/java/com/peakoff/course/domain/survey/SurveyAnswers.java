package com.peakoff.course.domain.survey;

import java.util.List;
import java.util.Objects;

/**
 * 설문 4문항의 답 묶음.
 *
 * <p>네 값을 따로 넘기면 서비스 메서드의 인자가 길어지고, 나중에 문항이 하나 늘 때
 * 시그니처가 줄줄이 바뀐다. 한 덩어리로 묶어 두면 문항 추가가 이 파일 안에서 끝난다.
 *
 * <p>요청 DTO와 따로 두는 이유: DTO는 <b>바깥과의 계약</b>이라 JSON 모양에 묶이고,
 * 이쪽은 <b>안에서 쓰는 값</b>이다. 둘을 합치면 화면 사정으로 필드를 하나 바꿀 때
 * 코스 생성 로직까지 흔들린다.
 *
 * @param styles      여행 스타일 (복수 선택, 하나 이상)
 * @param density     일정 밀도
 * @param sensitivity 혼잡 민감도
 * @param transport   이동수단
 */
public record SurveyAnswers(
		List<TravelStyle> styles,
		ItineraryDensity density,
		CrowdSensitivity sensitivity,
		Transport transport) {

	public SurveyAnswers {
		Objects.requireNonNull(styles, "여행 스타일은 필수입니다.");
		if (styles.isEmpty()) {
			throw new IllegalArgumentException("여행 스타일을 하나 이상 골라야 합니다.");
		}
		// 방어적 복사 겸 중복 제거. 같은 스타일을 두 번 보내도 후보 필터 결과는 같아야 한다.
		styles = styles.stream().distinct().toList();
		Objects.requireNonNull(density, "일정 밀도는 필수입니다.");
		Objects.requireNonNull(sensitivity, "혼잡 민감도는 필수입니다.");
		Objects.requireNonNull(transport, "이동수단은 필수입니다.");
	}
}
