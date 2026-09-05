package com.peakoff.chat.domain;

import java.time.LocalDate;
import java.util.List;

/**
 * 지역 프로필을 만들어 주는 자리. <b>바깥에서 무엇을 받아 오는지는 이 인터페이스가 모른다.</b>
 *
 * <p>다른 도메인과 같은 배치다({@code PlaceProvider} · {@code CongestionProvider}) —
 * 규칙은 안쪽에, 공사 연동은 바깥쪽에 둔다. 목업으로도 챗봇 화면이 떠야
 * 인증키 없이 화면을 만들 수 있다.
 *
 * <h3>⚠️ 열하나를 한 번에 묻는다</h3>
 * 지역 하나씩 묻는 모양이었다면 부르는 쪽이 반복문을 돌게 되고, 그 안에서
 * <b>지역마다 캐시를 확인하는 비용</b>이 그대로 쌓인다. 무엇보다 이 화면이 하려는 일은
 * "열하나를 견주는 것"이라, 견줄 것을 한 번에 받는 편이 뜻에 맞는다.
 */
public interface RegionProfileProvider {

	/**
	 * 지원 지역 전체의 프로필.
	 *
	 * @param from 이번 주의 첫날(포함)
	 * @param days 며칠을 볼지
	 * @return 지역 수만큼. <b>예측 자료가 없는 지역도 담긴다</b> —
	 *         빼는 판단은 {@link RegionChatPicker}가 한 곳에서 한다
	 */
	List<RegionProfile> profiles(LocalDate from, int days);
}
