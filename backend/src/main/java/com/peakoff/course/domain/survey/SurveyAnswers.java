package com.peakoff.course.domain.survey;

import java.util.Objects;

/**
 * 설문 3문항의 답 묶음.
 *
 * <p>세 값을 따로 넘기면 서비스 메서드의 인자가 길어지고, 나중에 문항이 하나 늘 때
 * 시그니처가 줄줄이 바뀐다. 한 덩어리로 묶어 두면 문항 추가가 이 파일 안에서 끝난다.
 *
 * <p>요청 DTO와 따로 두는 이유: DTO는 <b>바깥과의 계약</b>이라 JSON 모양에 묶이고,
 * 이쪽은 <b>안에서 쓰는 값</b>이다. 둘을 합치면 화면 사정으로 필드를 하나 바꿀 때
 * 코스 생성 로직까지 흔들린다.
 *
 * <h2>⚠️ "여행 스타일"을 뺐다 (2026-08-27)</h2>
 * 역사·자연·문화 셋 중 고르게 했는데, <b>하나만 고르면 후보가 통째로 쪼그라들었다</b> —
 * 제주시에서 역사만 고르면 3곳, 서귀포는 2곳이다. 네댓 칸을 채워야 하는 코스가
 * 거기서 이미 막힌다.
 *
 * <p>고르게 하는 대신 <b>코스에 어울리지 않는 것만 빼는</b> 쪽으로 뒤집었다
 * ({@code PlaceCategories.isCourseCandidate}). 남은 세 문항은 전부 <b>어떻게 다닐지</b>를
 * 묻는 것이라, 성격이 한 갈래로 모이기도 했다.
 *
 * @param density     일정 밀도
 * @param sensitivity 혼잡 민감도
 * @param transport   이동수단
 */
public record SurveyAnswers(
		ItineraryDensity density,
		CrowdSensitivity sensitivity,
		Transport transport) {

	public SurveyAnswers {
		Objects.requireNonNull(density, "일정 밀도는 필수입니다.");
		Objects.requireNonNull(sensitivity, "혼잡 민감도는 필수입니다.");
		Objects.requireNonNull(transport, "이동수단은 필수입니다.");
	}
}
