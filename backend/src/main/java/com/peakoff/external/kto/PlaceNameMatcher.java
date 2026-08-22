package com.peakoff.external.kto;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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
		if (name == null || name.isBlank() || candidates.isEmpty()) {
			return Optional.empty();
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
		 * 2) 포함 관계. 상대 이름이 더 긴 경우만 본다 — "대릉원" → "경주 대릉원 일원".
		 *
		 * 접두어를 뗀 짧은 변형으로는 견주지 않는다. "월드" 같은 조각이 아무 데나 걸린다.
		 * 반대 방향(우리 이름이 더 긴 경우)도 열지 않는다 — 그건 상위 권역으로 넘어가는
		 * 것이라 사람이 정할 일이다.
		 */
		String full = normalize(name, List.of());
		return onlyOne(candidates.stream()
				.filter(candidate -> normalize(candidate, List.of()).contains(full)
						|| normalize(candidate, regionWords).contains(normalize(name, regionWords)))
				.toList());
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
	 */
	private static Set<String> variantsOf(String raw, List<String> regionWords) {
		Set<String> variants = new LinkedHashSet<>();
		String full = normalize(raw, List.of());
		if (!full.isEmpty()) {
			variants.add(full);
		}
		String stripped = normalize(raw, regionWords);
		if (!stripped.isEmpty()) {
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
	private static String normalize(String raw, List<String> regionWords) {
		String text = raw.trim();

		// "경주 무열왕릉, 태종무열왕릉비" → 앞쪽만 쓴다
		int comma = text.indexOf(',');
		if (comma > 0) {
			text = text.substring(0, comma);
		}

		// "[유네스코 세계유산]", "(경북 동해안 국가지질공원)" 같은 수식을 뗀다.
		// "천마총(대릉원)"이 "천마총"이 되는 것도 여기다 — 괄호 안은 상위 권역이지 이름이 아니다.
		text = text.replaceAll("\\[[^\\]]*\\]", " ").replaceAll("\\([^)]*\\)", " ");

		// 슬래시는 붙임표다. 숙박이 "한화리조트/경주"처럼 지역을 이어 붙인다.
		text = text.replace('/', ' ').replace('·', ' ');

		String squeezed = text.replaceAll("\\s+", "").toLowerCase();

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
