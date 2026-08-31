package com.peakoff.congestion.domain;

import java.time.LocalDate;
import java.util.List;

import com.peakoff.place.domain.Region;

/**
 * 한 지역에서 <b>앞으로 며칠 안에 가장 한적할 곳</b>들을 찾아 준다.
 *
 * <h3>왜 {@link CongestionProvider}로는 안 되는가</h3>
 * 그쪽은 "이 장소의 이 날짜"를 묻는 자리다. 지역 전체를 훑으려면
 * (장소 수 × 날짜 수)만큼 물어야 하는데, 실연동 구현은 물음마다
 * <b>어느 지역인지부터 찾고 이름을 잇는다</b> — 장소 20곳 × 7일 × 지역 7개를
 * 곱하면 홈 화면 한 번에 수만 번의 이름 대조가 난다.
 *
 * <p>방향을 뒤집으면 값이 싸진다. 예측 자료는 이미 <b>지역 한 덩어리</b>로
 * 캐시돼 있으므로, 거기서 숫자만 보고 한적한 이름 몇 개를 먼저 고른 뒤
 * <b>그것만</b> 우리 장소로 이으면 비싼 일이 몇 건으로 줄어든다.
 * 이 인터페이스가 그 뒤집기를 감싼다.
 *
 * <h3>거르기는 여기서 끝낸다</h3>
 * 돌려주는 것은 <b>코스에 담을 만한 관광지</b>뿐이다(음식점·숙박·리조트 제외).
 * 부르는 쪽이 다시 거르게 두면 "몇 곳을 달라"는 요청이 몇 곳으로 돌아올지
 * 알 수 없게 되고, 모자란 만큼 더 달라고 되물어야 한다.
 *
 * <p>⚠️ <b>뽑기는 여기서 하지 않는다.</b> 순서를 지킨다 —
 * 거르기가 먼저이고 가중 무작위 뽑기가 마지막이다(CLAUDE.md "추천 분산").
 * 이 자리는 "자격을 갖춘 후보"까지만 만들고, 그중 무엇을 보여줄지는
 * 서비스가 정한다.
 */
public interface QuietSpotProvider {

	/**
	 * @param region 살펴볼 지역
	 * @param from   기준일(포함)
	 * @param days   기준일부터 며칠을 볼지
	 * @param limit  최대 몇 곳까지 돌려줄지. 한적한 순으로 자른다
	 * @return 한적도 내림차순. 예측 자료가 없으면 빈 목록 — <b>예외가 아니다.</b>
	 *         지역 하나가 비었다고 홈 화면 전체가 오류가 되면 안 된다
	 */
	List<QuietSpot> quietestWithin(Region region, LocalDate from, int days, int limit);
}
