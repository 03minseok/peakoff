package com.peakoff.chat.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * 질문 하나에 지역 둘을 고른다. <b>거르기가 먼저, 뽑기가 마지막.</b>
 *
 * <h2>층이 둘이다 — 관심사는 문, 한적함은 순서</h2>
 * <ol>
 *   <li><b>거르기</b> — 관심사의 몫이 중앙값 이상인 지역만 남긴다</li>
 *   <li><b>자르기</b> — 남은 것을 한적한 순으로 세워 <b>위쪽 절반</b>만 통에 담는다</li>
 *   <li><b>뽑기</b> — 그 통에서 둘을 <b>균등</b> 무작위로</li>
 * </ol>
 * 관심사를 점수로 만들지 않는다. "음식 비중이 높으니 3점"처럼 더하기 시작하면
 * 화면에 없는 값으로 줄을 세우게 되고, 그때부터 1등의 이유를 설명할 수 없다.
 *
 * <h2>왜 중앙값으로 자르는가</h2>
 * 절대선("음식 30% 이상")은 분류마다 몫의 크기가 달라 그때그때 다시 정해야 한다 —
 * 음식은 17~45%인데 체험은 2~6%다. 중앙값은 <b>그 분류 안에서 상대적으로 강한 절반</b>을
 * 가리키므로 분류마다 값을 따로 둘 필요가 없다.
 *
 * <p>실측(2026-09-05)에서 관심사 일곱 모두 <b>여섯 곳</b>이 남았다. 둘을 뽑기에 넉넉하고,
 * 열하나 전부를 남기는 것보다 "그 관심사에 강한 곳"이라는 말이 사실에 가깝다.
 *
 * <h2>⚠️ 아래쪽에서 하나를 <b>일부러 끼우지 않는다</b> (2026-09-08에 되돌렸다)</h2>
 * 한동안 <b>위에서 하나 · 아래에서 하나</b>를 뽑았다. "붐비는 곳이 하나 섞여야 차이가
 * 보인다"는 생각이었는데, <b>추천받는 사람 입장에서는 고를 것이 하나뿐</b>이었다 —
 * 두 장을 주면서 한 장은 우리가 알고도 덜 좋은 곳을 넣은 셈이다.
 *
 * <p>무엇보다 그것은 이 서비스가 하려는 일과 어긋난다. <b>한산한 곳으로 사람을 보내는 것</b>이
 * 목적인데, 덜 한산한 곳을 한 자리 보장해 주고 있었다.
 *
 * <p>원래 설계가 <b>"한적 등급에서 둘"</b>이었다는 것도 이 방향을 가리킨다. 위/아래 가르기는
 * 그 등급이 서지 않아서(11곳 평균이 전부 보통, {@link RegionProfile} 참고) 만든
 * <b>우회로</b>였지, 대비 자체가 목표였던 적은 없다.
 *
 * <p>대신 <b>순위로 자른 위쪽 절반</b>을 통으로 삼는다. 절대 등급이 못 서는 사정은 그대로지만,
 * 순위로 자르면 절대값이 어떻든 <b>둘 다 그 기간에 나은 쪽</b>이라는 것이 보장된다.
 *
 * <p>⚠️ <b>차이를 보이는 일은 그대로 남아 있다.</b> 두 장의 숫자와 막대가 다르고,
 * 카드 문장이 "이 중에서는 더/덜 한적한 편"이라고 말한다. 없앤 것은 <b>덜 좋은 곳을
 * 일부러 끼우는 것</b>이지 견주기가 아니다.
 *
 * <p>⚠️ <b>기간이 좁으면 위쪽 절반도 붐빌 수 있다.</b> 실측(2026-09-08)에서 9/12~13
 * 주말은 열한 곳 모두 한적한 장소가 4~25%뿐이었다 — 그 주말이 실제로 붐비기 때문이라
 * 뽑기로는 못 고친다. 그때 할 말은 <b>날짜를 권하는 것</b>이고, 아직 붙이지 않았다.
 *
 * <h2>⚠️ 자격선 안에서는 가중이 아니라 균등이다</h2>
 * 홈의 "이번 주 한적한 곳"에서 배운 것과 같다(2026-09-03). 먼저 잘라 낸 뒤 남은 점수 차는
 * 우열이 아니라 <b>같은 등급 안의 잔차</b>이고, 그 잔차로 확률을 기울이면 애써 넓혀 놓은
 * 후보에서 결국 위쪽 한둘만 나온다. 그러면 <b>우리가 미는 지역이 새로운 혼잡지가 된다</b> —
 * 그것도 이 서비스가 하지 말자고 만든 일이다.
 *
 * <h2>표시 순서는 한적한 순이다</h2>
 * 뽑은 뒤 세우지만, <b>줄 세운 값이 카드에 그대로 적혀 있다.</b> 대안 추천에서
 * "구간 단위까지만 정렬한다"고 정한 것과 같은 근거다 — 화면에 보이는 값으로만 줄을 세운다.
 * 분산은 <b>어느 지역이 뽑히느냐</b>에 있지 순서에 있지 않으므로, 세워도 죽지 않는다.
 */
@Component
@RequiredArgsConstructor
public class RegionChatPicker {

	/**
	 * 카드로 세울 지역 수.
	 *
	 * <p>하나면 그냥 여행지 추천이 된다 — 견줄 상대가 없으면 이 화면이 하려는 말
	 * ("가장 유명한 곳은 붐비고 비슷한 곳은 여유롭다")이 서지 않는다. <b>둘이 그 최소치다.</b>
	 *
	 * <p>셋이었다가 둘로 줄였다(2026-09-06). 차이를 보이는 데는 둘이면 되고,
	 * 고를 것이 적을수록 <b>고르기 쉽다</b> — 이 자리는 고민을 시작하는 곳이지
	 * 목록을 훑는 곳이 아니다.
	 *
	 */
	public static final int CARD_COUNT = 2;

	/**
	 * 뽑기 통의 최소 크기.
	 *
	 * <p>후보가 적을 때 상위 절반만 남기면 통이 둘~셋으로 쪼그라들고, 그러면
	 * <b>카드 두 장을 채우는 순간 고를 것이 없어</b> 늘 같은 조합이 나간다.
	 * 그 지역이 새로운 혼잡지가 되는 것이 이 서비스가 가장 피하려는 일이라,
	 * 비율로 자르되 바닥을 함께 둔다 — 홈의 "이번 주 한적한 곳"이 쓰는 방법과 같다.
	 */
	private static final int MIN_POOL = 4;

	private final WeightedPicker picker;

	/**
	 * @param profiles 지역 프로필 전체. 순서는 상관없다
	 * @param interest 질문에서 읽은 관심사. {@link Interest#NONE}이면 거르지 않는다
	 * @return 한적한 순으로 세운 둘. 후보가 모자라면 그만큼만 담긴다 —
	 *         <b>채우려고 자격 없는 지역을 넣지 않는다</b>
	 */
	public List<RegionProfile> pick(List<RegionProfile> profiles, Interest interest) {
		List<RegionProfile> candidates = filter(profiles, interest);
		if (candidates.isEmpty()) {
			return List.of();
		}
		return draw(candidates).stream()
				.sorted(Comparator.comparingInt(RegionProfile::quietShare).reversed())
				.toList();
	}

	/**
	 * 자격을 갖춘 후보만 남긴다.
	 *
	 * <p>줄 세울 수 없는 지역(예측 자료 없음)은 관심사와 무관하게 먼저 빠진다.
	 * 카드에 적을 숫자가 없는 지역은 추천의 근거를 댈 수 없다.
	 *
	 * <p>{@link #pick}이 안에서 부르지만 밖으로도 열어 둔다 — 개발용 확인 경로가
	 * <b>거른 결과와 뽑은 결과를 나란히</b> 보여줘야 어느 층이 틀렸는지 가려낼 수 있다.
	 */
	public List<RegionProfile> filter(List<RegionProfile> profiles, Interest interest) {
		List<RegionProfile> rankable = profiles.stream()
				.filter(RegionProfile::isRankable)
				.toList();
		if (interest == null || !interest.filtersRegions() || rankable.isEmpty()) {
			return rankable;
		}

		double cut = medianShare(rankable, interest);
		List<RegionProfile> kept = rankable.stream()
				.filter(profile -> profile.shareOf(interest) >= cut)
				.toList();

		/*
		 * 몫이 0인 지역까지 통과할 수 있다 — 절반 넘게 0이면 중앙값도 0이라서다.
		 * 그런 관심사는 애초에 지역을 가르지 못하므로, 그때는 아무도 거르지 않은 것과 같다.
		 * 억지로 남기지 않고 있는 그대로 둔다.
		 */
		return kept.isEmpty() ? rankable : kept;
	}

	/** 그 관심사의 몫 중앙값. 짝수 개면 가운데 둘의 평균이다. */
	private static double medianShare(List<RegionProfile> profiles, Interest interest) {
		double[] shares = profiles.stream()
				.mapToDouble(profile -> profile.shareOf(interest))
				.sorted()
				.toArray();
		int middle = shares.length / 2;
		return shares.length % 2 == 1
				? shares[middle]
				: (shares[middle - 1] + shares[middle]) / 2;
	}

	/**
	 * 한적한 순으로 세운 <b>위쪽 절반</b>에서 둘을 뽑는다.
	 *
	 * <p>후보가 적으면 절반이 너무 작아지므로 {@link #MIN_POOL}을 바닥으로 둔다.
	 * 후보가 그보다도 적으면 있는 것이 전부 통이 된다 — 통을 채우려고 자격 없는 지역을
	 * 넣지는 않지만, 카드 수를 줄이지도 않는다. 후보가 둘뿐이면 둘 다 세우는 것이 맞다.
	 *
	 * <p>⚠️ 통 안에서는 <b>균등</b>이다. 자격으로 이미 자른 뒤에 남은 점수 차는 우열이
	 * 아니라 같은 등급 안의 잔차이고, 그 잔차로 확률을 기울이면 애써 넓힌 통에서 결국
	 * 위쪽 한둘만 나온다 — 그러면 우리가 미는 지역이 새로운 혼잡지가 된다.
	 */
	private List<RegionProfile> draw(List<RegionProfile> candidates) {
		List<RegionProfile> ranked = candidates.stream()
				.sorted(Comparator.comparingInt(RegionProfile::quietShare).reversed())
				.toList();

		// 홀수면 위쪽이 한 자리 더 갖는다.
		int half = (ranked.size() + 1) / 2;
		List<RegionProfile> pool = new ArrayList<>(
				ranked.subList(0, Math.min(Math.max(half, MIN_POOL), ranked.size())));

		List<RegionProfile> drawn = new ArrayList<>();
		drawEvenly(pool, drawn, CARD_COUNT);
		return drawn;
	}

	/** 뽑은 것을 통에서 빼 가며 채운다. 빼지 않으면 같은 지역이 카드 두 장으로 선다. */
	private void drawEvenly(List<RegionProfile> pool, List<RegionProfile> into, int count) {
		for (int i = 0; i < count && !pool.isEmpty(); i++) {
			Optional<RegionProfile> drawn = picker.pickEvenly(pool);
			if (drawn.isEmpty()) {
				return;
			}
			pool.remove(drawn.get());
			into.add(drawn.get());
		}
	}
}
