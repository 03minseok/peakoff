package com.peakoff.external.kto.support;

import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.peakoff.place.domain.Region;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 이름 매칭 규칙을 잠근다.
 *
 * <p>여기에 테스트를 두는 이유: <b>잘못 이으면 화면이 조용히 거짓말을 한다.</b> 다른 장소의
 * 혼잡도를 그 장소의 것이라고 말하는데, 숫자가 그럴듯해서 틀렸다는 사실 자체가 드러나지 않는다.
 * 규칙이 나중에 느슨해져도 사람 눈에는 안 보이므로 테스트가 대신 지킨다.
 *
 * <p>아래 사례는 전부 <b>실측에서 나온 것</b>이다(경주·제주시·서귀포시·종로구·강릉시,
 * 2026-08-25). 지어낸 입력이 아니라 실제로 잘못 이어져 있던 짝들이다.
 */
class PlaceNameMatcherTest {

	private final PlaceNameMatcher matcher = new PlaceNameMatcher();

	private static final Region GYEONGJU = new Region("4713000000", "경상북도 경주시");
	private static final Region JEJU = new Region("5011000000", "제주특별자치도 제주시");

	@Nested
	@DisplayName("원문이 그대로 같으면 정규화보다 먼저 본다")
	class RawText {

		/**
		 * 괄호를 떼면 둘 다 "열안지오름"이 되어 서로 충돌하고, 자기 자신이 후보에 있는데도
		 * 둘 다 버려졌다. 글자 하나 다르지 않은 짝을 놓치는 것은 변호할 수 없다.
		 */
		@Test
		void 괄호까지_같은_이름은_충돌_없이_자기_자신을_찾는다() {
			Set<String> candidates = Set.of("열안지오름(봉개동)", "열안지오름(오라동)");

			assertThat(matcher.match("열안지오름(봉개동)", JEJU, candidates))
					.contains("열안지오름(봉개동)");
			assertThat(matcher.match("열안지오름(오라동)", JEJU, candidates))
					.contains("열안지오름(오라동)");
		}

		@Test
		void 공백과_대소문자만_다른_것은_같은_원문으로_본다() {
			assertThat(matcher.match("경주 불국사", GYEONGJU, Set.of("경주불국사")))
					.contains("경주불국사");
		}
	}

	@Nested
	@DisplayName("지자체명을 떼고 남은 조각이 한 글자면 그 조각으로 견주지 않는다")
	class StrippedFragment {

		/**
		 * "제주항"에서 "제주"를 떼면 "항"이 남는다. 그 한 글자가 포함 매칭에서 아무 이름에나
		 * 걸려, 제주시 한 곳에서만 34건이 잘못 이어져 있었다.
		 */
		@Test
		void 항이라는_조각이_다른_항구와_식당을_삼키지_않는다() {
			Set<String> forecast = Set.of("제주항");

			assertThat(matcher.match("김녕항", JEJU, forecast)).isEmpty();
			assertThat(matcher.match("한림항", JEJU, forecast)).isEmpty();
			assertThat(matcher.match("항몽유적지", JEJU, forecast)).isEmpty();
			assertThat(matcher.match("스타벅스 제주공항DT점", JEJU, forecast)).isEmpty();
		}

		/** 조각을 버려도 지역명을 붙인 원래 이름은 남아 있으므로, 진짜 제주항은 그대로 찾는다. */
		@Test
		void 진짜_제주항은_여전히_이어진다() {
			assertThat(matcher.match("제주항", JEJU, Set.of("제주항"))).contains("제주항");
		}
	}

	@Nested
	@DisplayName("이름이 닮아도 좌표가 멀면 잇지 않는다")
	class GeoCheck {

		/** 실제 거리 26.4km. 원자력홍보관이 신라 왕궁터의 혼잡도를 받고 있었다. */
		@Test
		void 좌표_검증이_거부하면_이어지지_않는다() {
			Optional<String> matched = matcher.match(
					"월성원자력홍보관", GYEONGJU, Set.of("경주 월성(반월성)"), candidate -> false);

			assertThat(matched).isEmpty();
		}

		@Test
		void 좌표_검증이_통과시키면_이어진다() {
			Optional<String> matched = matcher.match(
					"경주 남산 칠불암 마애불상군", GYEONGJU, Set.of("경주 남산"), candidate -> true);

			assertThat(matched).contains("경주 남산");
		}

		/**
		 * 완전 일치는 거름망을 타지 않는다. 이름이 같은 것을 좌표로 되돌릴 이유가 없고,
		 * 되돌리면 정상 매칭이 자료 유무에 따라 사라진다.
		 */
		@Test
		void 완전_일치는_좌표_검증을_거치지_않는다() {
			Optional<String> matched = matcher.match(
					"경주 불국사", GYEONGJU, Set.of("경주 불국사"), candidate -> false);

			assertThat(matched).contains("경주 불국사");
		}

		/** 거름망을 주지 않는 호출은 예전과 똑같이 동작한다. */
		@Test
		void 거름망을_주지_않으면_포함_매칭이_그대로_산다() {
			assertThat(matcher.match("경주 대릉원 일원", GYEONGJU, Set.of("대릉원")))
					.contains("대릉원");
		}
	}

	@Nested
	@DisplayName("기존 규칙은 그대로다")
	class Unchanged {

		@Test
		void 후보가_둘이면_고르지_않는다() {
			assertThat(matcher.match("소금강", new Region("5115000000", "강원특별자치도 강릉시"),
					Set.of("소금강장천마을", "오대산 소금강계곡"))).isEmpty();
		}

		@Test
		void 수동_표에_적힌_이름이_목록에_없으면_잇지_않는다() {
			assertThat(matcher.match("대릉원", GYEONGJU, Set.of("경주 대릉원돌담길 축제"))).isEmpty();
		}

		@Test
		void 수동_표는_후보가_여럿이어도_사람이_정한_쪽을_고른다() {
			assertThat(matcher.match("대릉원", GYEONGJU,
					Set.of("경주 대릉원 일원", "경주 대릉원돌담길 축제"))).contains("경주 대릉원 일원");
		}

		@Test
		void 슬래시로_지역을_붙인_숙박_표기를_읽는다() {
			assertThat(matcher.match("한화리조트/경주", GYEONGJU, Set.of("한화리조트 경주")))
					.contains("한화리조트 경주");
		}
	}
}
