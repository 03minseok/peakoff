package com.peakoff.global.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.peakoff.auth.jwt.JwtAuthenticationFilter;
import com.peakoff.auth.jwt.JwtProperties;
import com.peakoff.auth.oauth.OAuthProperties;
import com.peakoff.global.error.UnauthorizedException;

import jakarta.servlet.DispatcherType;

/**
 * 인증 설정.
 *
 * <p>이 서비스의 전제는 <b>로그인 없이도 전체 흐름이 돌아간다</b>는 것이다.
 * 그래서 장소 조회·코스 진단·대안 추천은 전부 열려 있고, 로그인은 코스를 저장할 때만 필요하다.
 * 로그인을 진입 장벽으로 만들지 않는다.
 *
 * <p>다만 <b>목록에 없는 경로는 로그인을 요구하도록</b> 뒀다({@code anyRequest().authenticated()}).
 * 반대로 두면 나중에 저장 API를 추가할 때 허용 목록에 적는 것을 잊는 순간
 * 남의 코스가 조용히 공개된다. 실수했을 때 닫히는 쪽이 안전하다.
 */
@Configuration
// 인증에 쓰는 설정 묶음을 함께 켠다. JWT는 우리 토큰, OAuth는 소셜 제공자 인증키다.
@EnableConfigurationProperties({ JwtProperties.class, OAuthProperties.class })
public class SecurityConfig {

	/** 로그인 없이 쓸 수 있는 경로. 게스트가 서비스 전체를 체험하는 데 필요한 것들이다. */
	private static final String[] PUBLIC_API = {
			"/api/health",
			"/api/auth/signup",
			"/api/auth/login",
			/*
			 * 소셜 로그인. 로그인하기 <b>전에</b> 부르는 경로라 당연히 열려 있어야 한다.
			 * 연결(/link)도 여기 포함된다 — 그 요청의 본인 확인은 토큰이 아니라
			 * 티켓과 비밀번호가 한다.
			 */
			"/api/auth/oauth/**",
			"/api/places/**",
			/*
			 * 지원 지역 목록. <b>모든 화면의 첫 요청</b>이라 막으면 게스트가 아무것도 못 한다 —
			 * 지역을 고르기 전에는 검색도 코스 짜기도 시작할 수 없다.
			 * 공개해도 되는 값이다. 우리가 어느 지역을 지원하는지는 화면에 이미 적혀 있다.
			 */
			"/api/regions",
			"/api/courses/diagnose",
			/*
			 * 설문 기반 코스 추천. 경주를 모르는 사용자의 진입점이라 로그인 뒤에 두면
			 * 진입 장벽 자체가 된다. 저장(POST /api/courses)은 여전히 로그인이 필요하다 —
			 * 경로를 정확히 적었으므로 그쪽까지 열리지 않는다.
			 */
			"/api/courses/recommend",
			/*
			 * 다른 사람들의 최근 코스. 홈에 서는 목록이라 게스트도 봐야 한다.
			 * 나가는 것은 익명 요약이라 코스 id도 이름도 담기지 않는다.
			 * 저장과 내 코스 조회(/api/courses)는 여전히 로그인이 필요하다 — 경로를 정확히 적었다.
			 */
			"/api/courses/recent",
			"/api/dates/**",
			/*
			 * 헬스체크. 도커와 배포 스크립트가 부르는 자리라 토큰을 들려 보낼 수 없다.
			 * 나가는 것은 {"status":"UP"}뿐이라 열어 두어도 알려지는 것이 없다.
			 */
			"/health" };

	/** API 문서. 심사 때 화면으로 보여줘야 해서 열어 둔다. */
	private static final String[] PUBLIC_DOCS = {
			"/docs", "/docs/**", "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui/**" };

	private final JwtAuthenticationFilter jwtAuthenticationFilter;
	private final HandlerExceptionResolver handlerExceptionResolver;

	/**
	 * 인증 실패 응답을 직접 만들지 않고 {@link HandlerExceptionResolver}에 떠넘긴다.
	 *
	 * <p>필터에서 거절당한 요청은 컨트롤러에 닿지 못해 {@code @RestControllerAdvice}가 돌지 않는다.
	 * 그대로 두면 본문 없는 401이 나가서, 프론트가 {@code success} 필드를 읽지 못하고
	 * "서버 응답을 해석할 수 없습니다"로 처리한다.
	 *
	 * <p>여기서 JSON을 손으로 찍어도 되지만, 그러면 응답 봉투 모양이 두 곳에 생긴다.
	 * 예외를 만들어 넘기면 {@code GlobalExceptionHandler}가 평소처럼 변환한다 — 모양이 한 곳에 남는다.
	 */
	public SecurityConfig(
			JwtAuthenticationFilter jwtAuthenticationFilter,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver handlerExceptionResolver) {
		this.jwtAuthenticationFilter = jwtAuthenticationFilter;
		this.handlerExceptionResolver = handlerExceptionResolver;
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http
				/*
				 * CSRF를 끈다. CSRF 공격은 브라우저가 쿠키를 자동으로 실어 보내기 때문에 성립한다.
				 * 이 서비스는 토큰을 Authorization 헤더에 직접 담아 보내므로 자동 전송이 없다.
				 */
				.csrf(csrf -> csrf.disable())
				// 서버가 로그인 상태를 들고 있지 않는다. 세션을 만들면 배포에 붙일 것이 하나 는다.
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				// 아이디/비밀번호 입력 폼과 브라우저 기본 인증 창을 끈다. 우리 화면이 그 일을 한다.
				.formLogin(form -> form.disable())
				.httpBasic(basic -> basic.disable())
				.authorizeHttpRequests(auth -> auth
						/*
						 * 오류 페이지로 넘어가는 내부 전달은 인증 검사 대상이 아니다.
						 * 막아두면 401을 그리려다 다시 401에 걸려 빈 응답이 나간다.
						 */
						.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
						.requestMatchers(PUBLIC_API).permitAll() // 게스트도 사용 가능
						.requestMatchers(PUBLIC_DOCS).permitAll() // api 문서
						.anyRequest().authenticated()) //나머지는 로그인 필수
				.exceptionHandling(handling -> handling
						.authenticationEntryPoint((request, response, exception) ->
								handlerExceptionResolver.resolveException(request, response, null,
										new UnauthorizedException("로그인이 필요합니다.")))
						.accessDeniedHandler((request, response, exception) ->
								handlerExceptionResolver.resolveException(request, response, null,
										new UnauthorizedException("접근 권한이 없습니다."))))
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
				.build();
	}

	/**
	 * 비밀번호 해시.
	 *
	 * <p>BCrypt는 <b>일부러 느린</b> 해시다. SHA-256 같은 빠른 해시로 저장하면 유출됐을 때
	 * 초당 수십억 번 대입해 원문을 찾아낼 수 있다. 그리고 같은 비밀번호라도 매번 다른 값이 나온다
	 * — 솔트가 결과 문자열 안에 함께 들어가기 때문에 솔트를 따로 저장할 컬럼이 필요 없다.
	 */
	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
