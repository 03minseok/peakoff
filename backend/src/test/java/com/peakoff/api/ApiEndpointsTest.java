package com.peakoff.api;

import static org.assertj.core.api.Assertions.assertThat;
// 목업 값이 두 날짜에 우연히 같아지면 아래 평균 검증이 아무것도 증명하지 못한다. 그때는 건너뛴다.
import static org.assertj.core.api.Assumptions.assumeThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.peakoff.support.IntegrationTest;

@IntegrationTest
class ApiEndpointsTest {

	@Autowired
	private MockMvc mockMvc;

	@Nested
	@DisplayName("GET /api/places")
	class Places {

		/**
		 * 검색어 없이 물으면 대표 관광지가 온다. 지역 전체가 아니다 —
		 * 경주만 621곳이고 지역이 늘면 화면에 늘어놓을 수 있는 양이 아니다.
		 */
		@Test
		@DisplayName("검색어가 없으면 대표 관광지를 공통 응답 포맷으로 돌려준다")
		void returnsRepresentativePlaces() throws Exception {
			mockMvc.perform(get("/api/places").param("region", "gyeongju").param("limit", "5"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.success").value(true))
					.andExpect(jsonPath("$.data.length()").value(5))
					.andExpect(jsonPath("$.data[0].id").isNotEmpty())
					.andExpect(jsonPath("$.data[0].categoryName").isNotEmpty())
					// 성공 응답에는 error 키가 아예 없어야 한다
					.andExpect(jsonPath("$.error").doesNotExist());
		}

		@Test
		@DisplayName("검색어를 주면 이름에 그 말이 든 곳만 나온다")
		void searchesByKeyword() throws Exception {
			mockMvc.perform(get("/api/places")
					.param("region", "gyeongju")
					.param("keyword", "불국"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.length()").value(org.hamcrest.Matchers.greaterThan(0)))
					.andExpect(jsonPath("$.data[*].name")
							.value(org.hamcrest.Matchers.everyItem(
									org.hamcrest.Matchers.containsString("불국"))));
		}

		@Test
		@DisplayName("찾는 곳이 없으면 빈 목록 — 검색은 못 찾는 것도 정상적인 결과다")
		void emptySearchResultIsNotAnError() throws Exception {
			mockMvc.perform(get("/api/places")
					.param("region", "gyeongju")
					.param("keyword", "존재하지않는장소이름"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.length()").value(0));
		}

		@Test
		@DisplayName("지원하지 않는 지역은 400과 함께 지원 목록을 알려준다")
		void rejectsUnsupportedRegion() throws Exception {
			mockMvc.perform(get("/api/places").param("region", "busan"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.success").value(false))
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
					.andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("gyeongju")))
					.andExpect(jsonPath("$.data").doesNotExist());
		}

		@Test
		@DisplayName("region 파라미터가 없으면 400")
		void requiresRegionParam() throws Exception {
			mockMvc.perform(get("/api/places"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
		}
	}

	@Nested
	@DisplayName("GET /api/places/{id}/alternatives")
	class Alternatives {

		@Test
		@DisplayName("대안 후보에 한적도·추천도·근거·구성 내역이 모두 담긴다")
		void returnsAlternativesWithReason() throws Exception {
			mockMvc.perform(get("/api/places/mock-bulguksa/alternatives")
					.param("date", "2026-09-16")
					.param("limit", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.status").value("RECOMMENDED"))
					// 추천이 있으면 덧붙일 말이 없다. 목록 자체가 답이다.
					.andExpect(jsonPath("$.data.statusMessage").doesNotExist())
					// 후보의 절대 점수만으로는 "지금보다 나은가"를 알 수 없다.
					.andExpect(jsonPath("$.data.originQuietness").isNumber())
					// 임계값은 서버가 내려보낸다. 화면에 숫자를 박으면 한쪽만 바뀐다.
					.andExpect(jsonPath("$.data.minQuietnessGain").isNumber())
					.andExpect(jsonPath("$.data.alternatives.length()").value(3))
					.andExpect(jsonPath("$.data.alternatives[0].quietness").isNumber())
					.andExpect(jsonPath("$.data.alternatives[0].recommendation").isNumber())
					.andExpect(jsonPath("$.data.alternatives[0].levelLabel").isNotEmpty())
					.andExpect(jsonPath("$.data.alternatives[0].reason")
							.value(org.hamcrest.Matchers.startsWith("불국사 근처의 비슷한 곳 중에서")))
					// 추천도가 어떻게 나왔는지 화면에서 설명할 수 있어야 한다.
					.andExpect(jsonPath("$.data.alternatives[0].factors[0].label").value("한적도"))
					.andExpect(jsonPath("$.data.alternatives[0].factors[0].score").isNumber())
					.andExpect(jsonPath("$.data.alternatives[0].factors[0].weightPercent").isNumber())
					/*
					 * 한적도에는 근거가 없다. "예상 혼잡 낮음"은 점수를 말로 옮긴 것이라
					 * 새로 알려주는 것이 없어 걷어냈다(ScoreFactor.detail 주석).
					 * 근거가 남아 있는 것은 원자료를 담은 항목뿐이다 — 근접도의 직선거리.
					 */
					.andExpect(jsonPath("$.data.alternatives[0].factors[0].detail").doesNotExist())
					.andExpect(jsonPath("$.data.alternatives[0].factors[1].label").value("동선 근접도"))
					.andExpect(jsonPath("$.data.alternatives[0].factors[1].detail").isNotEmpty());
		}

		/**
		 * 하한이 생기면서 목록이 비는 일이 흔해졌다. 빈 목록이 <b>왜</b> 비었는지를
		 * 함께 내려보내지 않으면 화면은 "데이터가 부실하다"로만 말하게 된다.
		 */
		@Test
		@DisplayName("추천할 것이 없어도 이유가 함께 온다")
		void emptyListCarriesItsReason() throws Exception {
			// 음식점은 공사 예측 대상이 아니라 개선폭을 잴 기준 자체가 없다.
			mockMvc.perform(get("/api/places/mock-gyorigimbap/alternatives")
					.param("date", "2026-09-16"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.status").isNotEmpty())
					.andExpect(jsonPath("$.data.minQuietnessGain").isNumber());
		}

		@Test
		@DisplayName("없는 장소는 404")
		void unknownPlaceReturns404() throws Exception {
			mockMvc.perform(get("/api/places/없는장소/alternatives").param("date", "2026-09-16"))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
		}

		@Test
		@DisplayName("날짜 형식이 틀리면 400")
		void malformedDateReturns400() throws Exception {
			mockMvc.perform(get("/api/places/mock-bulguksa/alternatives").param("date", "9월16일"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
		}
	}

	@Nested
	@DisplayName("POST /api/courses/diagnose")
	class Diagnose {

		private static final String COURSE_JSON = """
				{
				  "region": "gyeongju",
				  "startDate": "2026-09-16",
				  "nights": 1,
				  "slots": [
				    { "day": 1, "order": 1, "placeId": "mock-bulguksa" },
				    { "day": 1, "order": 2, "placeId": "mock-seokguram" },
				    { "day": 2, "order": 1, "placeId": "mock-yangdong" }
				  ]
				}
				""";

		@Test
		@DisplayName("슬롯마다 한적도·등급이 붙고 코스 총점이 나온다")
		void diagnosesCourse() throws Exception {
			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content(COURSE_JSON))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.days").value(2))
					.andExpect(jsonPath("$.data.endDate").value("2026-09-17"))
					.andExpect(jsonPath("$.data.totalQuietness").isNumber())
					.andExpect(jsonPath("$.data.totalLevelLabel").isNotEmpty())
					.andExpect(jsonPath("$.data.slots.length()").value(3))
					// 2일차 슬롯은 시작일 다음 날 기준으로 진단돼야 한다
					.andExpect(jsonPath("$.data.slots[2].visitDate").value("2026-09-17"))
					.andExpect(jsonPath("$.data.slots[0].level").isNotEmpty());
		}

		@Test
		@DisplayName("장소가 없는 코스는 400")
		void emptyCourseReturns400() throws Exception {
			String json = """
					{ "region": "gyeongju", "startDate": "2026-09-16", "nights": 0, "slots": [] }
					""";

			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
		}

		@Test
		@DisplayName("여행 기간을 벗어난 일차는 도메인 검증에 걸려 400")
		void slotOutsidePeriodReturns400() throws Exception {
			String json = """
					{
					  "region": "gyeongju", "startDate": "2026-09-16", "nights": 0,
					  "slots": [ { "day": 5, "order": 1, "placeId": "mock-bulguksa" } ]
					}
					""";

			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("5일차")));
		}

		@Test
		@DisplayName("본문이 깨져 있으면 자바 타입명이 아니라 읽을 수 있는 메시지로 400")
		void malformedBodyReturnsReadableMessage() throws Exception {
			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{ not json"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.message").value("요청 형식이 올바르지 않습니다."));
		}

		@Test
		@DisplayName("빈 placeId는 404가 아니라 400 — 없는 자원이 아니라 잘못된 요청이다")
		void blankPlaceIdIsBadRequestNotNotFound() throws Exception {
			String json = """
					{
					  "region": "gyeongju", "startDate": "2026-09-16", "nights": 0,
					  "slots": [ { "day": 1, "order": 1, "placeId": "" } ]
					}
					""";

			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
					// 목록 안쪽 원소까지 검사되므로 어느 슬롯인지 경로로 드러난다
					.andExpect(jsonPath("$.error.fields[0].field").value("slots[0].placeId"));
		}

		@Test
		@DisplayName("여러 필드가 틀리면 전부 알려준다 — 화면에서 각 입력칸을 짚을 수 있게")
		void reportsEveryInvalidField() throws Exception {
			String json = """
					{ "region": "", "startDate": null, "nights": -5, "slots": [] }
					""";

			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.fields.length()").value(4))
					.andExpect(jsonPath("$.error.fields[*].field")
							.value(org.hamcrest.Matchers.containsInAnyOrder(
									"region", "startDate", "nights", "slots")));
		}
	}

	@Nested
	@DisplayName("POST /api/courses/recommend")
	class Recommend {

		private static final String SURVEY_JSON = """
				{
				  "region": "gyeongju",
				  "startDate": "2026-09-16",
				  "nights": 1,
				  "density": "BALANCED",
				  "sensitivity": "QUIET"
				}
				""";

		@Test
		@DisplayName("설문 답으로 코스 초안을 만들고 슬롯마다 근거를 함께 준다")
		void buildsDraftWithReasons() throws Exception {
			mockMvc.perform(post("/api/courses/recommend")
					.contentType(MediaType.APPLICATION_JSON)
					.content(SURVEY_JSON))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.days").value(2))
					.andExpect(jsonPath("$.data.endDate").value("2026-09-17"))
					.andExpect(jsonPath("$.data.totalQuietness").isNumber())
					.andExpect(jsonPath("$.data.slots.length()").value(org.hamcrest.Matchers.greaterThan(0)))
					// 진단 화면과 슬롯 모양을 맞춰, 프론트가 타임라인 컴포넌트를 재사용할 수 있게 한다.
					.andExpect(jsonPath("$.data.slots[0].visitDate").value("2026-09-16"))
					.andExpect(jsonPath("$.data.slots[0].levelLabel").isNotEmpty())
					// 왜 이 장소인지가 반드시 함께 나가야 한다.
					.andExpect(jsonPath("$.data.slots[0].reason").isNotEmpty())
					.andExpect(jsonPath("$.data.slots[0].recommendation").isNumber())
					.andExpect(jsonPath("$.data.slots[0].factors[0].label").value("한적도"))
					.andExpect(jsonPath("$.data.slots[0].factors[0].weightPercent").isNumber());
		}

		@Test
		@DisplayName("게스트도 쓸 수 있다 — 경주를 모르는 사용자의 진입점이라 로그인 뒤에 두지 않는다")
		void guestCanUseIt() throws Exception {
			mockMvc.perform(post("/api/courses/recommend")
					.contentType(MediaType.APPLICATION_JSON)
					.content(SURVEY_JSON))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("설문 답을 빠뜨리면 400 — 어느 칸인지 함께 알려준다")
		void requiresEveryAnswer() throws Exception {
			String json = """
					{
					  "region": "gyeongju", "startDate": "2026-09-16", "nights": 0,
					  "sensitivity": "MIXED"
					}
					""";

			mockMvc.perform(post("/api/courses/recommend")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
					.andExpect(jsonPath("$.error.fields[0].field").value("density"));
		}

		@Test
		@DisplayName("없는 설문 답을 보내면 자바 타입명이 아니라 읽을 수 있는 메시지로 400")
		void rejectsUnknownAnswer() throws Exception {
			String json = """
					{
					  "region": "gyeongju", "startDate": "2026-09-16", "nights": 0,
					  "density": "초고속",
					  "sensitivity": "MIXED"
					}
					""";

			mockMvc.perform(post("/api/courses/recommend")
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.message").value("요청 형식이 올바르지 않습니다."));
		}
	}

	@Nested
	@DisplayName("GET /api/dates/alternatives")
	class DateAlternatives {

		@Test
		@DisplayName("기준 날짜 앞뒤 range일을 날짜순으로 돌려준다 — 지난 날짜도 포함")
		void returnsWindowAroundDate() throws Exception {
			// range=3이면 앞 3일 + 뒤 3일 = 7일 창에서 기준일을 뺀 6개
			mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.selectedDate").value("2026-09-12"))
					.andExpect(jsonPath("$.data.options.length()").value(6))
					// 날짜순이라 첫 줄이 기준일보다 3일 <b>앞</b>이어야 한다
					.andExpect(jsonPath("$.data.options[0].date").value("2026-09-09"))
					.andExpect(jsonPath("$.data.options[5].date").value("2026-09-15"));
		}

		@Test
		@DisplayName("더 붐비는 날도 담는다 — 되돌아갈 날짜와 비교 대상이 목록에 있어야 한다")
		void includesWorseDates() throws Exception {
			// 수요일(평일 보정을 받은 날)을 기준으로 잡으면 주말이 창에 들어와 개선폭이 음수가 된다
			String body = mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("date", "2026-09-16")
					.param("range", "3"))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString();

			assertThat(body).contains("\"improvement\":-");
		}

		@Test
		@DisplayName("토요일을 고르면 더 한적한 평일이 창 안에 있다")
		void suggestsQuieterDates() throws Exception {
			String body = mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.bestDate").isNotEmpty())
					.andReturn().getResponse().getContentAsString();

			List<Integer> improvements =
					com.jayway.jsonpath.JsonPath.read(body, "$.data.options[*].improvement");

			assertThat(improvements).anyMatch(value -> value != null && value > 0);
		}

		@Test
		@DisplayName("방문 여러 개를 넘기면 코스 전체 기준으로 계산한다")
		void acceptsMultiplePlaces() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("slot", "2:mock-yangdong")
					.param("date", "2026-09-12")
					.param("range", "7"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.selectedQuietness").isNumber());
		}

		/**
		 * 2단계의 핵심 규칙이다. 예전에는 장소만 평평하게 받아 <b>모든 곳을 시작일 하루로</b>
		 * 계산했고, 그래서 여러 날 일정에서 진단 화면과 날짜 대안의 숫자가 어긋났다.
		 *
		 * <p>특정 숫자를 못박지 않는 이유: 목업 값이 바뀌면 그런 테스트는 의미 없이 깨진다.
		 * 여기서는 <b>"2일차를 D에 두는 것"과 "1일차를 D+1에 두는 것"이 같아야 한다</b>는
		 * 관계만 확인한다. 이 관계는 어느 데이터 원천을 붙여도 성립해야 한다.
		 */
		@Test
		@DisplayName("2일차 방문은 시작일 다음 날로 계산된다")
		void secondDayUsesNextDate() throws Exception {
			int asSecondDay = selectedQuietnessOf("2:mock-bulguksa", "2026-09-12");
			int asFirstDayNextDate = selectedQuietnessOf("1:mock-bulguksa", "2026-09-13");

			assertThat(asSecondDay).isEqualTo(asFirstDayNextDate);
		}

		/**
		 * 같은 곳을 이틀 들르면 두 번 센다.
		 *
		 * <p>중복을 합치면 그 장소가 한 번만 반영돼 코스 평균이 실제 일정과 달라진다.
		 * 1일차와 2일차의 값이 다르므로, 둘을 함께 넘긴 평균은 어느 한쪽과도 같지 않아야 한다.
		 */
		@Test
		@DisplayName("같은 장소를 여러 날 들르면 날짜마다 따로 센다")
		void countsRepeatVisitsSeparately() throws Exception {
			int firstDayOnly = selectedQuietnessOf("1:mock-bulguksa", "2026-09-11");
			int secondDayOnly = selectedQuietnessOf("2:mock-bulguksa", "2026-09-11");
			assumeThat(firstDayOnly).isNotEqualTo(secondDayOnly);

			int both = com.jayway.jsonpath.JsonPath.read(
					mockMvc.perform(get("/api/dates/alternatives")
							.param("slot", "1:mock-bulguksa")
							.param("slot", "2:mock-bulguksa")
							.param("date", "2026-09-11")
							.param("range", "3"))
							.andExpect(status().isOk())
							.andReturn().getResponse().getContentAsString(),
					"$.data.selectedQuietness");

			assertThat(both).isEqualTo(Math.round((firstDayOnly + secondDayOnly) / 2.0f));
		}

		@Test
		@DisplayName("일차 없이 장소만 넘기면 400 — 형식을 알려준다")
		void rejectsSlotWithoutDay() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "3"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.message").value(
							org.hamcrest.Matchers.containsString("일차:장소ID")));
		}

		private int selectedQuietnessOf(String slot, String date) throws Exception {
			String body = mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", slot)
					.param("date", date)
					.param("range", "3"))
					.andExpect(status().isOk())
					.andReturn().getResponse().getContentAsString();
			return com.jayway.jsonpath.JsonPath.read(body, "$.data.selectedQuietness");
		}

		/**
		 * 상태와 추천 날짜가 <b>서로 어긋나지 않는다</b>는 규칙을 확인한다.
		 *
		 * <p>특정 날짜의 결과를 못박지 않는 이유: 목업 값이 바뀌면 그런 테스트는 의미 없이 깨진다.
		 * 여기서 지키려는 것은 "권한다고 해놓고 권할 날이 없다"는 모순이 생기지 않는 것이다.
		 */
		@Test
		@DisplayName("추천 상태와 추천 날짜는 함께 움직인다")
		void statusAgreesWithBestDate() throws Exception {
			String body = mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("date", "2026-09-16")
					.param("range", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.status").isNotEmpty())
					.andExpect(jsonPath("$.data.statusMessage").isNotEmpty())
					.andExpect(jsonPath("$.data.minImprovement").isNumber())
					.andReturn().getResponse().getContentAsString();

			String status = com.jayway.jsonpath.JsonPath.read(body, "$.data.status");
			Object bestDate = com.jayway.jsonpath.JsonPath.read(body, "$.data.bestDate");
			List<Integer> improvements =
					com.jayway.jsonpath.JsonPath.read(body, "$.data.options[*].improvement");

			assertThat(improvements).isNotEmpty();

			// 옮기라고 권했으면 옮길 날이 반드시 있어야 한다.
			if ("RECOMMENDED".equals(status) || "MARGINAL".equals(status)) {
				assertThat(bestDate).isNotNull();
			}
			// 지금이 최선이라고 했으면 더 나은 날이 있어서는 안 된다.
			if ("CURRENT_BEST".equals(status)) {
				assertThat(bestDate).isNull();
			}
		}

		/**
		 * 음식점은 공사 집중률에 아예 없다. 예전에는 이런 장소가 하나만 끼어도 404로
		 * <b>요청 전체가 죽었다</b> — 밥집 없는 여행 코스는 없으므로 사실상 쓸 수 없는 상태였다.
		 *
		 * <p>목업에서는 음식점에도 값이 있어 이 경로를 확인할 수 없다. 그래서 여기서는
		 * "요청이 살아 있다"만 확인하고, 실제 제외 동작은 실데이터에서 확인한다.
		 */
		@Test
		@DisplayName("예측 자료가 없는 장소가 섞여도 요청 전체가 죽지 않는다")
		void survivesPlacesWithoutForecast() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("slot", "1:mock-gyorigimbap")
					.param("date", "2026-09-16")
					.param("range", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.status").isNotEmpty());
		}

		@Test
		@DisplayName("조회 기간이 범위를 벗어나면 400 — 어느 파라미터인지 함께 알려준다")
		void rejectsOutOfRangeDays() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("slot", "1:mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "100"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"))
					.andExpect(jsonPath("$.error.fields[0].field").value("range"));
		}
	}

	@Nested
	@DisplayName("API 문서")
	class Docs {

		@Test
		@DisplayName("OpenAPI 문서에 모든 엔드포인트가 실린다")
		void exposesOpenApiDocument() throws Exception {
			mockMvc.perform(get("/v3/api-docs"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.info.title").value("PEAKOFF API"))
					.andExpect(jsonPath("$.paths['/api/places']").exists())
					.andExpect(jsonPath("$.paths['/api/courses/diagnose']").exists())
					.andExpect(jsonPath("$.paths['/api/courses/recommend']").exists())
					.andExpect(jsonPath("$.paths['/api/dates/alternatives']").exists())
					.andExpect(jsonPath("$.paths['/api/places/{placeId}/alternatives']").exists());
		}

		@Test
		@DisplayName("검증 제약이 스키마에 그대로 실린다 — 문서와 실제 동작이 어긋나지 않는다")
		void schemaCarriesValidationRules() throws Exception {
			mockMvc.perform(get("/v3/api-docs"))
					.andExpect(status().isOk())
					.andExpect(jsonPath(
							"$.components.schemas.CourseDiagnosisRequest.properties.nights.maximum")
							.value(6))
					.andExpect(jsonPath(
							"$.components.schemas.CourseDiagnosisRequest.properties.region.minLength")
							.value(1));
		}
	}
}
