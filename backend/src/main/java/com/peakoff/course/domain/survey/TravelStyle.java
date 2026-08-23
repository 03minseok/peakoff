package com.peakoff.course.domain.survey;

import java.util.Arrays;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;

import com.peakoff.place.domain.PlaceCategory;

/**
 * 설문 1번 — 여행 스타일 (복수 선택).
 *
 * <p><b>스타일과 분류 코드의 짝이 이 파일 한 곳에만 있다.</b> 실제 신분류 코드가 붙으면
 * 아래 코드 문자열만 갈아끼우면 되고, 후보를 거르는 로직은 손대지 않는다.
 *
 * <p>프론트는 {@code HISTORY} 같은 이름만 보내고 어떤 분류 코드에 매핑되는지 모른다.
 * 분류 체계가 바뀔 때 화면을 고치지 않기 위해서다.
 *
 * <h2>고를 수 있는 것은 공사가 예측하는 분류뿐이다</h2>
 * 경주에서 집중률 예측이 있는 곳은 65곳이고, 분류는 <b>역사·유적 36 · 자연·풍경 16 ·
 * 문화·명소 13</b>이 전부다. 체험·레저·쇼핑·음식점·숙박은 <b>한 곳도 없다.</b>
 *
 * <p>그래서 "체험·액티비티"와 "맛집·카페"를 뺐다. 골라도 후보가 하나도 남지 않아
 * <b>추천 자체가 실패했다</b> — 조건을 잘못 고른 것이 아니라 처음부터 만들 수 없는 요청이었다.
 * 고를 수 없는 것을 화면에 세워두면 사용자는 자기가 뭘 잘못했는지 찾게 된다.
 *
 * <p>목업 분류({@code MOCK-ACTIVITY})는 역사에 붙여 두었다. 장소만 목업인 구간에서
 * 후보가 통째로 비는 것을 막기 위한 임시 조치이고, 실데이터에서는 쓰이지 않는다.
 *
 * <h2>맛집·카페를 여기서 고르지 않는 또 하나의 이유</h2>
 * 코스 추천은 <b>혼잡을 분산하는 장치</b>다. 그런데 공사 집중률은 관광지만 예측해서
 * 음식점·카페는 한 곳도 없다(경주 211곳 중 0곳). 한적도를 모르는 곳을 추천하면
 * "덜 붐비는 곳으로 안내한다"는 말이 성립하지 않는다.
 *
 * <p>실제로 "맛집·카페"만 고르면 후보가 하나도 남지 않아 <b>추천 자체가 실패했다.</b>
 * 조건을 잘못 고른 것이 아니라 처음부터 만들 수 없는 요청이었다.
 *
 * <p>밥집은 사용자가 코스 편집에서 직접 담는다. 담는 것은 막지 않고 진단에서만 빠진다 —
 * 밥 없는 여행은 없지만, 밥집을 혼잡 회피의 대상으로 다룰 근거가 우리에게 없다.
 *
 * <p>⚠️ <b>신분류 VE("문화·명소", 경주 75건)는 어느 스타일에도 넣지 않았다.</b>
 * 워터파크·리조트·금리단길·동궁원이 한데 묶여 있어 하나의 성격으로 부를 수 없다.
 * 역사에 넣으면 "역사를 좋아한다"고 답한 사람에게 워터파크가 나오고, 체험에 넣으면
 * 유적성 명소가 엉뚱한 답에 걸린다. 75건이라 아깝지만, 잘못 넣는 것보다 빠지는 편이 낫다.
 * <b>분석 담당이 하위 분류(VE02·VE03·VE05·VE07)를 보고 정할 자리다.</b>
 *
 * <p><b>숙박(AC)은 어떤 스타일에도 붙지 않는다.</b> 코스 슬롯은 "그 날 어디를 가는가"이지
 * "어디서 자는가"가 아니다. 매핑에서 빠지면 자연히 슬롯 후보에서 제외된다.
 * 축제·행사(EV)도 뺐다 — 기간이 정해져 있어 여행 날짜와 안 맞으면 갈 수 없는 곳이다.
 *
 * <p>목업 코드({@code MOCK-*})와 신분류 코드를 <b>함께</b> 적어 둔다. 데이터 원천을
 * 도메인마다 따로 넘기고 있어서, 장소는 실데이터인데 다른 것이 아직 목업인 구간이 있다.
 * 한쪽만 적으면 그 구간에서 후보가 통째로 비어 "스타일에 맞는 장소가 없다"가 된다.
 */
public enum TravelStyle {

	HISTORY("역사·유적", Set.of("HS", "MOCK-HISTORY", "MOCK-ACTIVITY")),
	NATURE("자연·풍경", Set.of("NA", "MOCK-NATURE"));

	private final String label;
	private final Set<String> categoryCodes;

	TravelStyle(String label, Set<String> categoryCodes) {
		this.label = label;
		this.categoryCodes = categoryCodes;
	}

	public boolean matches(PlaceCategory category) {
		return categoryCodes.contains(category.code());
	}

	/** 고른 스타일 중 하나라도 이 분류를 포함하는지. 후보를 거르는 데 쓴다. */
	public static boolean anyMatches(Collection<TravelStyle> styles, PlaceCategory category) {
		return styles.stream().anyMatch(style -> style.matches(category));
	}

	/**
	 * 이 분류가 어느 스타일에 속하는지. <b>추천 근거 문구를 만드는 데 쓴다.</b>
	 *
	 * <p>"역사·유적 선호"라고 말하려면 그 장소가 실제로 역사·유적이어서 뽑혔다는 것을
	 * 확인해야 한다. 사용자가 고른 스타일을 그대로 갖다 붙이면, 맛집 때문에 뽑힌 곳에
	 * "역사·유적 선호"라고 적히는 일이 생긴다.
	 */
	public static Optional<TravelStyle> of(PlaceCategory category) {
		return Arrays.stream(values())
				.filter(style -> style.matches(category))
				.findFirst();
	}

	/** 화면과 근거 문구에 쓰는 이름 (예: "역사·유적") */
	public String label() {
		return label;
	}
}
