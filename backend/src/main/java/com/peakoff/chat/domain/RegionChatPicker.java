package com.peakoff.chat.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

import com.peakoff.recommendation.domain.WeightedPicker;

/**
 * 질문 하나에 지역 둘~셋을 고른다. <b>거르기가 먼저, 뽑기가 마지막.</b>
 *
 * <h2>층이 둘이다 — 관심사는 문, 한적함은 순서</h2>
 * <ol>
 *   <li><b>거르기</b> — 관심사의 몫이 중앙값 이상인 지역만 남긴다</li>
 *   <li><b>가르기</b> — 남은 것을 한적한 순으로 세워 위/아래로 반 가른다</li>
 *   <li><b>뽑기</b> — 위에서 둘, 아래에서 하나. 각 통 안에서는 <b>균등</b> 무작위</li>
 * </ol>
 * 관심사를 점수로 만들지 않는다. "음식 비중이 높으니 3점"처럼 더하기 시작하면
 * 화면에 없는 값으로 줄을 세우게 되고, 그때부터 1등의 이유를 설명할 수 없다.
 *
 * <h2>왜 중앙값으로 자르는가</h2>
 * 절대선("음식 30% 이상")은 분류마다 몫의 크기가 달라 그때그때 다시 정해야 한다 —
 * 음식은 17~45%인데 체험은 2~6%다. 중앙값은 <b>그 분류 안에서 상대적으로 강한 절반</b>을
 * 가리키므로 분류마다 값을 따로 둘 필요가 없다.
 *
 * <p>실측(2026-09-05)에서 관심사 일곱 모두 <b>여섯 곳</b>이 남았다. 셋을 뽑기에 넉넉하고,
 * 열하나 전부를 남기는 것보다 "그 관심사에 강한 곳"이라는 말이 사실에 가깝다.
 *
 * <h2>⚠️ 위/아래를 <b>절대 등급</b>이 아니라 <b>후보 안의 순위</b>로 가른다</h2>
 * 설계는 원래 "한적 등급에서 둘, 그 아래에서 하나"였다. 그런데 실측에서
 * <b>11곳의 주간 평균이 전부 보통</b>이라 그 갈래가 서지 않았다({@link RegionProfile} 참고).
 *
 * <p>순위로 가르면 절대값이 어떻든 <b>구조가 대비를 보장한다.</b> 아래쪽에서 하나를 반드시
 * 뽑으므로 카드 셋 중 하나는 언제나 "이 중에서는 덜 한적한 곳"이다.
 * 붐빔이 하나 섞여야 한다는 요구는 <b>서로 견줄 때</b> 의미가 있고, 이 화면은 언제나
 * 여럿을 나란히 놓는 자리다.
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

	/** 카드로 세울 지역 수. 하나면 그냥 여행지 추천이 되고, 넷이면 350px 칸에 안 들어간다. */
	public static final int CARD_COUNT = 3;

	/** 위쪽(더 한적한 쪽)에서 뽑을 수. 나머지 한 자리가 아래쪽 몫이다. */
	private static final int FROM_UPPER = 2;

	private final WeightedPicker picker;

	/**
	 * @param profiles 지역 프로필 전체. 순서는 상관없다
	 * @param interest 질문에서 읽은 관심사. {@link Interest#NONE}이면 거르지 않는다
	 * @return 한적한 순으로 세운 둘~셋. 후보가 모자라면 그만큼만 담긴다 —
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
	 * 위에서 둘, 아래에서 하나.
	 *
	 * <p>후보가 적으면 통이 겹치거나 비는데, 그때는 <b>남은 데서 마저 채운다.</b>
	 * 대비를 만들려다 카드 수를 줄이면 화면이 고장으로 읽힌다 — 후보가 둘뿐이면
	 * 둘 다 세우는 것이 맞다.
	 */
	private List<RegionProfile> draw(List<RegionProfile> candidates) {
		List<RegionProfile> ranked = candidates.stream()
				.sorted(Comparator.comparingInt(RegionProfile::quietShare).reversed())
				.toList();

		// 홀수면 위쪽이 한 자리 더 갖는다. 아래쪽은 한 자리만 쓰므로 위쪽이 넓은 편이 낫다.
		int half = (ranked.size() + 1) / 2;
		List<RegionProfile> upper = new ArrayList<>(ranked.subList(0, half));
		List<RegionProfile> lower = new ArrayList<>(ranked.subList(half, ranked.size()));

		List<RegionProfile> drawn = new ArrayList<>();
		drawEvenly(upper, drawn, FROM_UPPER);
		drawEvenly(lower, drawn, CARD_COUNT - drawn.size());

		// 아래쪽이 비었으면(후보가 하나뿐) 위쪽에서 마저 채운다.
		drawEvenly(upper, drawn, CARD_COUNT - drawn.size());
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
