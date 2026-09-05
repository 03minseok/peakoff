package com.peakoff.chat.domain;

import java.util.Set;

import com.peakoff.place.domain.PlaceCategory;

/**
 * 챗봇이 질문에서 읽어내는 관심사. <b>후보를 거르는 문이지 점수가 아니다.</b>
 *
 * <h3>왜 enum인가</h3>
 * LLM이 고를 수 있는 값을 <b>우리가 먼저 닫아 둔다.</b> 자유 문자열을 받으면
 * "제주 감성 카페 투어" 같은 답이 오고, 그것을 다시 우리 분류로 옮기는 일이 생긴다 —
 * 옮기는 과정이 곧 <b>계산하지 않은 판단</b>이다. 고를 수 있는 것이 여기 적힌 아홉이면
 * LLM이 할 수 있는 일은 <b>고르기</b>뿐이다.
 *
 * <p>프롬프트에 적을 목록도 이 enum에서 만든다. 코드와 프롬프트가 갈라지면
 * LLM이 없는 값을 골라 오고, 그때 서버는 그것을 조용히 버리게 된다.
 *
 * <h3>비율로 견주고, 개수로는 견주지 않는다</h3>
 * 이 값이 하는 일은 "지역 카탈로그에서 이 분류가 차지하는 몫"을 뽑는 것까지다.
 * 몫을 어떻게 자를지는 {@link RegionChatPicker}가 정한다. 개수로 견주면
 * 카탈로그가 1,271곳인 제주시가 무엇으로 보든 1등이 된다(경주 622 · 남원 196).
 *
 * <h3>⚠️ 음식은 세지만 혼잡에는 넣지 않는다</h3>
 * 공사 집중률은 음식점을 예측하지 않는다({@code PlaceCategories.FORECAST_TARGETS}).
 * 그래도 "식도락에 강한 지역"을 가리는 데는 개수가 쓸 수 있는 사실이다 —
 * <b>세는 것과 혼잡을 매기는 것은 다른 일</b>이라 층을 갈라 둔다.
 */
public enum Interest {

	/** 음식. 카탈로그에서 가장 큰 분류라(경주 33.9% · 여수 44.9%) 지역 간 차이가 잘 보인다. */
	FOOD("음식", "FD"),

	/**
	 * 바다. <b>대분류가 아니라 중분류로 가른다.</b>
	 *
	 * <p>{@code NA}(자연·풍경) 하나로 보면 산·숲·해변이 한 덩어리라 "바다"를 물어도
	 * 내륙이 올라온다. 실측(2026-09-05)에서 {@code NA02}가 물가를 따로 담고 있었다 —
	 * 태안 66곳 · 제주시 56 · 서귀포 47 · 여수 37 · 통영 35인데 남원은 0곳이다.
	 *
	 * <p>⚠️ <b>엄밀히는 "바다"가 아니라 "물가"다.</b> 같은 코드에 호수도 들어 있다
	 * (춘천 소양호·의암호·춘천호, 가평 자라섬·청평호반, 충주 충주호). 다만 그 지역들의
	 * 몫이 0.7~2.1%로 작아, 비율로 자르면 바닷가 지역만 남는다 —
	 * <b>"바다"를 물었을 때 내륙이 올라오지는 않는다.</b> 반대로 "호수"만 콕 집어 물으면
	 * 이 문으로는 답하지 못하므로, 그 질문은 {@link #NATURE}로 간다
	 */
	WATER("바다", "NA", "NA02"),

	/** 자연. 산·숲·공원까지 포함한 넓은 문. 호수만 묻는 질문도 여기로 온다. */
	NATURE("자연", "NA"),

	/** 역사·유적. 경주 17.5% · 충주 26.6% · 남원 25.0%로 갈리는 분류다. */
	HISTORY("역사", "HS"),

	/** 문화·명소. 박물관·전망대·거리. */
	CULTURE("문화", "VE"),

	/** 레저·스포츠. */
	LEISURE("레저", "LS"),

	/** 체험. 공방·체험관. */
	EXPERIENCE("체험", "EX"),

	/** 쇼핑. 공사가 예측하는 쇼핑은 사실상 시장이다. */
	SHOPPING("쇼핑", "SH"),

	/**
	 * 관심사가 없는 질문. <b>"이번 주 어디가 제일 한산해요?"가 여기다.</b>
	 *
	 * <p>거를 것이 없다는 뜻이지 답할 수 없다는 뜻이 아니다 — 전 지역이 후보가 되고
	 * 한적한 정도만으로 고른다. 무관한 질문은 이 값이 아니라 <b>관련 없음</b>으로 갈린다.
	 */
	NONE("", null);

	private final String label;
	private final String largeCode;
	private final Set<String> subCodes;

	Interest(String label, String largeCode) {
		this(label, largeCode, null);
	}

	Interest(String label, String largeCode, String subCode) {
		this.label = label;
		this.largeCode = largeCode;
		this.subCodes = subCode == null ? Set.of() : Set.of(subCode);
	}

	/** 화면과 프롬프트가 함께 쓰는 이름. {@link #NONE}은 빈 문자열이다. */
	public String label() {
		return label;
	}

	/** 거를 것이 있는 관심사인가. {@code false}면 전 지역이 후보다. */
	public boolean filtersRegions() {
		return largeCode != null;
	}

	/**
	 * 이 장소가 관심사에 드는가.
	 *
	 * <p>중분류를 가진 관심사({@link #WATER})는 중분류까지 맞아야 한다. 대분류만 보는
	 * 관심사는 중분류를 묻지 않는다 — 넓은 문은 넓게 열려 있어야 한다.
	 */
	public boolean matches(PlaceCategory category) {
		if (category == null || largeCode == null) {
			return false;
		}
		if (!largeCode.equals(category.code())) {
			return false;
		}
		/*
		 * ⚠️ 중분류가 없는 장소가 실제로 있다 — 목업 카탈로그와 옛 데이터가 그렇다
		 * (PlaceCategory에 대분류만 받는 생성자가 따로 있다). Set.of(...)는 null을 물으면
		 * 던지므로 먼저 막는다. 좁은 문은 <b>중분류를 알 때만</b> 열린다.
		 */
		return subCodes.isEmpty()
				|| (category.subCode() != null && subCodes.contains(category.subCode()));
	}

	/** LLM 프롬프트에 적을 목록. 코드에서 만들어 <b>프롬프트와 enum이 갈라지지 않게</b> 한다. */
	public static String promptOptions() {
		StringBuilder options = new StringBuilder();
		for (Interest interest : values()) {
			if (interest == NONE) {
				continue;
			}
			if (!options.isEmpty()) {
				options.append(", ");
			}
			options.append(interest.name()).append('(').append(interest.label).append(')');
		}
		return options.toString();
	}

	/**
	 * 이름으로 찾는다. <b>모르는 값은 {@link #NONE}이다</b> — 예외가 아니다.
	 *
	 * <p>LLM이 목록에 없는 값을 지어낼 수 있다. 그때 오류를 던지면 화면이 죽는다.
	 * 관심사를 못 읽어도 "이번 주 한적한 곳"은 여전히 답할 수 있으므로 넓은 쪽으로 흘린다.
	 */
	public static Interest of(String name) {
		if (name == null || name.isBlank()) {
			return NONE;
		}
		for (Interest interest : values()) {
			if (interest.name().equalsIgnoreCase(name.trim())) {
				return interest;
			}
		}
		return NONE;
	}
}
