package com.peakoff.external.kto.provider;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.function.Predicate;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.domain.QuietSpot;
import com.peakoff.congestion.domain.QuietSpotProvider;
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
public class KtoCongestionProvider implements CongestionProvider, QuietSpotProvider {

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
		/*
		 * 장소는 <b>지역 루프 밖에서 한 번만</b> 찾는다. 장소가 지역마다 달라지지 않는데
		 * 예전에는 루프 안(apiNameOf)에서 findById를 지역 수만큼 불렀다 — 카탈로그에 있으면
		 * 메모리 조회라 낭비로 끝나지만, <b>카탈로그 밖 장소는 상세 조회가 지역 수만큼 나갔다.</b>
		 * 진단 한 칸에 공사 호출이 3배가 되는 자리였다.
		 */
		Optional<Place> found = placeProvider.findById(placeId)
				.filter(place -> PlaceCategories.isForecastTarget(place.category()));
		if (found.isEmpty()) {
			return Optional.empty();
		}
		Place place = found.get();

		for (Region region : SupportedRegion.allRegions()) {
			RegionForecast forecast = client.forecastOf(region);
			Optional<String> apiName = apiNameOf(place, region, forecast);
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
	 * 우리 장소의 이름을 그 지역의 공사 이름으로 잇는다. 못 이으면 비어 있다.
	 *
	 * <p>장소 조회와 분류 게이트는 {@link #locate}가 루프 밖에서 이미 끝냈다 —
	 * 여기는 "이 지역의 예측 목록에 이 이름이 있는가"만 답한다.
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
	 * <p>분류로 먼저 거르면 이 부류가 통째로 사라진다. 공사 집중률은 음식점·숙박을 예측하지
	 * 않으므로 <b>이름이 아무리 닮아도 이을 곳이 없는 것이 맞다.</b>
	 *
	 * <p>쇼핑은 2026-08-26에 열었다 — 공사가 예측하는 쇼핑은 시장뿐이라(동문재래시장·
	 * 서귀포매일올레시장·광장시장) 막아 둘 이유가 없었다. 대신 그 분류는
	 * <b>이름이 정확히 같을 때만</b> 잇는다({@link #plausibilityOf}).
	 *
	 * <p>이 자리에 둔 이유는 {@code quietnessOf}와 {@code hasData} 둘이 전부 여기를
	 * 지나기 때문이다. 한 군데만 막으면 점수·배지·총점이 함께 정리된다.
	 */
	private Optional<String> apiNameOf(Place place, Region region, RegionForecast forecast) {
		return nameMatcher.match(place.name(), region, forecast.placeNames(),
				plausibilityOf(place, region));
	}

	/**
	 * 포함 매칭으로 걸린 후보를 어떻게 거를지. <b>분류마다 다르다.</b>
	 *
	 * <p>쇼핑은 아예 통과시키지 않는다 — 상호에 지명을 붙이는 관습이 있어
	 * "다이소 경복궁역점"이 "경복궁"에 걸린다. <b>좌표로도 못 막는다</b>:
	 * 그 가게는 실제로 경복궁 2km 안에 있다. 이름도 닮고 위치도 가까운데 같은 장소가 아니다.
	 *
	 * <p>완전 일치 단계는 이 거름망을 타지 않으므로, 동문재래시장·광장시장처럼
	 * <b>공사가 그 이름 그대로 예측하는 시장은 그대로 이어진다.</b>
	 *
	 * @see PlaceCategories#requiresExactNameMatch(com.peakoff.place.domain.PlaceCategory)
	 */
	private Predicate<String> plausibilityOf(Place origin, Region region) {
		if (PlaceCategories.requiresExactNameMatch(origin.category())) {
			return forecastName -> false;
		}
		return forecastName -> couldBeSamePlace(origin, forecastName, region);
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

	/**
	 * 이름을 우리 장소로 잇기 <b>전에</b> 몇 배수까지 훑을지.
	 *
	 * <p>예측 이름 중에는 우리 카탈로그에 없는 것이 섞여 있고(공사가 부르는 이름이
	 * 달라서 못 잇는 경우도 있다), 이어지더라도 분류 게이트에서 빠질 수 있다.
	 * 딱 {@code limit}개만 훑으면 그만큼 빈손으로 끝난다.
	 *
	 * <p>거꾸로 배수를 키우면 <b>이름 잇기가 그만큼 늘어난다</b> — 이 인터페이스를 만든
	 * 이유가 그 비용이었다. 4는 "웬만하면 채우되 헛일은 적게"의 절충이다.
	 */
	private static final int NAME_LINK_OVERSCAN = 4;

	/**
	 * 지역 하나에서 기간 안에 가장 한적한 곳들.
	 *
	 * <h3>왜 예측에서 장소로 가는가 (그 반대가 아니라)</h3>
	 * 장소부터 시작하면 장소마다 {@code locate}가 돌아 <b>일곱 지역을 훑고 이름을 잇는다.</b>
	 * 지역 전체를 보려면 그 일을 (장소 수 × 날짜 수)만큼 되풀이하게 된다.
	 *
	 * <p>예측 자료는 이미 지역 한 덩어리로 캐시돼 있으므로, 여기서는
	 * <b>숫자만 보고 순위를 먼저 낸 뒤</b> 상위 몇 개만 장소로 잇는다.
	 * 비싼 일(이름 잇기)이 수백 번에서 수십 번으로 줄어든다.
	 *
	 * <h3>기간 안에서 가장 한적한 <b>하루</b>를 고른다</h3>
	 * 평균을 내지 않는다. 화면이 하려는 말은 "이번 주 언젠가 좀 한가해요"가 아니라
	 * <b>"9월 3일 수요일에 가면 한적해요"</b>이고, 그러려면 그 하루가 값에 붙어 있어야 한다.
	 * 평균은 요일 차이를 뭉개기도 한다 — 같은 곳의 토요일과 수요일이 40점 벌어지는 지역이 있다.
	 */
	@Override
	public List<QuietSpot> quietestWithin(Region region, LocalDate from, int days, int limit) {
		if (days < 1 || limit < 1) {
			return List.of();
		}
		RegionForecast forecast = client.forecastOf(region);
		if (forecast.isEmpty()) {
			// 지역 하나가 비었다고 예외를 던지지 않는다. 부르는 쪽은 지역을 여럿 돌고 있다.
			return List.of();
		}

		/*
		 * 1단계 — 이름별로 기간 안 가장 한적한 날을 찾는다. 아직 우리 장소를 모른다.
		 * 여기까지는 캐시된 Map 조회뿐이라 지역 전체를 훑어도 값이 싸다.
		 */
		record Ranked(String apiName, LocalDate date, int quietness) {
		}
		List<Ranked> ranked = new ArrayList<>();
		for (String apiName : forecast.placeNames()) {
			LocalDate bestDate = null;
			int best = Integer.MIN_VALUE;
			for (int offset = 0; offset < days; offset++) {
				LocalDate date = from.plusDays(offset);
				OptionalDouble rate = forecast.rateOf(apiName, date);
				if (rate.isEmpty()) {
					continue;
				}
				int quietness = toQuietness(rate.getAsDouble());
				if (quietness > best) {
					best = quietness;
					bestDate = date;
				}
			}
			if (bestDate != null) {
				ranked.add(new Ranked(apiName, bestDate, best));
			}
		}
		ranked.sort(Comparator.comparingInt(Ranked::quietness).reversed());

		/*
		 * 2단계 — 위에서부터 우리 장소로 이어 본다. limit을 채우면 멈춘다.
		 *
		 * ⚠️ 여기서 거르는 것은 <b>이 서비스가 코스에 담을 만한 분류</b>다. 예측 자료에는
		 * 시장(쇼핑)도 들어 있는데, 그것까지 "이번 주 한적한 곳"으로 내밀면
		 * 화면이 여행지로 소개한 자리에 재래시장이 선다.
		 */
		List<QuietSpot> spots = new ArrayList<>();
		int scanned = 0;
		for (Ranked candidate : ranked) {
			if (spots.size() >= limit || scanned >= limit * NAME_LINK_OVERSCAN) {
				break;
			}
			scanned++;
			Optional<Place> place = placeNamed(candidate.apiName(), region)
					.filter(found -> PlaceCategories.isCourseCandidate(found.category()));
			place.ifPresent(found -> spots.add(new QuietSpot(found, candidate.date(), candidate.quietness())));
		}
		return List.copyOf(spots);
	}
}
