package com.peakoff.congestion.mock;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.domain.QuietCandidate;
import com.peakoff.congestion.domain.QuietSpot;
import com.peakoff.congestion.domain.QuietSpotProvider;
import com.peakoff.global.config.DataSourceProfiles;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.domain.Region;
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
public class MockCongestionProvider implements CongestionProvider, QuietSpotProvider {

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

	/**
	 * <b>목업에는 마지막 날이 없다.</b> 요일 보정만 하므로 어느 날을 물어도 값이 나온다.
	 *
	 * <p>비어 있는 값을 돌려주면 화면이 "예측 창" 안내를 아예 그리지 않는다.
	 * 목업으로 볼 때 있지도 않은 제약을 설명하는 것보다 그편이 정직하다 —
	 * 실데이터로 바꾸는 순간 안내가 저절로 나타난다.
	 */
	@Override
	public Optional<LocalDate> lastForecastDate() {
		return Optional.empty();
	}

	/**
	 * 목업 카탈로그에서 기간 안 한적한 곳들 — <b>이름 상태의 후보</b>까지만.
	 *
	 * <p>⚠️ <b>경주가 아니면 빈 목록이다.</b> 목업 카탈로그가 경주 한 곳뿐이라
	 * 다른 지역을 물으면 지어낼 것이 없다. 없는 지역에 가짜 장소를 만들어 주면
	 * 실데이터로 넘어갈 때 "목업에서는 되던 것"이 사라져 고장으로 읽힌다.
	 *
	 * <p>부르는 쪽이 지역을 여럿 도는 자리라, 빈 목록은 정상적인 답이다.
	 *
	 * <p>후보의 이름은 <b>장소 이름 그대로</b>다. 실연동은 공사가 부르는 이름 원문을 담고
	 * {@link #resolve}에서 우리 장소로 잇는데, 목업에는 이을 것이 애초에 하나뿐이라
	 * 그 단계가 이름 조회로 줄어든다. <b>단계를 없애지는 않는다</b> —
	 * 부르는 쪽이 두 구현에서 같은 순서로 돌아야 목업에서 본 화면을 믿을 수 있다.
	 */
	@Override
	public List<QuietCandidate> quietCandidatesWithin(
			Region region, LocalDate from, int days, double topShare, int minCandidates) {
		if (days < 1 || topShare <= 0 || !GyeongjuMockCatalog.GYEONGJU.equals(region)) {
			return List.of();
		}

		List<QuietCandidate> ranked = new ArrayList<>();
		for (GyeongjuMockCatalog.Entry entry : GyeongjuMockCatalog.entries()) {
			/*
			 * 실연동의 예측 목록에는 애초에 관광지와 시장만 들어 있다. 목업 카탈로그는
			 * 밥집·카페·숙소까지 한 곳에 담고 있으므로, 여기서 예측 대상 분류만 남겨
			 * <b>순위의 모수를 실연동과 같은 성격으로</b> 맞춘다. 코스에 담을 분류인지는
			 * resolve가 다시 본다(시장이 그 사이에서 걸린다).
			 */
			if (!PlaceCategories.isForecastTarget(entry.place().category())) {
				continue;
			}
			LocalDate bestDate = from;
			int best = Integer.MIN_VALUE;
			for (int offset = 0; offset < days; offset++) {
				LocalDate date = from.plusDays(offset);
				int quietness = quietnessOf(entry.place().id(), date);
				if (quietness > best) {
					best = quietness;
					bestDate = date;
				}
			}
			ranked.add(new QuietCandidate(entry.place().name(), bestDate, best));
		}
		ranked.sort(Comparator.comparingInt(QuietCandidate::quietness).reversed());

		int cut = Math.min(
				ranked.size(),
				Math.max(minCandidates, (int) Math.ceil(ranked.size() * topShare)));
		return List.copyOf(ranked.subList(0, cut));
	}

	/** 목업에서는 이름이 곧 장소다. 분류 게이트는 실연동과 같은 자리에 둔다. */
	@Override
	public Optional<QuietSpot> resolve(Region region, QuietCandidate candidate) {
		if (!GyeongjuMockCatalog.GYEONGJU.equals(region)) {
			return Optional.empty();
		}
		return GyeongjuMockCatalog.entries().stream()
				.map(GyeongjuMockCatalog.Entry::place)
				.filter(place -> place.name().equals(candidate.forecastName()))
				.filter(place -> PlaceCategories.isCourseCandidate(place.category()))
				.findFirst()
				.map(place -> new QuietSpot(place, candidate.date(), candidate.quietness()));
	}

	private static double factorFor(DayOfWeek dayOfWeek) {
		return switch (dayOfWeek) {
			case SATURDAY, SUNDAY -> WEEKEND_FACTOR;
			case FRIDAY -> FRIDAY_FACTOR;
			default -> WEEKDAY_FACTOR;
		};
	}
}
