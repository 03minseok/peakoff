package com.peakoff.congestion.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.peakoff.place.domain.Region;

/**
 * 한 지역에서 <b>앞으로 며칠 안에 한적할 곳</b>들을 찾아 준다.
 *
 * <h3>왜 {@link CongestionProvider}로는 안 되는가</h3>
 * 그쪽은 "이 장소의 이 날짜"를 묻는 자리다. 지역 전체를 훑으려면
 * (장소 수 × 날짜 수)만큼 물어야 하는데, 실연동 구현은 물음마다
 * <b>어느 지역인지부터 찾고 이름을 잇는다</b> — 장소 20곳 × 7일 × 지역 7개를
 * 곱하면 홈 화면 한 번에 수만 번의 이름 대조가 난다.
 *
 * <p>방향을 뒤집으면 값이 싸진다. 예측 자료는 이미 <b>지역 한 덩어리</b>로
 * 캐시돼 있으므로, 거기서 숫자만 보고 순위를 먼저 낸 뒤 <b>필요한 이름만</b>
 * 우리 장소로 이으면 비싼 일이 몇 건으로 줄어든다. 이 인터페이스가 그 뒤집기를 감싼다.
 *
 * <h3>두 단계로 나뉘어 있다 — 값싼 쪽과 비싼 쪽</h3>
 * <ol>
 *   <li>{@link #quietCandidatesWithin} — 캐시된 예측만 보고 <b>이름 상태의 후보</b>를 낸다.
 *       지역 상위 몇 %까지 볼지를 부르는 쪽이 정한다</li>
 *   <li>{@link #resolve} — 그중 <b>하나</b>를 우리 장소로 잇는다. 카탈로그를 훑는 비싼 쪽</li>
 * </ol>
 * 예전에는 "상위 몇 곳을 이어서 돌려달라"는 한 메서드였다. 그 모양은 <b>이을 만큼만
 * 볼 수 있다</b>는 뜻이라, 후보 범위를 넓히는 순간 비용이 그대로 따라 늘었다.
 * 나누면 <b>넓게 보고 조금만 잇는다</b> (2026-09-03).
 *
 * <h3>거르기는 여기서 끝낸다</h3>
 * {@link #resolve}가 돌려주는 것은 <b>코스에 담을 만한 관광지</b>뿐이다(음식점·숙박·리조트 제외).
 * 부르는 쪽이 다시 거르게 두면 같은 게이트가 두 곳에 생긴다.
 *
 * <p>⚠️ <b>뽑기는 여기서 하지 않는다.</b> 순서를 지킨다 —
 * 거르기가 먼저이고 무작위 뽑기가 마지막이다(CLAUDE.md "추천 분산").
 * 이 자리는 "자격을 갖춘 후보"까지만 만들고, 그중 무엇을 보여줄지는 서비스가 정한다.
 */
public interface QuietSpotProvider {

	/**
	 * 기간 안에서 한적한 순으로 <b>상위 몇 %</b>의 후보 이름들.
	 *
	 * <p>개수가 아니라 비율인 이유: 지역마다 예측 대상 수가 69곳(경주)에서 244곳(제주시)까지
	 * 벌어진다. 개수로 자르면 큰 지역일수록 좁게 보게 된다.
	 *
	 * @param region        살펴볼 지역
	 * @param from          기준일(포함)
	 * @param days          기준일부터 며칠을 볼지
	 * @param topShare      한적한 순으로 상위 몇 할까지 볼지 (0~1). 0.35면 상위 35%
	 * @param minCandidates 비율로 자른 결과가 이보다 적으면 이 수만큼은 남긴다.
	 *                      예측 대상이 적은 지역에서 후보가 한둘로 쪼그라드는 것을 막는다
	 * @return 한적도 내림차순. 예측 자료가 없으면 빈 목록 — <b>예외가 아니다.</b>
	 *         지역 하나가 비었다고 홈 화면 전체가 오류가 되면 안 된다
	 */
	List<QuietCandidate> quietCandidatesWithin(
			Region region, LocalDate from, int days, double topShare, int minCandidates);

	/**
	 * 후보 하나를 우리 장소로 잇는다. <b>비싼 쪽이라 뽑은 뒤에 한 번만 부른다.</b>
	 *
	 * @return 이어지지 않거나(공사가 부르는 이름이 우리 카탈로그에 없다)
	 *         코스에 담을 분류가 아니면 빈 값. <b>둘 다 정상적인 답이다</b> —
	 *         부르는 쪽은 다른 후보를 다시 뽑으면 된다
	 */
	Optional<QuietSpot> resolve(Region region, QuietCandidate candidate);
}
