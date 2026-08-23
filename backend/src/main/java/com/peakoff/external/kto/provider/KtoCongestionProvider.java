package com.peakoff.external.kto.provider;

import java.time.LocalDate;
import java.util.Optional;
import java.util.OptionalDouble;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.external.kto.client.KtoCongestionClient;
import com.peakoff.external.kto.client.RegionForecast;
import com.peakoff.external.kto.support.PlaceNameMatcher;
import com.peakoff.global.support.Scores;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceProvider;
import com.peakoff.place.domain.Region;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 공사 집중률 예측으로 한적도를 공급한다. 목업 공급자를 대신한다.
 *
 * <h3>어떻게 켜는가</h3>
 * {@code peakoff.kto.congestion=real}이면 이 빈이, 아니면 목업이 등록된다.
 * 프로파일이 아니라 <b>항목별 스위치</b>인 이유: 지금은 집중률만 실연동됐고 장소·대안은
 * 아직 목업이다. 프로파일 하나로 전부 갈아끼우면 아직 준비되지 않은 것까지 함께 넘어가
 * 서버가 뜨지 않는다. 도메인마다 따로 넘길 수 있어야 한 걸음씩 옮길 수 있다.
 *
 * <h3>집중률을 한적도로 뒤집는다</h3>
 * 공사 값은 <b>높을수록 붐빈다</b>. 우리 한적도는 반대라 뒤집어야 한다.
 * <b>지금 식은 임시값이다</b> — 실제 분포를 보고 분석 담당이 확정한다.
 */
@Component
@ConditionalOnProperty(name = "peakoff.kto.congestion", havingValue = "real")
@RequiredArgsConstructor
public class KtoCongestionProvider implements CongestionProvider {

	private final KtoCongestionClient client;
	private final PlaceProvider placeProvider;
	private final PlaceNameMatcher nameMatcher;

	@Override
	public int quietnessOf(String placeId, LocalDate date) {
			Region region = region();
			RegionForecast forecast = client.forecastOf(region);
		String apiName = apiNameOf(placeId, region, forecast)
				.orElseThrow(() -> new IllegalArgumentException(
						"예측 대상이 아닌 장소입니다. placeId=" + placeId));

		OptionalDouble rate = forecast.rateOf(apiName, date); //이름, 날짜 집중률
		if (rate.isEmpty()) {
			/*
			 * 장소는 목록에 있는데 그 날짜만 없다 — 예측 범위 밖이다.
			 * "정보가 없는 장소"와 구분해서 말해야 화면이 다른 문구를 고를 수 있다.
			 * 하나는 기다리면 생기고 하나는 생기지 않는다.
			 */
			throw new IllegalArgumentException("예측 범위 밖의 날짜입니다. date=%s, 예측 가능 마지막 날=%s"
					.formatted(date, forecast.lastForecastDate().map(LocalDate::toString).orElse("없음")));
		}
		return toQuietness(rate.getAsDouble());
	}

	@Override
	public boolean hasData(String placeId) {
		Region region = region();
		return apiNameOf(placeId, region, client.forecastOf(region)).isPresent();
	}

	@Override
	public boolean hasData(String placeId, LocalDate date) {
		Region region = region();
		RegionForecast forecast = client.forecastOf(region);
		return apiNameOf(placeId, region, forecast)
				.map(apiName -> forecast.rateOf(apiName, date).isPresent())
				.orElse(false);
	}

	/**
	 * 예측이 닿는 마지막 날. 이 날 뒤의 여행은 진단할 수 없다.
	 *
	 * <p>화면이 "언제부터 진단할 수 있는지" 안내하려면 이 값이 필요하다.
	 * 상수가 아니라 응답에서 나온 값이라, 공사가 창을 늘리면 저절로 따라간다.
	 */
	public Optional<LocalDate> lastForecastDate() {
		return client.forecastOf(region()).lastForecastDate();
	}

	// 우리 장소 id -> 이름 -> 공사이름 으로 매칭
	private Optional<String> apiNameOf(String placeId, Region region, RegionForecast forecast) {
		return placeProvider.findById(placeId)
				.map(Place::name)
				.flatMap(name -> nameMatcher.match(name, region, forecast.placeNames()));
	}

	/**
	 * v1은 파일럿 한 지역이라 경주로 고정한다.
	 *
	 * <p>{@code Place}에 지역이 들어 있지 않아 장소 ID만으로는 지역을 알 수 없다.
	 * 지역을 늘릴 때 손댈 자리를 남기려고 메서드로 빼 뒀다 — 그때는 장소가 지역을
	 * 들고 다니게 하거나, 호출하는 쪽에서 지역을 넘겨야 한다.
	 */
	private static Region region() {
		return SupportedRegion.GYEONGJU.toRegion();
	}

	/**
	 * 집중률(높을수록 붐빔) → 한적도(높을수록 한적).
	 *
	 * <p><b>분석 검증 전 임시식이다.</b> 실측 관측 범위가 33~69라 단순히 뒤집으면
	 * 한적도가 31~67에 모인다. 3단계 배지의 경계와 잘 맞는지, 아니면 관측 분포에 맞춰
	 * 늘려야 하는지는 실제 데이터로 확정한다.
	 */
	//집중률 뒤집기
	private static int toQuietness(double concentrationRate) {
		double quietness = Scores.MAX - concentrationRate;
		return (int) Math.round(Math.clamp(quietness, Scores.MIN, Scores.MAX));
	}
}
