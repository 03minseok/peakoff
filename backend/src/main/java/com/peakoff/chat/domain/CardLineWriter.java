package com.peakoff.chat.domain;

import java.util.List;
import java.util.Map;

import com.peakoff.place.domain.SupportedRegion;

/**
 * 카드 문장을 <b>더 낫게</b> 써 주는 자리. 없어도 카드는 완성된다({@link CardLineTemplate}).
 *
 * <p>LLM에게 남은 일은 이것뿐이다 — 우리가 넘긴 값을, 사용자가 물은 말투에 맞춰 옮기기.
 * 어느 지역인지도, 얼마나 한적한지도 이미 서버가 정해서 넘긴다.
 *
 * <p>⚠️ <b>실패를 예외로 알리지 않는다.</b> 못 쓴 지역은 지도에서 빠질 뿐이고
 * 부르는 쪽은 그 자리에 템플릿을 쓴다. 일부만 성공하는 것도 정상적인 답이다.
 */
public interface CardLineWriter {

	/** 지금 쓸 수 있는가. 인증키가 없거나 기능을 꺼 두면 거짓이다. */
	boolean isAvailable();

	/**
	 * @param question 사용자가 친 질문 원문. 말투를 맞추는 데만 쓴다
	 * @param interest 읽어낸 관심사
	 * @param picked   뽑힌 지역들. <b>한적한 순</b>으로 들어온다
	 * @return 지역 → 문장. <b>비어 있을 수 있고 일부만 있을 수도 있다</b>
	 */
	Map<SupportedRegion, String> write(String question, Interest interest, List<RegionProfile> picked);
}
