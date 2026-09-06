package com.peakoff.chat.domain;

/**
 * 카드 한 줄을 <b>서버가</b> 만든다. LLM이 없어도 카드는 완성된다.
 *
 * <h2>왜 서버가 먼저 만드는가</h2>
 * 이 문장은 <b>LLM이 있을 때 더 좋아지는 것</b>이지 LLM이 있어야 생기는 것이 아니다.
 * 인증키가 없거나 · 하루 상한에 닿았거나 · 시간이 초과됐거나 · 답이 검증에 걸렸을 때,
 * 카드에 빈 줄이 서면 <b>화면이 고장으로 읽힌다.</b>
 *
 * <p>순서를 뒤집어 두는 것이 핵심이다 — 템플릿을 먼저 만들고 LLM 문장을 <b>덮어쓴다.</b>
 * "LLM을 부르고 실패하면 템플릿"으로 짜면 실패 경로가 하나 빠질 때마다 빈 카드가 난다.
 *
 * <h2>⚠️ 계산한 것만 말한다</h2>
 * 여기 쓰인 말은 전부 우리가 센 값에서 나온다 — 분류별 몫과 이번 주 한적 관측 비율.
 * "회가 유명해요" 같은 문장은 <b>우리가 계산하지 않은 것</b>이라 여기에도 LLM에게도 없다.
 *
 * <h2>순위로 말한다</h2>
 * 절대값으로 "비중이 높아요"라고 하면 기준이 없다. 카드는 언제나 둘~셋이 나란히 서므로
 * <b>그 안에서의 순위</b>가 사용자가 실제로 읽는 정보다. 지역 평균으로는 3단계 등급이
 * 서지 않는다는 것도 같은 이유에서 순위를 쓰게 만들었다({@link RegionProfile} 참고).
 */
public final class CardLineTemplate {

	private CardLineTemplate() {
	}

	/**
	 * @param interest  질문에서 읽은 관심사
	 * @param topShare  이 지역이 카드들 중 그 관심사의 몫이 가장 큰가
	 * @param rank      한적한 순 자리 (0이 가장 한적)
	 * @param total     카드 수
	 * @return 카드에 적을 한 줄
	 */
	public static String of(Interest interest, boolean topShare, int rank, int total) {
		if (interest == null || !interest.filtersRegions()) {
			// 관심사가 없는 질문("어디가 한산해요?")에는 한적한 정도가 곧 답이다.
			return quietnessLine(rank, total);
		}
		return topShare
				? "%s 비중이 가장 높아요".formatted(interest.noun())
				: "%s 비중이 높은 편이에요".formatted(interest.noun());
	}

	/**
	 * 한적한 정도를 <b>이 카드들 안에서</b> 말한다.
	 *
	 * <p>⚠️ "한적해요"라고 단정하지 않는다. 지역 평균은 11곳이 전부 보통이라
	 * 절대 등급을 걸 수 없다 — 걸면 화면이 사실이 아닌 말을 하게 된다.
	 * "이 중에서는"을 붙이면 <b>견주는 말</b>이 되어 언제나 사실이다.
	 */
	private static String quietnessLine(int rank, int total) {
		if (total <= 1) {
			// 견줄 상대가 없으면 순위를 말할 수 없다. 사실만 남긴다.
			return "이번 주 한적한 곳을 살펴봤어요";
		}
		if (rank == 0) {
			return "이 중에서는 가장 한적한 편이에요";
		}
		if (rank == total - 1) {
			return "이 중에서는 붐비는 편이에요";
		}
		return "이번 주 한적한 곳이 꽤 있어요";
	}
}
