package com.peakoff.external.kto;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.peakoff.place.domain.Region;

/**
 * 우리 장소와 공사 집중률의 관광지를 <b>이름으로</b> 잇는다.
 *
 * <h3>왜 이름인가</h3>
 * 집중률 응답에 콘텐츠 ID가 없다. {@code tAtsNm} 문자열이 유일한 식별자다.
 * 국문 관광정보는 콘텐츠 ID로 도는데 두 API가 만나는 지점이 이름뿐이라,
 * <b>이 클래스가 이번 연동에서 가장 위험한 자리다.</b>
 *
 * <h3>잘못 이으면 무슨 일이 생기나</h3>
 * 다른 장소의 혼잡도를 그 장소의 것이라고 말하게 된다. 화면에는 아무 이상이 없어 보이고
 * 숫자도 그럴듯해서 <b>틀렸다는 사실 자체가 드러나지 않는다.</b>
 * 그래서 애매하면 잇지 않는다 — 못 이은 것은 "자료 없음"으로 정직하게 표시되지만,
 * 잘못 이은 것은 조용히 거짓말을 한다.
 *
 * <h3>실제 데이터가 이렇게 생겼다 (2026-08-21 경주 실측)</h3>
 * <ul>
 *   <li>{@code "경주 불국사 [유네스코 세계유산]"} — 지자체명 접두 + 대괄호 수식</li>
 *   <li>{@code "경주 무열왕릉, 태종무열왕릉비"} — 쉼표로 병기</li>
 *   <li>{@code "천마총(대릉원)"} — 소괄호로 상위 권역 표기</li>
 *   <li>{@code "경주월드 어뮤즈먼트"} — 접두가 아니라 이름의 일부인 "경주"</li>
 * </ul>
 * 마지막이 정규화를 조심스럽게 만든다. {@code "경주"}를 무턱대고 떼면 {@code "경주월드"}가
 * {@code "월드"}가 된다. 그래서 <b>뒤에 공백이 붙은 경우에만</b> 접두어로 본다.
 */
@Component
public class PlaceNameMatcher {

	/**
	 * 자동으로는 가릴 수 없어 사람이 정한 짝. <b>키는 정규화된 우리 장소명</b>이다.
	 *
	 * <p>규칙을 더 정교하게 만들어 자동으로 풀지 않는 이유: 규칙이 틀리면 어느 장소가
	 * 잘못 이어졌는지 알 수 없다. 표는 틀려도 어디가 틀렸는지 보인다. 경주가 69곳뿐이라
	 * 사람이 정하는 편이 정확하고, 심사에서 "어떻게 이었나요"에 이 표를 가리켜 답할 수 있다.
	 *
	 * <p>⚠️ 국문 관광정보가 붙으면 우리 장소명이 바뀐다. 그때 이 표를 다시 봐야 한다.
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
			"남산삼릉", "경주 남산");

	/**
	 * 우리 장소명에 맞는 공사 관광지명을 찾는다.
	 *
	 * @param placeName 우리 쪽 장소명
	 * @param region    지자체명 접두어를 떼는 데 쓴다
	 * @param apiNames  공사가 그 지역에서 예측을 제공하는 이름들
	 * @return 짝지어진 <b>공사 원문 이름</b>. 못 찾았거나 애매하면 빈 값
	 */
	public Optional<String> match(String placeName, Region region, Set<String> apiNames) {
		if (placeName == null || placeName.isBlank() || apiNames.isEmpty()) {
			return Optional.empty();
		}

		List<String> prefixes = prefixesOf(region);
		String target = normalize(placeName, prefixes);
		if (target.isEmpty()) {
			return Optional.empty();
		}

		String manual = MANUAL_LINKS.get(target);
		if (manual != null) {
			/*
			 * 표에 적힌 이름이 실제 응답에 없으면 잇지 않는다. 공사가 이름을 바꾸면
			 * 표가 낡는데, 그때 조용히 엉뚱한 곳으로 넘어가는 대신 "자료 없음"이 되어야 한다.
			 */
			return apiNames.contains(manual) ? Optional.of(manual) : Optional.empty();
		}

		Optional<String> exact = onlyOne(apiNames.stream()
				.filter(name -> normalize(name, prefixes).equals(target))
				.toList());
		if (exact.isPresent()) {
			return exact;
		}

		/*
		 * 포함 관계는 공사 이름이 더 긴 경우만 본다 — "대릉원" → "경주 대릉원 일원".
		 * 반대 방향(우리 이름이 더 긴 경우)까지 열면 "경주 남산 삼릉"이 "경주 남산"에 붙는데,
		 * 그건 상위 권역으로 넘어가는 것이라 사람이 정할 일이다. 그래서 위의 표로 뺐다.
		 */
		return onlyOne(apiNames.stream()
				.filter(name -> normalize(name, prefixes).contains(target))
				.toList());
	}

	/** 후보가 정확히 하나일 때만 답한다. 둘 이상이면 <b>고르지 않는다.</b> */
	private static Optional<String> onlyOne(List<String> candidates) {
		return candidates.size() == 1 ? Optional.of(candidates.getFirst()) : Optional.empty();
	}

	/**
	 * 비교할 수 있는 모양으로 다듬는다.
	 *
	 * <p>순서가 중요하다. 쉼표를 먼저 자르지 않으면 뒤에 붙은 병기 이름이 괄호 처리에 걸리고,
	 * 접두어를 공백 제거보다 먼저 떼지 않으면 "경주 불국사"가 "경주불국사"가 되어 안 떨어진다.
	 */
	private static String normalize(String raw, List<String> prefixes) {
		String text = raw.trim();

		// "경주 무열왕릉, 태종무열왕릉비" → 앞쪽만 쓴다
		int comma = text.indexOf(',');
		if (comma > 0) {
			text = text.substring(0, comma);
		}

		// "[유네스코 세계유산]", "(경북 동해안 국가지질공원)" 같은 수식을 뗀다.
		// "천마총(대릉원)"이 "천마총"이 되는 것도 여기다 — 괄호 안은 상위 권역이지 이름이 아니다.
		text = text.replaceAll("\\[[^\\]]*\\]", " ").replaceAll("\\([^)]*\\)", " ");

		// 지자체명은 <b>뒤에 공백이 있을 때만</b> 접두어다. "경주월드"를 "월드"로 만들지 않기 위해서다.
		for (String prefix : prefixes) {
			String withSpace = prefix + " ";
			if (text.startsWith(withSpace)) {
				text = text.substring(withSpace.length());
				break;
			}
		}

		return text.replaceAll("\\s+", "").toLowerCase();
	}

	/**
	 * 뗄 지자체명 후보. "경상북도 경주시" → {@code ["경주시", "경주"]}.
	 *
	 * <p>공사 데이터가 "경주 불국사"처럼 짧은 이름을 쓰기도 하고 "경주시"를 붙이기도 해서
	 * 둘 다 준비한다. 긴 쪽을 먼저 시도해야 "경주시"가 "시"를 남기지 않는다.
	 */
	private static List<String> prefixesOf(Region region) {
		String name = region.name();
		if (name == null || name.isBlank()) {
			return List.of();
		}
		String[] tokens = name.trim().split("\\s+");
		String last = tokens[tokens.length - 1];
		String trimmed = last.replaceAll("(시|군|구)$", "");
		return trimmed.isEmpty() || trimmed.equals(last) ? List.of(last) : List.of(last, trimmed);
	}
}
