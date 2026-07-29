package com.peakoff.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.peakoff.place.mock.GyeongjuMockCatalog;

@SpringBootTest
@AutoConfigureMockMvc
class ApiEndpointsTest {

	@Autowired
	private MockMvc mockMvc;

	@Nested
	@DisplayName("GET /api/places")
	class Places {

		@Test
		@DisplayName("경주 장소 목록을 공통 응답 포맷으로 돌려준다")
		void returnsGyeongjuPlaces() throws Exception {
			mockMvc.perform(get("/api/places").param("region", "gyeongju"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.success").value(true))
					// 개수를 숫자로 박아두면 데이터가 늘 때마다 깨진다. 카탈로그를 하나도 빠뜨리지 않는지만 본다.
					.andExpect(jsonPath("$.data.length()").value(GyeongjuMockCatalog.places().size()))
					.andExpect(jsonPath("$.data[0].id").isNotEmpty())
					.andExpect(jsonPath("$.data[0].categoryName").isNotEmpty())
					// 성공 응답에는 error 키가 아예 없어야 한다
					.andExpect(jsonPath("$.error").doesNotExist());
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
		@DisplayName("대안 후보에 한적도·추천도·근거가 모두 담긴다")
		void returnsAlternativesWithReason() throws Exception {
			mockMvc.perform(get("/api/places/mock-bulguksa/alternatives")
					.param("date", "2026-09-16")
					.param("limit", "3"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.length()").value(3))
					.andExpect(jsonPath("$.data[0].quietness").isNumber())
					.andExpect(jsonPath("$.data[0].recommendation").isNumber())
					.andExpect(jsonPath("$.data[0].levelLabel").isNotEmpty())
					.andExpect(jsonPath("$.data[0].reason")
							.value(org.hamcrest.Matchers.startsWith("불국사 방문객이 함께 많이 찾는 곳 · ")));
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
	}

	@Nested
	@DisplayName("GET /api/dates/alternatives")
	class DateAlternatives {

		@Test
		@DisplayName("선택 날짜보다 한적한 날짜를 개선폭과 함께 제안한다")
		void suggestsQuieterDates() throws Exception {
			// 토요일을 고르면 평일이 더 한적하다고 나와야 한다
			mockMvc.perform(get("/api/dates/alternatives")
					.param("placeId", "mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "10"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.selectedDate").value("2026-09-12"))
					.andExpect(jsonPath("$.data.alreadyQuietest").value(false))
					.andExpect(jsonPath("$.data.options.length()").value(org.hamcrest.Matchers.greaterThan(0)))
					.andExpect(jsonPath("$.data.options[0].improvement")
							.value(org.hamcrest.Matchers.greaterThan(0)));
		}

		@Test
		@DisplayName("장소 여러 곳을 넘기면 코스 전체 기준으로 계산한다")
		void acceptsMultiplePlaces() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("placeId", "mock-bulguksa")
					.param("placeId", "mock-yangdong")
					.param("date", "2026-09-12")
					.param("range", "7"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.selectedQuietness").isNumber());
		}

		@Test
		@DisplayName("이미 가장 한적한 날이면 빈 목록과 함께 alreadyQuietest가 true")
		void alreadyQuietestWhenNoBetterDate() throws Exception {
			// 수요일은 평일 보정을 이미 받으므로 같은 주 안에 더 나은 날이 없다
			mockMvc.perform(get("/api/dates/alternatives")
					.param("placeId", "mock-bulguksa")
					.param("date", "2026-09-16")
					.param("range", "4"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.alreadyQuietest").value(true))
					.andExpect(jsonPath("$.data.options.length()").value(0));
		}

		@Test
		@DisplayName("조회 기간이 범위를 벗어나면 400")
		void rejectsOutOfRangeDays() throws Exception {
			mockMvc.perform(get("/api/dates/alternatives")
					.param("placeId", "mock-bulguksa")
					.param("date", "2026-09-12")
					.param("range", "100"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
		}
	}
}
