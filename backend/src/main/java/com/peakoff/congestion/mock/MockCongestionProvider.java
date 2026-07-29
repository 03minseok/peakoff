package com.peakoff.congestion.mock;

import java.time.DayOfWeek;
import java.time.LocalDate;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.global.support.Scores;
import com.peakoff.place.mock.GyeongjuMockCatalog;

/**
 * 목업 한적도 공급자.
 *
 * <p>장소별 기준값에 요일 보정만 얹은 단순한 규칙이다. 요일 보정을 넣은 이유는
 * "더 한적한 날짜 안내" 기능을 실제 예측 데이터 없이도 화면에서 확인하기 위해서다.
 *
 * <p><b>보정폭은 근거 있는 수치가 아니라 화면 확인용 임시값이다.</b>
 * 실제 집중률 예측 데이터가 붙으면 이 클래스는 통째로 교체된다.
 */
@Component
@Profile(DataSourceProfiles.MOCK)
public class MockCongestionProvider implements CongestionProvider {

	private static final int WEEKEND_PENALTY = -15;
	private static final int FRIDAY_PENALTY = -5;
	private static final int WEEKDAY_BONUS = 5;

	@Override
	public int quietnessOf(String placeId, LocalDate date) {
		GyeongjuMockCatalog.Entry entry = GyeongjuMockCatalog.findById(placeId);
		if (entry == null) {
			throw new IllegalArgumentException("예측 데이터가 없는 장소입니다. placeId=" + placeId);
		}
		int adjusted = entry.baseQuietness() + adjustmentFor(date.getDayOfWeek());
		return Math.clamp(adjusted, Scores.MIN, Scores.MAX);
	}

	@Override
	public boolean hasData(String placeId) {
		return GyeongjuMockCatalog.findById(placeId) != null;
	}

	private static int adjustmentFor(DayOfWeek dayOfWeek) {
		return switch (dayOfWeek) {
			case SATURDAY, SUNDAY -> WEEKEND_PENALTY;
			case FRIDAY -> FRIDAY_PENALTY;
			default -> WEEKDAY_BONUS;
		};
	}
}
