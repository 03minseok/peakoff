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
import com.peakoff.place.domain.Distances;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
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

	/**
	 * 이름이 닮은 두 곳을 같은 장소로 볼 수 있는 최대 직선거리.
	 *
	 * <p>실측 분포가 이 값을 정했다(5개 지역, 2026-08-25). 이름으로 이어진 짝들의 실제 거리를
	 * 재 보면 <b>3.6km와 5.1km 사이가 비어 있다</b> — 아래쪽은 "경주 남산 칠불암 → 경주 남산"
	 * 처럼 한 권역 안의 짝이고, 위쪽은 "월성원자력홍보관 → 경주 월성"처럼 남남이다.
	 *
	 * <p>2km는 그 빈 구간보다 더 좁게 잡은 값이다. 남산 자락 유적 다섯 곳(2.2~3.4km)과
	 * 우도·차귀도 안의 짝들이 함께 끊기지만, <b>애매하면 잇지 않는다</b>는 원칙을 따랐다 —
	 * 남산 입구의 혼잡도를 산 반대편 칠불암의 것이라고 말할 근거가 없다.
	 * 끊긴 자리는 "예상 혼잡 정보가 없는 장소"로 정직하게 표시된다.
	 */
	private static final double MAX_LINK_DISTANCE_KM = 2.0;

	/**
	 * 이름으로 장소를 되찾을 때 훑을 검색 결과 수.
	 *
	 * <p>검색은 부분 일치라 "한라산"으로 물으면 둘레길·국립공원까지 딸려 온다. 그중에서
	 * 이름이 정확히 같은 하나를 고르므로, 넉넉히 받아 두고 걸러야 진짜가 뒤에 밀려 잘리지 않는다.
	 */
	private static final int NAME_LOOKUP_LIMIT = 50;

	private final KtoCongestionClient client;
	private final PlaceProvider placeProvider;
	private final PlaceNameMatcher nameMatcher;

	/**
	 * 장소가 어느 지역의 예측 목록에 들어 있는지 찾아 낸 결과.
	 *
	 * <p>{@code Place}에 지역이 들어 있지 않아 <b>장소 ID만으로는 어느 지역인지 알 수 없다.</b>
	 * 그래서 지원 지역을 하나씩 훑어 이름이 이어지는 곳을 찾는다. 지역별 예측은 6시간 캐시라
	 * 대개 메모리에 있고, 못 찾으면 그 장소는 어느 지역에서도 예측 대상이 아니다.
	 */
	private record Located(RegionForecast forecast, String apiName) {
	}

	private Optional<Located> locate(String placeId) {
		for (Region region : SupportedRegion.allRegions()) {
			RegionForecast forecast = client.forecastOf(region);
			Optional<String> apiName = apiNameOf(placeId, region, forecast);
			if (apiName.isPresent()) {
				return Optional.of(new Located(forecast, apiName.get()));
			}
		}
		return Optional.empty();
	}

	@Override
	public int quietnessOf(String placeId, LocalDate date) {
		Located located = locate(placeId)
				.orElseThrow(() -> new IllegalArgumentException(
						"예측 대상이 아닌 장소입니다. placeId=" + placeId));

		OptionalDouble rate = located.forecast().rateOf(located.apiName(), date);
		if (rate.isEmpty()) {
			/*
			 * 장소는 목록에 있는데 그 날짜만 없다 — 예측 범위 밖이다.
			 * "정보가 없는 장소"와 구분해서 말해야 화면이 다른 문구를 고를 수 있다.
			 * 하나는 기다리면 생기고 하나는 생기지 않는다.
			 */
			throw new IllegalArgumentException("예측 범위 밖의 날짜입니다. date=%s, 예측 가능 마지막 날=%s"
					.formatted(date, located.forecast().lastForecastDate()
							.map(LocalDate::toString).orElse("없음")));
		}
		return toQuietness(rate.getAsDouble());
	}

	@Override
	public boolean hasData(String placeId) {
		return locate(placeId).isPresent();
	}

	@Override
	public boolean hasData(String placeId, LocalDate date) {
		return locate(placeId)
				.map(located -> located.forecast().rateOf(located.apiName(), date).isPresent())
				.orElse(false);
	}

	/**
	 * 예측이 닿는 마지막 날. 이 날 뒤의 여행은 진단할 수 없다.
	 *
	 * <p>화면이 "언제부터 진단할 수 있는지" 안내하려면 이 값이 필요하다.
	 * 상수가 아니라 응답에서 나온 값이라, 공사가 창을 늘리면 저절로 따라간다.
	 *
	 * <p>지역이 여럿이면 <b>가장 이른 날</b>을 쓴다. 지역마다 창이 다를 때 가장 늦은 날을
	 * 약속하면, 창이 짧은 지역을 고른 사용자가 진단되지 않는 날짜를 고르게 된다.
	 */
	public Optional<LocalDate> lastForecastDate() {
		return SupportedRegion.allRegions().stream()
				.map(region -> client.forecastOf(region).lastForecastDate())
				.flatMap(Optional::stream)
				.min(LocalDate::compareTo);
	}

	/**
	 * 우리 장소 id → 이름 → 공사 이름으로 잇는다. 못 이으면 비어 있다.
	 *
	 * <h3>이름을 대보기 전에 분류부터 보는 이유</h3>
	 * 이름 매칭은 <b>양쪽 어느 쪽이 길든 품으면 잇는다.</b> 대릉원(우리) ↔ 대릉원 일원(공사)을
	 * 살리려고 그렇게 열었는데, 같은 규칙이 이런 것도 이어 버렸다:
	 *
	 * <pre>
	 * "불국사밀면"        → "불국사"     밀면집이 절의 혼잡도를 받는다
	 * "여미온 황리단길점"  → "황리단길"   식당이 거리의 혼잡도를 받는다
	 * </pre>
	 *
	 * <p>실제로 음식점·숙박 11곳을 담아 보니 <b>7곳이 남의 점수를 받았다.</b> 화면에 틀린
	 * 배지가 서는 것으로 끝나지 않고 코스 총점까지 오염된다 — 계산하지 않은 것을 근거로
	 * 말하지 않는다는 규칙이 정확히 이 자리를 막는다.
	 *
	 * <p>분류로 먼저 거르면 이 부류가 통째로 사라진다. 공사 집중률은 관광지만 예측하므로
	 * 음식점·숙박은 <b>이름이 아무리 닮아도 이을 곳이 없는 것이 맞다.</b> 쇼핑·체험·레저·축제
	 * 14곳을 실제로 진단해 봐도 지금 이어지는 곳이 하나도 없어, 걸러서 잃는 것은 없다.
	 *
	 * <p>이 자리에 둔 이유는 {@code quietnessOf}와 {@code hasData} 둘이 전부 여기를
	 * 지나기 때문이다. 한 군데만 막으면 점수·배지·총점이 함께 정리된다.
	 */
	private Optional<String> apiNameOf(String placeId, Region region, RegionForecast forecast) {
		return placeProvider.findById(placeId)
				.filter(place -> PlaceCategories.isForecastTarget(place.category()))
				.flatMap(place -> nameMatcher.match(place.name(), region, forecast.placeNames(),
						forecastName -> couldBeSamePlace(place, forecastName, region)));
	}

	/**
	 * 이름이 닮은 두 곳이 <b>같은 장소일 수 있는가</b>를 좌표로 가른다.
	 *
	 * <h3>왜 이름만으로는 안 되는가</h3>
	 * 이름 매칭은 한쪽이 다른 쪽을 품으면 잇는다. 그 규칙이 "대릉원 ↔ 경주 대릉원 일원"을
	 * 살리는 동시에 이런 것도 이어 버린다 (5개 지역 실측, 2026-08-25):
	 *
	 * <pre>
	 * "월성원자력홍보관"  → 집중률 "경주 월성(반월성)"   26.4km 떨어져 있다
	 * "경주 나정"         → 집중률 "나정고운모래해변"    25.4km
	 * "플래시백 계림"     → 집중률 "경주 계림"            6.6km
	 * </pre>
	 *
	 * <p>글자로는 못 가른다. "나정"과 "나정고운모래해변"은 부모·자식처럼 보이고,
	 * 길이 비율로 자르면 "경주 남산 칠불암 → 경주 남산"처럼 살려야 할 짝까지 끊긴다.
	 * 좌표는 그 둘을 정확히 가른다.
	 *
	 * <h3>어떻게 좌표를 얻는가</h3>
	 * 집중률 응답에는 좌표가 없다. 대신 <b>그 이름이 우리 카탈로그에도 있으면</b> 거기에 좌표가
	 * 있다 — 실측 포함 매칭 126건 중 80건이 이 방법으로 검증됐다.
	 * 못 찾으면 <b>통과시킨다.</b> 검증하지 못한 것을 끊으면 규칙이 아니라 자료 유무로
	 * 장소가 사라진다.
	 *
	 * <p>자기 자신을 찾은 경우도 통과다. 우리 장소의 이름이 곧 집중률 이름이라는 뜻이라
	 * 견줄 상대가 없다.
	 */
	private boolean couldBeSamePlace(Place origin, String forecastName, Region region) {
		return placeNamed(forecastName, region)
				.filter(anchor -> !anchor.id().equals(origin.id()))
				.map(anchor -> Distances.betweenKm(origin, anchor) <= MAX_LINK_DISTANCE_KM)
				.orElse(true);
	}

	/**
	 * 공사가 부르는 그 이름의 장소를 우리 카탈로그에서 찾는다. 없으면 빈 값.
	 *
	 * <p><b>포함이 아니라 정규화 완전 일치다.</b> 검색은 후보를 불러오는 수단일 뿐이고,
	 * 판정은 {@link PlaceNameMatcher#normalized}가 한다 — 여기서 포함 매칭을 또 쓰면
	 * 지금 막으려는 그 문제를 검증 단계에서 되풀이하게 된다.
	 *
	 * <p>{@code PlaceProvider}를 거치는 이유: 카탈로그 클라이언트를 직접 부르면
	 * 장소가 목업인 설정에서 이 검증만 실데이터를 보게 된다.
	 */
	private Optional<Place> placeNamed(String forecastName, Region region) {
		String target = nameMatcher.normalized(forecastName, region);
		if (target.isEmpty()) {
			return Optional.empty();
		}
		return placeProvider
				.search(region, PlaceNameMatcher.searchKeyword(forecastName), NAME_LOOKUP_LIMIT).stream()
				.filter(place -> nameMatcher.normalized(place.name(), region).equals(target))
				.findFirst();
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
