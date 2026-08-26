package com.peakoff.congestion.dto;

import java.time.LocalDate;
import java.util.Optional;

/**
 * 예측이 닿는 기간. 화면이 날짜를 고르는 자리에서 <b>미리</b> 안내하는 데 쓴다.
 *
 * <h2>왜 필요한가</h2>
 * 공사 예측은 조회 시점부터 24일쯤이다. 그 밖의 날짜로 코스를 짜도 진단은 <b>막히지 않지만</b>
 * 모든 칸이 "아직 예측이 나오지 않은 날짜예요"로 비어 나온다. 그 사실을 진단 버튼을 누른
 * 뒤에 알게 되면 되돌리기에 늦다 — 코스를 다 짜고 나서다.
 *
 * <h2>⚠️ 막는 값이 아니다</h2>
 * 여행은 원래 미리 계획한다. 두 달 뒤 여행을 짜려는 사람을 날짜 입력에서 튕겨내면
 * 그 사람은 서비스를 쓸 수 없다. 이 값은 <b>고르지 못하게 하는 상한이 아니라
 * 미리 알려주는 안내</b>다.
 *
 * <p>기다리면 생긴다는 것도 함께 말할 수 있다 — {@code DiagnosisGap.DATE_OUT_OF_FORECAST}를
 * "장소가 예측 대상이 아님"과 굳이 갈라 둔 이유가 그것이다.
 *
 * @param firstDate 예측이 시작되는 날. <b>서버 시계 기준 오늘</b>이다. 화면이 자기 시계로
 *                  오늘을 계산하면 자정 무렵이나 다른 시간대에서 하루가 어긋난다
 * @param lastDate  예측이 닿는 마지막 날. <b>자료가 없으면 {@code null}</b>이다 —
 *                  목업으로 돌 때가 그렇고, 그때 화면은 안내를 그리지 않는다
 */
public record ForecastWindowResponse(LocalDate firstDate, LocalDate lastDate) {

	public static ForecastWindowResponse of(LocalDate today, Optional<LocalDate> lastDate) {
		return new ForecastWindowResponse(today, lastDate.orElse(null));
	}
}
