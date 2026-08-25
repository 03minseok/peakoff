package com.peakoff.external.kto.support;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.peakoff.place.domain.Region;

/**
 * 공사 API 사이에서 같은 관광지를 <b>이름으로</b> 잇는다.
 *
 * <h3>왜 이름인가</h3>
 * API마다 식별자 체계가 다르다. 국문 관광정보는 콘텐츠 ID(숫자), 연관·중심 관광지는 32자
 * 해시를 쓰고, 집중률에는 <b>식별자가 아예 없고 이름뿐이다.</b> 셋이 만나는 지점이 이름밖에
 * 없어서, <b>이 클래스가 이 연동에서 가장 위험한 자리다.</b>
 *
 * <h3>잘못 이으면 무슨 일이 생기나</h3>
 * 다른 장소의 혼잡도를 그 장소의 것이라고 말하게 된다. 화면에는 아무 이상이 없어 보이고
 * 숫자도 그럴듯해서 <b>틀렸다는 사실 자체가 드러나지 않는다.</b>
 * 그래서 애매하면 잇지 않는다 — 못 이은 것은 "자료 없음"으로 정직하게 표시되지만,
 * 잘못 이은 것은 조용히 거짓말을 한다.
 *
 * <h3>표기가 세 갈래다 (2026-08-22 경주 실측)</h3>
 * <pre>
 *   국문 관광정보 · 집중률   "경주 불국사 [유네스코 세계유산]"   "경주 중앙시장"
 *   연관 · 중심 관광지       "불국사"                          "경주중앙시장"
 * </pre>
 * 같은 "경주"인데 한쪽은 띄어 쓰고 한쪽은 붙여 쓴다. 게다가 숙박은 {@code "한화리조트/경주"}
 * 처럼 슬래시로 지역을 붙인다.
 *
 * <h3>그래서 이름 하나를 여러 모양으로 펼쳐 견준다</h3>
 * 접두어를 무조건 떼면 {@code "경주월드"}가 {@code "월드"}가 되어 아무 데나 붙는다.
 * 반대로 안 떼면 {@code "경주중앙시장"}과 {@code "경주 중앙시장"}이 다른 이름이 된다.
 * 그래서 <b>뗀 것과 안 뗀 것을 모두 만들어 두고</b>, 양쪽 변형이 하나라도 정확히 겹치면 잇는다.
 * 정확히 겹치는 것이 없을 때만 포함 관계를 본다.
 */
@Component
public class PlaceNameMatcher {

	/**
	 * 지자체명을 떼고 남은 조각을 견주기에 쓸 최소 길이.
	 *
	 * <p>왜 이 값이 필요한지는 {@link #variantsOf}에 적어 두었다 — 한 글자로 줄어든 조각이
	 * 아무 이름에나 걸리는 것을 막는다.
	 */
	private static final int MIN_STRIPPED_LENGTH = 2;

	/**
	 * 자동으로는 가릴 수 없어 사람이 정한 짝. <b>키는 정규화된 이름</b>이다.
	 *
	 * <p>규칙을 더 정교하게 만들어 자동으로 풀지 않는 이유: 규칙이 틀리면 어느 장소가
	 * 잘못 이어졌는지 알 수 없다. 표는 틀려도 어디가 틀렸는지 보인다.
	 */
	private static final Map<String, String> MANUAL_LINKS = Map.of(
			/*
			 * 후보가 둘이다 — "경주 양남 주상절리 전망대"와
			 * "양남 주상절리군 (경북 동해안 국가지질공원)". 사람이 실제로 가는 곳은 전망대다.
			 */
			"양남주상절리", "경주 양남 주상절리 전망대",

			/*
			 * 삼릉만 따로 집계되지 않고 남산 권역으로 잡힌다.
			 * ⚠️ 정확히 같은 지점이 아니라 상위 권역이다. 근사값임을 분석 담당이 확인할 것.
			 */
			"남산삼릉", "경주 남산",

			/*
			 * "대릉원"으로는 후보가 둘 남는다 — "경주 대릉원 일원"과 "경주 대릉원돌담길 축제".
			 * 축제는 기간이 정해져 있어 코스에 담을 수 없으므로 일원이 맞다.
			 */
			"대릉원", "경주 대릉원 일원",

			/*
			 * "경주월드"는 놀이공원 본체·스노우파크·워터파크가 함께 잡힌다.
			 * 사람이 "경주월드"라고 할 때 뜻하는 곳은 놀이공원이다.
			 */
			"경주월드", "경주월드 어뮤즈먼트");

	/**
	 * 이름에 맞는 상대를 찾는다.
	 *
	 * @param name       찾을 이름 (어느 API의 표기든 상관없다)
	 * @param region     지자체명 접두·접미를 떼는 데 쓴다
	 * @param candidates 상대편 이름들
	 * @return 짝지어진 <b>상대편 원문 이름</b>. 못 찾았거나 애매하면 빈 값
	 */
	public Optional<String> match(String name, Region region, Set<String> candidates) {
		return match(name, region, candidates, candidate -> true);
	}

	/**
	 * 이름으로 찾되, <b>포함 매칭으로 걸린 후보는 부르는 쪽이 한 번 더 거른다.</b>
	 *
	 * <h3>왜 포함 매칭에만 거름망을 다는가</h3>
	 * 완전 일치는 이름이 같으니 더 볼 것이 없다. 위험한 것은 포함 매칭이다 —
	 * 한쪽이 다른 쪽을 품기만 하면 이어지므로 <b>이름만 닮은 다른 장소</b>가 걸린다.
	 * 5개 지역 실측(2026-08-25)에서 나온 것들이다:
	 *
	 * <pre>
	 * "월성원자력홍보관"   → "경주 월성(반월성)"      실제 거리 26.4km
	 * "경주 나정"          → "나정고운모래해변"        실제 거리 25.4km
	 * "플래시백 계림"      → "경주 계림"              실제 거리  6.6km
	 * "강릉아기동물농장"   → "대관령아기동물농장"      실제 거리  6.1km
	 * </pre>
	 *
	 * <p>이름 규칙을 아무리 정교하게 만들어도 이것들은 못 가른다. "나정"과
	 * "나정고운모래해변"은 글자로는 부모·자식처럼 보이고, 길이 비율로 잘라내려 하면
	 * "경주 남산 칠불암"처럼 <b>살려야 할 짝까지 함께 끊긴다.</b>
	 *
	 * <p>그래서 글자 대신 <b>좌표</b>로 가른다. 다만 이 클래스는 이름만 아는 자리라
	 * 판단을 밖에서 받는다 — 여기는 "누구와 누구가 닮았는가"까지만 답하고,
	 * "그 둘이 같은 곳일 수 있는가"는 좌표를 가진 쪽이 답한다.
	 *
	 * <h3>거름망은 열려 있는 쪽으로 실패해야 한다</h3>
	 * 상대 이름의 좌표를 알 수 없을 때는 통과시킨다. 집중률 응답에는 좌표가 없어서
	 * 우리 카탈로그에 같은 이름이 있을 때만 검증할 수 있는데(실측 126건 중 80건),
	 * 검증하지 못한 것을 끊어 버리면 <b>규칙이 아니라 자료 유무로 장소가 사라진다.</b>
	 *
	 * @param plausible 포함 매칭으로 걸린 상대 이름을 받아, 그 짝이 성립할 수 있으면 참.
	 *                  판단할 근거가 없으면 <b>참</b>을 돌려준다
	 */
	public Optional<String> match(String name, Region region, Set<String> candidates,
			Predicate<String> plausible) {
		if (name == null || name.isBlank() || candidates.isEmpty()) {
			return Optional.empty();
		}

		/*
		 * 0) 원문이 그대로 같은 것. 괄호를 떼기 전에 먼저 본다.
		 *
		 * 뒷단계는 괄호 안을 수식으로 보고 떼어내는데, 그것이 <b>이름의 일부</b>인 경우가 있다.
		 * 제주 "열안지오름(봉개동)"과 "열안지오름(오라동)"은 괄호를 떼면 둘 다 "열안지오름"이 되어
		 * 서로 충돌하고, 자기 자신이 후보에 있는데도 <b>둘 다 버려졌다.</b>
		 * 글자 하나 다르지 않은 짝을 정규화 때문에 놓치는 것은 어느 규칙으로도 변호할 수 없다.
		 */
		Optional<String> sameText = onlyOne(candidates.stream()
				.filter(candidate -> rawKey(candidate).equals(rawKey(name)))
				.toList());
		if (sameText.isPresent()) {
			return sameText;
		}

		List<String> regionWords = regionWordsOf(region);
		Set<String> targets = variantsOf(name, regionWords);
		if (targets.isEmpty()) {
			return Optional.empty();
		}

		String manual = MANUAL_LINKS.get(normalize(name, regionWords));
		if (manual != null) {
			/*
			 * 표에 적힌 이름이 실제 목록에 없으면 잇지 않는다. 공사가 이름을 바꾸면 표가 낡는데,
			 * 그때 조용히 엉뚱한 곳으로 넘어가는 대신 "자료 없음"이 되어야 한다.
			 */
			return candidates.contains(manual) ? Optional.of(manual) : Optional.empty();
		}

		// 1) 변형끼리 정확히 겹치는 것. 가장 안전하다.
		Optional<String> exact = onlyOne(candidates.stream()
				.filter(candidate -> !intersection(targets, variantsOf(candidate, regionWords)).isEmpty())
				.toList());
		if (exact.isPresent()) {
			return exact;
		}

		/*
		 * 2) 포함 관계. <b>어느 쪽이 길든 한쪽이 다른 쪽을 품으면 잇는다.</b>
		 *
		 * 처음에는 상대 이름이 더 긴 경우만 봤다("대릉원" → "경주 대릉원 일원").
		 * 우리 이름이 더 긴 쪽은 상위 권역으로 넘어가는 것이라 사람이 정할 일이라고 봤는데,
		 * 실제로 써 보니 <b>대릉원에서 대안이 하나도 안 나왔다.</b>
		 *
		 * 이 매처는 방향이 고정돼 있지 않다. 집중률·중심 관광지를 이을 때는 상대가 짧지만
		 * (우리 "경주 대릉원 일원" ← 상대 "대릉원"), 연관 관광지를 찾을 때는 우리가 길고
		 * 상대가 짧다. 한쪽만 열어 두면 그 방향에서만 동작한다.
		 *
		 * ⚠️ 대신 "경주 남산 삼릉" → "경주 남산"처럼 <b>상위 권역으로 넘어가는 근사 매칭</b>이
		 * 자동으로 일어난다. 정확히 같은 지점이 아니라 그 권역의 값을 쓰게 된다.
		 * 이 절충은 docs/OPEN_DECISIONS.md에 적어 두었다 — 실제 분포를 보고 다시 판단할 자리다.
		 *
		 * 안전장치는 셋이다 — <b>후보가 정확히 하나일 때만</b> 잇고, 지자체명을 뗀 조각이
		 * 너무 짧으면 그 조각으로는 견주지 않으며({@link #variantsOf}), 걸린 후보를
		 * 좌표로 한 번 더 거른다({@code plausible}).
		 * 애매하면 잇지 않는 원칙은 유지되고, 걱정되는 자리는 위의 수동 표가 먼저 잡는다.
		 */
		return onlyOne(candidates.stream()
				.filter(candidate -> eitherContains(targets, variantsOf(candidate, regionWords)))
				// 이름으로는 닮았다. 같은 곳일 수 있는지는 좌표를 가진 쪽이 답한다.
				.filter(plausible)
				.toList());
	}

	/**
	 * 두 이름의 변형들 중 <b>어느 한 쌍이라도</b> 한쪽이 다른 쪽을 품는가.
	 *
	 * <p>여기서도 {@link #variantsOf}가 만든 변형만 쓴다. 예전에는 이 자리에서
	 * {@code normalize}를 직접 불렀는데, 그러면 <b>짧은 조각을 버리는 규칙을 건너뛴다</b> —
	 * 완전 일치 단계에서는 "항"을 버려 놓고 포함 매칭에서 되살려 쓰는 셈이라,
	 * 규칙이 있으나 마나 한 상태가 된다. 실제로 "김녕항"이 "제주항"에 그대로 걸렸다.
	 */
	private static boolean eitherContains(Set<String> targets, Set<String> candidateVariants) {
		for (String target : targets) {
			for (String variant : candidateVariants) {
				String shorter = target.length() <= variant.length() ? target : variant;
				String longer = target.length() <= variant.length() ? variant : target;
				if (longer.contains(shorter)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * 정규화를 거친 이름. <b>같은 장소인지 밖에서 견줄 때 쓴다.</b>
	 *
	 * <p>이 규칙을 밖으로 여는 이유: 좌표 검증을 하려면 "집중률이 부르는 그 이름이 우리
	 * 카탈로그의 어느 장소인가"를 먼저 찾아야 하는데, 그 비교를 부르는 쪽이 자기 식으로
	 * 하면 여기와 다른 규칙이 하나 더 생긴다. 정규화는 이 파일에만 있어야 한다.
	 */
	public String normalized(String name, Region region) {
		return name == null ? "" : normalize(name, regionWordsOf(region));
	}

	/**
	 * 정규화 전의 이름을 검색어로 쓸 수 있게만 다듬는다. 괄호·수식은 그대로 둔다.
	 *
	 * <p>{@link #normalize}와 달리 <b>거의 아무것도 지우지 않는다.</b> 이것은 견주기 위한
	 * 모양이 아니라 카탈로그에서 후보를 <b>불러오기 위한</b> 모양이다.
	 */
	public static String searchKeyword(String name) {
		if (name == null) {
			return "";
		}
		String text = name.trim();
		int comma = text.indexOf(',');
		if (comma > 0) {
			text = text.substring(0, comma);
		}
		text = BRACKETS.matcher(text).replaceAll(" ");
		text = PARENS.matcher(text).replaceAll(" ");
		return SPACES.matcher(text).replaceAll(" ").trim();
	}

	/** 원문 비교용 열쇠. 공백과 대소문자만 없앤다 — 괄호도 수식도 그대로 둔다. */
	private static String rawKey(String raw) {
		return SPACES.matcher(raw.trim()).replaceAll("").toLowerCase();
	}

	/** 후보가 정확히 하나일 때만 답한다. 둘 이상이면 <b>고르지 않는다.</b> */
	private static Optional<String> onlyOne(List<String> candidates) {
		return candidates.size() == 1 ? Optional.of(candidates.getFirst()) : Optional.empty();
	}

	private static Set<String> intersection(Set<String> a, Set<String> b) {
		Set<String> copy = new LinkedHashSet<>(a);
		copy.retainAll(b);
		return copy;
	}

	/**
	 * 이름 하나를 견줄 수 있는 여러 모양으로 펼친다.
	 *
	 * <p>지자체명을 뗀 것과 안 뗀 것을 모두 만든다. 어느 API가 어느 표기를 쓰는지 미리 알 수
	 * 없고, 앞으로 늘어날 지역에서도 규칙이 같으리라는 보장이 없어서다.
	 *
	 * <h3>⚠️ 지자체명을 떼고 남은 조각이 너무 짧으면 버린다</h3>
	 * 지역명이 이름의 <b>일부</b>인 장소가 있다. 그런 이름에서 지역명을 떼면 남는 것이
	 * 뜻 없는 한 글자가 되고, 그 한 글자가 포함 매칭에서 <b>아무 이름에나 걸린다.</b>
	 *
	 * <pre>
	 * "제주항" → "항"    "스타벅스 제주공항DT점"·"항몽유적지"·"김녕항"·"한림항" 이 전부 제주항이 됐다
	 * "강릉항" → "항"    "교항면옥"·"옥계항"·"안목항물회"가 전부 강릉항이 됐다
	 * </pre>
	 *
	 * <p>실측(2026-08-25)에서 제주시 한 곳만 34건이 이 경로로 잘못 이어져 있었다.
	 * 뗀 조각이 두 글자가 안 되면 <b>그 조각으로는 견주지 않는다</b> — 지역명을 붙여 쓴
	 * 원래 이름("제주항")은 그대로 남아 있으므로, 진짜 제주항을 찾는 데는 지장이 없다.
	 */
	private static Set<String> variantsOf(String raw, List<String> regionWords) {
		Set<String> variants = new LinkedHashSet<>();
		String full = normalize(raw, List.of());
		if (!full.isEmpty()) {
			variants.add(full);
		}
		String stripped = normalize(raw, regionWords);
		if (!stripped.isEmpty() && (stripped.equals(full) || stripped.length() >= MIN_STRIPPED_LENGTH)) {
			variants.add(stripped);
		}
		return variants;
	}

	/**
	 * 비교할 수 있는 모양으로 다듬는다.
	 *
	 * <p>순서가 중요하다. 쉼표를 먼저 자르지 않으면 뒤에 붙은 병기 이름이 괄호 처리에 걸리고,
	 * 지자체명을 공백 제거보다 먼저 떼지 않으면 붙여 쓴 것과 띄어 쓴 것이 갈린다.
	 *
	 * @param regionWords 뗄 지자체명. 비우면 떼지 않는다
	 */
	/*
	 * 정규식을 미리 컴파일해 둔다.
	 *
	 * String.replaceAll은 <b>부를 때마다 패턴을 새로 컴파일한다.</b> 이 메서드는 이름을 견줄
	 * 때마다 후보 하나당 두 번씩 불리는데, 대안 추천 한 번이면 후보 621곳을 수십 번 훑는다 —
	 * 매치 한 번에 컴파일이 3,700번 돌았고 그것이 응답 시간의 대부분이었다.
	 *
	 * 결과는 한 글자도 달라지지 않는다. 같은 일을 같은 규칙으로 하되 준비를 한 번만 할 뿐이다.
	 */
	private static final Pattern BRACKETS = Pattern.compile("\\[[^\\]]*\\]");
	private static final Pattern PARENS = Pattern.compile("\\([^)]*\\)");
	private static final Pattern SPACES = Pattern.compile("\\s+");

	private static String normalize(String raw, List<String> regionWords) {
		String text = raw.trim();

		// "경주 무열왕릉, 태종무열왕릉비" → 앞쪽만 쓴다
		int comma = text.indexOf(',');
		if (comma > 0) {
			text = text.substring(0, comma);
		}

		// "[유네스코 세계유산]", "(경북 동해안 국가지질공원)" 같은 수식을 뗀다.
		// "천마총(대릉원)"이 "천마총"이 되는 것도 여기다 — 괄호 안은 상위 권역이지 이름이 아니다.
		text = BRACKETS.matcher(text).replaceAll(" ");
		text = PARENS.matcher(text).replaceAll(" ");

		// 슬래시는 붙임표다. 숙박이 "한화리조트/경주"처럼 지역을 이어 붙인다.
		text = text.replace('/', ' ').replace('·', ' ');

		String squeezed = SPACES.matcher(text).replaceAll("").toLowerCase();

		for (String word : regionWords) {
			if (squeezed.length() > word.length() && squeezed.startsWith(word)) {
				squeezed = squeezed.substring(word.length());
				break;
			}
		}
		for (String word : regionWords) {
			if (squeezed.length() > word.length() && squeezed.endsWith(word)) {
				squeezed = squeezed.substring(0, squeezed.length() - word.length());
				break;
			}
		}
		return squeezed;
	}

	/**
	 * 뗄 지자체명 후보. "경상북도 경주시" → {@code ["경주시", "경주"]}.
	 *
	 * <p>긴 쪽을 먼저 시도해야 "경주시"가 "시"를 남기지 않는다.
	 */
	private static List<String> regionWordsOf(Region region) {
		String name = region == null ? null : region.name();
		if (name == null || name.isBlank()) {
			return List.of();
		}
		String[] tokens = name.trim().split("\\s+");
		String last = tokens[tokens.length - 1].toLowerCase();
		String trimmed = last.replaceAll("(시|군|구)$", "");
		return trimmed.isEmpty() || trimmed.equals(last) ? List.of(last) : List.of(last, trimmed);
	}
}
