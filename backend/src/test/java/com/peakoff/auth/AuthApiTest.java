package com.peakoff.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.peakoff.member.domain.Member;
import com.peakoff.member.domain.MemberRepository;
import com.peakoff.support.IntegrationTest;

@IntegrationTest
class AuthApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * 테스트마다 회원 테이블을 비운다.
	 *
	 * <p>이걸 빼면 "이미 가입된 이메일" 테스트가 앞선 테스트의 계정에 걸려
	 * <b>실제로 검증하려던 것과 다른 이유로</b> 통과한다. 통과하는데 의미가 없는 테스트가 된다.
	 */
	@BeforeEach
	void clearMembers() {
		memberRepository.deleteAll();
	}

	private static String signupBody(String email, String password, String confirm, String nickname,
			boolean termsAgreed) {
		return """
				{"email":"%s","password":"%s","passwordConfirm":"%s","nickname":"%s","termsAgreed":%b}"""
				.formatted(email, password, confirm, nickname, termsAgreed);
	}

	private static String validSignup(String email) {
		return signupBody(email, "peakoff123", "peakoff123", "여행자", true);
	}

	/** 가입한 뒤 토큰을 꺼내온다. 인증이 필요한 요청을 시험할 때 쓴다. */
	private String signupAndGetToken(String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON).content(validSignup(email)))
				.andExpect(status().isCreated())
				.andReturn();

		return com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.token");
	}

	@Nested
	@DisplayName("POST /api/auth/signup")
	class Signup {

		@Test
		@DisplayName("가입하면 토큰과 회원 정보를 함께 돌려준다 — 곧바로 로그인 상태가 된다")
		void returnsTokenAndMember() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("new@peakoff.kr")))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.success").value(true))
					.andExpect(jsonPath("$.data.token").isNotEmpty())
					.andExpect(jsonPath("$.data.expiresInSeconds").isNumber())
					.andExpect(jsonPath("$.data.member.email").value("new@peakoff.kr"))
					.andExpect(jsonPath("$.data.member.nickname").value("여행자"))
					.andExpect(jsonPath("$.data.member.createdAt").isNotEmpty())
					.andExpect(jsonPath("$.data.member.termsAgreedAt").isNotEmpty());
		}

		@Test
		@DisplayName("비밀번호는 해시로 저장된다 — 원문이 DB에 남지 않는다")
		void storesHashedPassword() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("hash@peakoff.kr")))
					.andExpect(status().isCreated());

			Member saved = memberRepository.findByEmail("hash@peakoff.kr").orElseThrow();

			assertThat(saved.passwordHash()).isNotEqualTo("peakoff123");
			assertThat(saved.passwordHash()).startsWith("$2");
			assertThat(passwordEncoder.matches("peakoff123", saved.passwordHash())).isTrue();
		}

		@Test
		@DisplayName("응답 어디에도 비밀번호가 실리지 않는다")
		void neverExposesPassword() throws Exception {
			String body = mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("safe@peakoff.kr")))
					.andReturn().getResponse().getContentAsString();

			assertThat(body).doesNotContain("peakoff123");
			assertThat(body).doesNotContain("passwordHash");
		}

		@Test
		@DisplayName("가입 시각과 약관 동의 시각이 함께 기록된다")
		void recordsTermsAgreedAt() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("terms@peakoff.kr")))
					.andExpect(status().isCreated());

			Member saved = memberRepository.findByEmail("terms@peakoff.kr").orElseThrow();

			assertThat(saved.createdAt()).isNotNull();
			assertThat(saved.termsAgreedAt()).isEqualTo(saved.createdAt());
		}

		@Test
		@DisplayName("이메일은 소문자로 눕혀 저장된다 — 대문자로 가입하고 소문자로 로그인해도 같은 계정")
		void normalizesEmail() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("MiXeD@Peakoff.KR")))
					.andExpect(status().isCreated());

			assertThat(memberRepository.findByEmail("mixed@peakoff.kr")).isPresent();

			mockMvc.perform(post("/api/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"mixed@peakoff.kr","password":"peakoff123"}"""))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("이미 가입된 이메일이면 409")
		void rejectsDuplicateEmail() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("dup@peakoff.kr")))
					.andExpect(status().isCreated());

			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("dup@peakoff.kr")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.error.code").value("CONFLICT"));
		}

		@Test
		@DisplayName("비밀번호와 확인이 다르면 400")
		void rejectsMismatchedConfirm() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON)
					.content(signupBody("x@peakoff.kr", "peakoff123", "peakoff999", "여행자", true)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));

			assertThat(memberRepository.findByEmail("x@peakoff.kr")).isEmpty();
		}

		@Test
		@DisplayName("필수 약관에 동의하지 않으면 400 — 어느 항목인지 함께 알려준다")
		void requiresTermsAgreement() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON)
					.content(signupBody("t@peakoff.kr", "peakoff123", "peakoff123", "여행자", false)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.fields[0].field").value("termsAgreed"));

			assertThat(memberRepository.findByEmail("t@peakoff.kr")).isEmpty();
		}

		@Test
		@DisplayName("비밀번호가 8자 미만이면 400")
		void rejectsShortPassword() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON)
					.content(signupBody("s@peakoff.kr", "short1", "short1", "여행자", true)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.fields[0].field").value("password"));
		}

		@Test
		@DisplayName("이메일 형식이 아니면 400")
		void rejectsMalformedEmail() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON)
					.content(signupBody("not-an-email", "peakoff123", "peakoff123", "여행자", true)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.fields[0].field").value("email"));
		}

		@Test
		@DisplayName("닉네임이 12자를 넘으면 400")
		void rejectsLongNickname() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON)
					.content(signupBody("n@peakoff.kr", "peakoff123", "peakoff123", "열세글자가넘는아주긴닉네임", true)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.error.fields[0].field").value("nickname"));
		}
	}

	@Nested
	@DisplayName("POST /api/auth/login")
	class Login {

		@Test
		@DisplayName("맞는 비밀번호면 토큰을 돌려준다")
		void returnsToken() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("in@peakoff.kr")))
					.andExpect(status().isCreated());

			mockMvc.perform(post("/api/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"in@peakoff.kr","password":"peakoff123"}"""))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.token").isNotEmpty())
					.andExpect(jsonPath("$.data.member.nickname").value("여행자"));
		}

		@Test
		@DisplayName("비밀번호가 틀리면 401")
		void rejectsWrongPassword() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("pw@peakoff.kr")))
					.andExpect(status().isCreated());

			mockMvc.perform(post("/api/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"pw@peakoff.kr","password":"wrongpassword"}"""))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
		}

		@Test
		@DisplayName("없는 이메일과 틀린 비밀번호는 같은 응답이다 — 가입 여부를 알려주지 않는다")
		void doesNotRevealWhetherEmailExists() throws Exception {
			mockMvc.perform(post("/api/auth/signup")
					.contentType(MediaType.APPLICATION_JSON).content(validSignup("known@peakoff.kr")))
					.andExpect(status().isCreated());

			String wrongPassword = mockMvc.perform(post("/api/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"known@peakoff.kr","password":"wrongpassword"}"""))
					.andReturn().getResponse().getContentAsString();

			String unknownEmail = mockMvc.perform(post("/api/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"nobody@peakoff.kr","password":"wrongpassword"}"""))
					.andReturn().getResponse().getContentAsString();

			assertThat(wrongPassword).isEqualTo(unknownEmail);
		}
	}

	@Nested
	@DisplayName("GET /api/auth/me")
	class Me {

		@Test
		@DisplayName("토큰을 주면 내 정보를 돌려준다")
		void returnsMemberForValidToken() throws Exception {
			String token = signupAndGetToken("me@peakoff.kr");

			mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.email").value("me@peakoff.kr"))
					.andExpect(jsonPath("$.data.nickname").value("여행자"));
		}

		@Test
		@DisplayName("토큰이 없으면 401 — 본문도 공통 응답 포맷이다")
		void rejectsMissingToken() throws Exception {
			mockMvc.perform(get("/api/auth/me"))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.success").value(false))
					.andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
					// 인증 실패도 성공 응답과 같은 봉투여야 프론트 분기가 하나로 유지된다
					.andExpect(jsonPath("$.data").doesNotExist());
		}

		@Test
		@DisplayName("서명이 조작된 토큰은 401")
		void rejectsTamperedToken() throws Exception {
			String token = signupAndGetToken("tamper@peakoff.kr");
			String[] parts = token.split("\\.");

			/*
			 * 서명의 <b>첫 글자</b>를 바꾼다. 마지막 글자를 건드리면 안 된다 —
			 * HS256 서명은 32바이트(=43 base64 글자)라 마지막 글자에는 의미 없는 여분 비트가 섞여 있어,
			 * 글자를 바꿔도 디코딩 결과가 같아 서명이 그대로 유효할 수 있다.
			 */
			char first = parts[2].charAt(0);
			String tamperedSignature = (first == 'a' ? 'b' : 'a') + parts[2].substring(1);
			String tampered = parts[0] + "." + parts[1] + "." + tamperedSignature;

			mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tampered))
					.andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("본문을 고쳐 다른 회원인 척해도 401 — 서명이 맞지 않는다")
		void rejectsForgedPayload() throws Exception {
			String token = signupAndGetToken("forge@peakoff.kr");
			String[] parts = token.split("\\.");

			// 회원 번호를 999로 바꾼 본문을 끼워 넣고 서명은 원래 것을 그대로 둔다.
			String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding()
					.encodeToString("""
							{"sub":"999","nickname":"여행자"}"""
							.getBytes(java.nio.charset.StandardCharsets.UTF_8));
			String forged = parts[0] + "." + forgedPayload + "." + parts[2];

			mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + forged))
					.andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("Bearer 접두어가 없으면 401")
		void rejectsTokenWithoutBearerPrefix() throws Exception {
			String token = signupAndGetToken("raw@peakoff.kr");

			mockMvc.perform(get("/api/auth/me").header("Authorization", token))
					.andExpect(status().isUnauthorized());
		}
	}

	@Nested
	@DisplayName("게스트 경로는 로그인 없이 열려 있다")
	class GuestAccess {

		/**
		 * 이 서비스의 전제를 지키는 테스트다.
		 *
		 * <p>Spring Security를 붙이면 기본값이 "전부 막기"라, 설정을 잘못 건드리는 순간
		 * 게스트가 서비스를 아예 쓸 수 없게 된다. 그 사고를 여기서 잡는다.
		 */
		@Test
		@DisplayName("장소 조회·코스 진단·날짜 대안은 토큰 없이 된다")
		void allowsGuestFlow() throws Exception {
			mockMvc.perform(get("/api/places").param("region", "gyeongju"))
					.andExpect(status().isOk());

			String placeId = com.peakoff.place.mock.GyeongjuMockCatalog.places().get(0).id();

			mockMvc.perform(post("/api/courses/diagnose")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"region":"gyeongju","startDate":"2026-09-16","nights":0,
							 "slots":[{"day":1,"order":1,"placeId":"%s"}]}""".formatted(placeId)))
					.andExpect(status().isOk());

			mockMvc.perform(get("/api/dates/alternatives")
					.param("placeId", placeId).param("date", "2026-09-16").param("range", "7"))
					.andExpect(status().isOk());

			mockMvc.perform(get("/api/places/{id}/alternatives", placeId)
					.param("date", "2026-09-16"))
					.andExpect(status().isOk());
		}

		@Test
		@DisplayName("API 문서도 열려 있다 — 심사 때 화면으로 보여줘야 한다")
		void allowsApiDocs() throws Exception {
			mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
		}
	}
}
