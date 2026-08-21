package com.peakoff.congestion.mock;

import java.time.DayOfWeek;
import java.time.LocalDate;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
 *
 * <p>교체 스위치는 {@code peakoff.kto.congestion}이다. {@code real}이면 이 빈 대신
 * {@code KtoCongestionProvider}가 등록된다. 프로파일이 아니라 항목별 스위치인 이유는
 * 도메인마다 실연동 시점이 달라서다 — 집중률만 먼저 넘어가고 장소·대안은 아직 목업이다.
 * 값을 적지 않으면 목업이 뜬다({@code matchIfMissing}).
 */
@Component
@Profile(DataSourceProfiles.MOCK)
@ConditionalOnProperty(name = "peakoff.kto.congestion", havingValue = "mock", matchIfMissing = true)
public class MockCongestionProvider implements CongestionProvider {

	/**
	 * 요일 보정은 <b>뺄셈이 아니라 곱셈</b>이다.
	 *
	 * <p>뺄셈으로 하면 기준 한적도가 낮은 곳들이 0에서 뭉개진다.
	 * 예를 들어 15점(불국사)과 12점(황리단길)에서 15를 빼면 둘 다 0이 되어,
	 * 화면에서 어디가 더 붐비는지 구분할 수 없게 된다. 곱셈은 순위를 보존한다.
	 */
	private static final double WEEKEND_FACTOR = 0.80;
	private static final double FRIDAY_FACTOR = 0.92;
	private static final double WEEKDAY_FACTOR = 1.08;

	@Override
	public int quietnessOf(String placeId, LocalDate date) {
		GyeongjuMockCatalog.Entry entry = GyeongjuMockCatalog.findById(placeId);
		if (entry == null) {
			throw new IllegalArgumentException("예측 데이터가 없는 장소입니다. placeId=" + placeId);
		}
		double adjusted = entry.baseQuietness() * factorFor(date.getDayOfWeek());
		return (int) Math.round(Math.clamp(adjusted, Scores.MIN, Scores.MAX));
	}

	@Override
	public boolean hasData(String placeId) {
		return GyeongjuMockCatalog.findById(placeId) != null;
	}

	/**
	 * 목업은 요일 보정만 하므로 <b>날짜 제한이 없다.</b> 어느 날을 물어도 값이 나온다.
	 *
	 * <p>실제 공사 예측은 조회 시점부터 24일치뿐이라 이 답이 갈린다.
	 * 목업으로 화면을 볼 때는 날짜 때문에 막히는 일이 없다는 뜻이기도 하다 —
	 * 실데이터로 바꾸면 그 제약이 처음 드러난다.
	 */
	@Override
	public boolean hasData(String placeId, LocalDate date) {
		return hasData(placeId);
	}

	private static double factorFor(DayOfWeek dayOfWeek) {
		return switch (dayOfWeek) {
			case SATURDAY, SUNDAY -> WEEKEND_FACTOR;
			case FRIDAY -> FRIDAY_FACTOR;
			default -> WEEKDAY_FACTOR;
		};
	}
}
