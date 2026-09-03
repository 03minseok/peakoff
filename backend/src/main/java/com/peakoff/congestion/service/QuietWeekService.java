package com.peakoff.congestion.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.congestion.domain.QuietCandidate;
import com.peakoff.congestion.domain.QuietSpot;
import com.peakoff.congestion.domain.QuietSpotProvider;
import com.peakoff.congestion.dto.QuietSpotResponse;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * "이번 주 한적한 곳" — 지역을 가리지 않고, 이번 주에 한적할 곳 몇 군데.
 *
 * <h2>이 화면이 하는 일</h2>
 * 홈은 지금까지 <b>지역을 하나 골라야</b> 무엇이든 보여줄 수 있었다. 지역이 일곱이 되면서
 * 그 방식은 "일곱 중 하나만 보여주고 나머지는 숨기는" 화면이 됐다. 여기서는 반대로
 * <b>전 지역을 한 번에 훑어</b> 한적한 곳을 건져 올린다 — 어디로 갈지 안 정한 사람에게
 * 서비스가 먼저 말을 거는 자리다.
 *
 * <h2>⚠️ 순서를 지킨다 — 거르기가 먼저, 뽑기가 마지막</h2>
 * CLAUDE.md "추천 분산"의 규칙이 이 자리에도 그대로 걸린다. 홈에 뜨는 곳이 늘 같으면
 * <b>그곳이 새로운 혼잡지가 된다</b> — 그것도 이 서비스가 가장 많이 노출하는 화면에서.
 *
 * <ol>
 *   <li>지역마다 예측을 훑어 <b>상위 35%</b>이면서 <b>한적(QUIET) 등급인</b> 후보만 남긴다</li>
 *   <li>지역별로 균등 무작위 하나씩 — 같은 지역이 목록을 독차지하지 않게</li>
 *   <li>그 지역 대표들 중에서 다시 균등 무작위로 {@code limit}개</li>
 * </ol>
 *
 * <p><b>뽑은 뒤 점수순으로 다시 정렬하지 않는다.</b> 2026-08-26에 대안 추천에서 겪은 그
 * 고장이다 — 값은 전부 맞게 들어 있었는데 마지막에 다시 줄을 세워서, 분산 장치가
 * 오래도록 아무 일도 하지 않았다.
 *
 * <h2>넓히고 나서 실제로 갈리는지 (2026-09-03, 실데이터 12회씩)</h2>
 * <pre>
 *                        서로 다른 장소   한적도 범위   1등 고정률   응답시간(중앙)
 * 전 (지역 상위 3곳·가중)   60자리에 20곳    83~91        25%          69ms
 * 후 (지역 상위 35%·균등)   60자리에 50곳    70~90        17%          31ms
 * </pre>
 * 30회로 늘려 보면 150자리에 <b>102곳</b>이 서고, 한 곳이 가장 많이 뜬 횟수가 30회 중 4회다.
 * 지역도 고르게 선다(20~23회씩). <b>한적도가 70 아래로 내려간 적은 없다</b> —
 * 넓힌 뒤에도 목록은 전부 한적 등급이다.
 *
 * <p>⚠️ <b>응답이 오히려 빨라졌다</b>(69ms → 31ms). 넓히면 느려질 것 같지만 반대다 —
 * 예전에는 뽑기 전에 상위 6곳을 채우려고 이름 잇기를 지역마다 최대 24번 했고,
 * 지금은 뽑힌 하나만 잇는다. <b>넓게 보는 층과 비싼 층을 갈라 놓았기 때문</b>이다.
 *
 * <h2>⚠️ 완성된 목록을 캐시하지 않는다</h2>
 * 서버가 이 목록을 캐시해 모든 사용자에게 돌려주면 분산이 통째로 죽는다.
 * 캐시는 <b>원자료 층</b>(지역별 집중률·관광지 카탈로그, TTL 6시간)에만 있고,
 * 고르는 일은 요청마다 새로 한다. 공사 호출이 늘지 않는 것은 그 캐시 덕이지
 * 결과를 재사용해서가 아니다.
 */
@Service
@RequiredArgsConstructor
public class QuietWeekService {

	/**
	 * "이번 주"의 길이. 오늘부터 7일이다.
	 *
	 * <p>예측 창(24~30일) 전체를 보지 않는 이유: 3주 뒤에 한적한 곳을 "이번 주 한적한 곳"이라
	 * 부를 수는 없다. 화면이 날짜를 함께 적으므로 그 날짜가 손에 닿는 거리여야 한다.
	 */
	private static final int FORECAST_DAYS = 7;

	/**
	 * 지역마다 <b>한적한 순으로 상위 몇 %</b>를 후보로 볼지. (2026-09-03에 넓혔다)
	 *
	 * <h3>왜 개수가 아니라 비율인가</h3>
	 * 예전에는 "지역마다 상위 6곳을 이어 오고 그중 상위 3곳에서 뽑는다"였다. 그 값은
	 * 지역 크기를 보지 않아서, 예측 대상이 69곳인 경주와 244곳인 제주시가 <b>똑같이
	 * 세 곳</b>만 후보였다. 큰 지역일수록 좁게 보는 셈이다.
	 *
	 * <h3>왜 35%인가 — 넓혀도 "한적한 곳"이라는 이름이 안 깨지는 선</h3>
	 * 스냅샷으로 7일 창의 최고 한적일을 다시 계산해 봤다(2026-08-31 수집분, 2026-09-03 계산):
	 *
	 * <pre>
	 * 지역     예측장소  상위35%   그 경계의 한적도
	 * 경주       69      24곳        77.1
	 * 제주시    244      85곳        72.1
	 * 서귀포    204      71곳        70.2
	 * 태안       97      34곳        79.6
	 * </pre>
	 *
	 * <b>경계가 70~80이라 네 지역 모두 한적(65) 등급 안에 들어온다.</b> 즉 35%까지 넓혀도
	 * 화면이 내건 "이번 주 한적한 곳"이라는 이름이 깨지지 않는다. 더 넓히면 경계가
	 * 65 아래로 내려가는 지역이 생기고, 그때부터는 <b>보통인 곳을 한적하다고 부르게 된다.</b>
	 * 등급 필터가 뒤에 한 겹 더 있지만, 그 필터에 기대 비율을 올리면
	 * 지역마다 후보 폭이 제각각이 된다(한적 비율이 경주 74% · 서귀포 45%로 갈린다).
	 */
	private static final double TOP_SHARE = 0.35;

	/**
	 * 비율로 자른 뒤에도 최소한 이만큼은 후보로 남긴다.
	 *
	 * <p>비율은 지역이 클 때 잘 듣지만 작을 때는 반대로 조인다 — 예측 대상이 10곳인 지역이
	 * 생기면 상위 35%가 <b>네 곳</b>이 되어, 넓히려고 넣은 규칙이 도로 좁히는 규칙이 된다.
	 * 목업 카탈로그(경주 한 곳, 관광지 24곳)에서 먼저 그 모양이 나온다.
	 */
	private static final int MIN_CANDIDATES = 5;

	/**
	 * 지역 하나에서 이름 잇기를 몇 번까지 시도할지.
	 *
	 * <p>뽑힌 후보가 우리 장소로 안 이어질 수 있다(공사가 부르는 이름이 카탈로그에 없거나,
	 * 이어져도 코스에 담을 분류가 아니다). 그때는 <b>그 후보를 빼고 다시 뽑는다.</b>
	 *
	 * <p>이 값이 곧 <b>지역당 최대 비용</b>이다 — 이름 잇기 한 번이 지역 카탈로그를 훑는다.
	 * 예전 구조는 뽑기 전에 상위 6곳을 채우느라 지역마다 최대 24번을 훑었으니,
	 * 12는 그 절반이면서 실제로는 보통 1~3번에서 끝난다. <b>넓게 보고 조금만 잇는다.</b>
	 */
	private static final int MAX_RESOLVE_ATTEMPTS = 12;

	private final QuietSpotProvider quietSpotProvider;
	private final WeightedPicker picker;
	private final Clock clock;

	/** 지역과 그 지역에서 건진 한 곳. 뽑기가 끝난 뒤에도 어느 지역인지 알아야 한다. */
	private record RegionalSpot(SupportedRegion region, QuietSpot spot) {
	}

	/**
	 * @param limit 화면에 세울 곳 수
	 * @return 한적한 곳들. <b>점수순이 아니라 뽑힌 순서다.</b>
	 *         자료가 모자라면 요청보다 적게 담긴다 — 채우려고 붐비는 곳을 섞지 않는다
	 */
	public List<QuietSpotResponse> thisWeek(int limit) {
		LocalDate from = LocalDate.now(clock);

		List<RegionalSpot> representatives = new ArrayList<>();
		for (SupportedRegion region : SupportedRegion.values()) {
			representativeOf(region, from).ifPresent(representatives::add);
		}

		// 3단계 — 지역 대표들 중에서 중복 없이 뽑는다.
		return drawWithoutRepeat(representatives, limit).stream()
				.map(picked -> QuietSpotResponse.of(picked.spot(), picked.region()))
				.toList();
	}

	/**
	 * 지역 하나의 대표. <b>1·2단계가 여기 있다.</b>
	 *
	 * <h3>왜 뽑고 나서 잇는가 (그 반대가 아니라)</h3>
	 * 후보를 상위 35%로 넓히면 지역마다 24~85곳이 된다. 예전처럼 <b>후보를 전부 우리 장소로
	 * 이어 놓고</b> 그중 하나를 뽑으면, 화면 한 번에 수백 번의 이름 대조가 난다 —
	 * 넓힌 만큼 그대로 비용이 된다.
	 *
	 * <p>순서를 뒤집으면 넓혀도 값이 싸다. 이름과 한적도는 캐시된 예측에서 바로 나오므로
	 * <b>이름 상태로 먼저 뽑고, 뽑힌 하나만 잇는다.</b> 못 이으면 그것만 빼고 다시 뽑는다.
	 *
	 * <h3>⚠️ 등급 필터를 비율 뒤에 한 겹 더 둔다</h3>
	 * 상위 35%의 경계가 한적(65) 위라는 것은 <b>실측 네 지역에서 그랬다</b>는 말이지
	 * 구조가 보장하는 사실이 아니다. 유난히 붐비는 주가 오면 상위 35% 안에도 보통인 곳이
	 * 섞일 수 있고, 그때 이 필터가 없으면 "이번 주 한적한 곳"이 거짓말이 된다.
	 * 이름을 잇기 전에 거르므로 값도 들지 않는다.
	 */
	private Optional<RegionalSpot> representativeOf(SupportedRegion region, LocalDate from) {
		List<QuietCandidate> remaining = new ArrayList<>(quietSpotProvider
				.quietCandidatesWithin(region.toRegion(), from, FORECAST_DAYS, TOP_SHARE, MIN_CANDIDATES)
				.stream()
				.filter(candidate -> candidate.level() == CongestionLevel.QUIET)
				.toList());

		for (int attempt = 0; attempt < MAX_RESOLVE_ATTEMPTS && !remaining.isEmpty(); attempt++) {
			Optional<QuietCandidate> drawn = picker.pickEvenly(remaining);
			if (drawn.isEmpty()) {
				break;
			}
			remaining.remove(drawn.get());

			Optional<QuietSpot> spot = quietSpotProvider.resolve(region.toRegion(), drawn.get());
			if (spot.isPresent()) {
				return Optional.of(new RegionalSpot(region, spot.get()));
			}
		}
		return Optional.empty();
	}

	/**
	 * 뽑은 것을 후보에서 빼 가며 {@code limit}개를 채운다.
	 *
	 * <p>한 번에 여러 개를 뽑는 대신 한 개씩 빼면서 뽑는 이유: 무작위 뽑기는 같은 후보를
	 * 두 번 고를 수 있다. 같은 곳이 카드 두 장으로 서면 목록이 고장으로 읽힌다.
	 *
	 * <p>⚠️ <b>여기서도 점수를 보지 않는다</b>(2026-09-03). 예전에는 상위 3곳 안에서
	 * 가중 무작위였는데, 대표가 일곱인데 셋만 보면 <b>덜 한적한 지역 둘은 영영 못 뜬다</b> —
	 * 다섯 자리를 채우는 동안 남는 것이 언제나 그 둘이라서다. 대표들은 이미 각자 지역의
	 * 상위 35%·한적 등급을 통과했으므로 지역끼리 우열을 매길 이유가 없다.
	 */
	private List<RegionalSpot> drawWithoutRepeat(List<RegionalSpot> candidates, int limit) {
		List<RegionalSpot> remaining = new ArrayList<>(candidates);
		List<RegionalSpot> drawn = new ArrayList<>();
		while (drawn.size() < limit && !remaining.isEmpty()) {
			Optional<RegionalSpot> picked = picker.pickEvenly(remaining);
			if (picked.isEmpty()) {
				break;
			}
			drawn.add(picked.get());
			remaining.remove(picked.get());
		}
		return drawn;
	}
}
