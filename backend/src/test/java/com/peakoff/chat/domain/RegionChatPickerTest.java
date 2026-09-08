package com.peakoff.chat.domain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.recommendation.domain.WeightedPicker;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 지역 고르기의 규칙을 잠근다.
 *
 * <p>여기서 지키는 것 셋 — <b>관심사는 거르기만 한다</b>(점수가 아니다),
 * <b>두 장 다 나은 쪽에서 나온다</b>(덜 한적한 곳을 일부러 끼우지 않는다),
 * <b>매번 같은 조합이 나오지 않는다</b>(우리가 미는 지역이 새 혼잡지가 되지 않게).
 */
class RegionChatPickerTest {

	private final RegionChatPicker picker = new RegionChatPicker(
			new WeightedPicker(RandomGenerator.getDefault()));

	/**
	 * 실측값으로 만든 프로필(2026-09-05). 한적 비율은 실제로 잰 값이고,
	 * 음식 몫도 그때 카탈로그 비율이다 — 지어낸 수로 규칙을 잠그면 규칙이 현실과 갈라진다.
	 */
	private static RegionProfile profile(SupportedRegion region, int quietShare, double foodShare) {
		return new RegionProfile(region, Map.of(Interest.FOOD, foodShare), quietShare, 100);
	}

	private List<RegionProfile> eleven() {
		return List.of(
				profile(SupportedRegion.TONGYEONG, 65, 0.349),
				profile(SupportedRegion.NAMWON, 62, 0.250),
				profile(SupportedRegion.GAPYEONG, 59, 0.285),
				profile(SupportedRegion.CHUNGJU, 56, 0.224),
				profile(SupportedRegion.TAEAN, 56, 0.170),
				profile(SupportedRegion.YEOSU, 55, 0.449),
				profile(SupportedRegion.CHUNCHEON, 52, 0.288),
				profile(SupportedRegion.GYEONGJU, 48, 0.339),
				profile(SupportedRegion.SOKCHO, 45, 0.401),
				profile(SupportedRegion.SEOGWIPO, 24, 0.319),
				profile(SupportedRegion.JEJU, 22, 0.345));
	}

	@Test
	@DisplayName("관심사는 후보를 거른다 — 몫이 중앙값 이상인 지역만 남는다")
	void interestFiltersByMedianShare() {
		List<RegionProfile> kept = picker.filter(eleven(), Interest.FOOD);

		// 음식 몫 중앙값은 서귀포의 31.9%다(열한 값의 여섯째). 그 위가 여섯 곳.
		assertThat(kept).extracting(profile -> profile.region().shortName())
				.containsExactlyInAnyOrder("여수", "속초", "제주시", "통영", "경주", "서귀포시");
		assertThat(kept).extracting(profile -> profile.region().shortName())
				.doesNotContain("태안", "충주", "남원", "가평", "춘천");
	}

	@Test
	@DisplayName("관심사가 없으면 거르지 않는다 — \"어디가 한산해요\"는 전 지역이 후보다")
	void noneKeepsEveryone() {
		assertThat(picker.filter(eleven(), Interest.NONE)).hasSize(11);
	}

	@Test
	@DisplayName("예측 자료가 없는 지역은 관심사와 무관하게 빠진다 — 카드에 적을 숫자가 없다")
	void dropsRegionsWithoutForecast() {
		List<RegionProfile> profiles = new ArrayList<>(eleven());
		profiles.add(new RegionProfile(SupportedRegion.SOKCHO, Map.of(Interest.FOOD, 0.9), null, 0));

		assertThat(picker.filter(profiles, Interest.NONE))
				.allMatch(RegionProfile::isRankable);
	}

	/**
	 * 한동안 <b>일부러</b> 아래쪽에서 하나를 뽑았다(2026-09-08에 되돌렸다). 두 장을 주면서
	 * 한 장은 우리가 알고도 덜 좋은 곳을 넣는 셈이라, 고르는 사람에게는 고를 것이 하나뿐이었다.
	 * <b>한산한 곳으로 사람을 보내는 것</b>이 목적인 서비스가 할 일이 아니다.
	 */
	@Test
	@DisplayName("두 장 다 나은 쪽에서 나온다 — 덜 한적한 곳을 일부러 끼우지 않는다")
	void bothComeFromTheQuieterHalf() {
		List<RegionProfile> profiles = eleven();
		int median = 55;                                    // 열한 곳의 한적 비율 중앙값

		for (int trial = 0; trial < 200; trial++) {
			List<RegionProfile> picked = picker.pick(profiles, Interest.NONE);

			/* ⚠️ 숫자를 박지 않는다. 카드 수가 바뀌어도 지켜야 하는 것은 <b>자격</b>이다 */
			assertThat(picked).hasSize(RegionChatPicker.CARD_COUNT);
			assertThat(picked).allMatch(profile -> profile.quietShare() >= median);
		}
	}

	@Test
	@DisplayName("한적한 순으로 세워 내려보낸다 — 줄 세운 값이 카드에 적힌 그 값이다")
	void sortsByQuietShare() {
		for (int trial = 0; trial < 50; trial++) {
			List<RegionProfile> picked = picker.pick(eleven(), Interest.NONE);

			assertThat(picked).isSortedAccordingTo(
					(left, right) -> Integer.compare(right.quietShare(), left.quietShare()));
		}
	}

	@Test
	@DisplayName("같은 지역이 카드 두 장으로 서지 않는다")
	void neverRepeatsARegion() {
		for (int trial = 0; trial < 200; trial++) {
			List<RegionProfile> picked = picker.pick(eleven(), Interest.FOOD);

			Set<SupportedRegion> regions = new HashSet<>();
			picked.forEach(profile -> regions.add(profile.region()));
			assertThat(regions).hasSize(picked.size());
		}
	}

	/**
	 * 이 장치가 죽으면 우리가 미는 지역이 새로운 혼잡지가 된다 — 2차 오버투어리즘.
	 * 대안 추천에서 <b>값은 다 맞는데 마지막에 다시 정렬해서</b> 오래도록 아무 일도 하지 않던
	 * 그 고장을 여기서 되풀이하지 않으려고 잠근다.
	 */
	@Test
	@DisplayName("매번 같은 조합이 나오지 않는다 — 통 안에서 골고루 뜬다")
	void spreadsAcrossCandidates() {
		Set<SupportedRegion> seen = new HashSet<>();
		Set<String> combinations = new HashSet<>();
		for (int trial = 0; trial < 200; trial++) {
			List<RegionProfile> picked = picker.pick(eleven(), Interest.NONE);
			picked.forEach(profile -> seen.add(profile.region()));
			combinations.add(picked.stream().map(profile -> profile.region().slug()).sorted().toList().toString());
		}

		/*
		 * 열한 곳 중 위쪽 여섯이 통이다. 그 여섯은 모두 떠야 하고, 조합도 여럿이라야 한다 —
		 * 늘 같은 둘이 나가면 <b>우리가 미는 지역이 새 혼잡지</b>가 된다.
		 */
		assertThat(seen).hasSize(6);
		assertThat(combinations).hasSizeGreaterThan(10);
	}

	@Test
	@DisplayName("후보가 둘뿐이면 둘 다 세운다 — 대비를 만들려다 카드를 줄이지 않는다")
	void keepsSmallCandidateSets() {
		List<RegionProfile> two = List.of(
				profile(SupportedRegion.TONGYEONG, 65, 0.34),
				profile(SupportedRegion.JEJU, 22, 0.34));

		List<RegionProfile> picked = picker.pick(two, Interest.NONE);

		assertThat(picked).hasSize(2);
		assertThat(picked.get(0).quietShare()).isEqualTo(65);
	}

	@Test
	@DisplayName("후보가 없으면 빈 목록이다 — 채우려고 자격 없는 지역을 넣지 않는다")
	void emptyWhenNothingQualifies() {
		List<RegionProfile> noForecast = List.of(
				new RegionProfile(SupportedRegion.JEJU, Map.of(), null, 0));

		assertThat(picker.pick(noForecast, Interest.FOOD)).isEmpty();
	}
}
