package com.peakoff.auth.jwt;

import java.io.IOException;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 요청 헤더의 토큰을 읽어 로그인 상태로 만든다.
 *
 * <p><b>토큰이 없거나 틀려도 여기서 막지 않는다.</b> 그냥 로그인하지 않은 채로 통과시킨다.
 * 어느 경로가 로그인을 요구하는지는 {@code SecurityConfig}가 정하고, 거절도 거기서 일어난다.
 * 필터가 직접 401을 쓰면 "게스트도 쓸 수 있는 API"에까지 인증이 걸린다 —
 * 이 서비스는 로그인 없이도 전체 흐름이 돌아야 한다.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String HEADER = "Authorization";
	private static final String PREFIX = "Bearer ";

	private final JwtProvider jwtProvider;

	@Override
	protected void doFilterInternal(
			HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {

		AuthenticatedMember member = resolveMember(request);
		if (member != null) {
			/*
			 * 권한 목록을 비우지 않고 ROLE_USER를 넣는다.
			 * 비워 두면 authenticated()는 통과하지만 hasRole() 계열이 전부 막혀,
			 * 나중에 권한을 나눌 때 원인을 찾기 어려운 방식으로 걸린다.
			 */
			var authentication = new UsernamePasswordAuthenticationToken(
					member, null, List.of(new SimpleRole()));
			SecurityContextHolder.getContext().setAuthentication(authentication);
		}

		chain.doFilter(request, response);
	}

	private AuthenticatedMember resolveMember(HttpServletRequest request) {
		String header = request.getHeader(HEADER);
		if (header == null || !header.startsWith(PREFIX)) {
			return null;
		}
		return jwtProvider.parse(header.substring(PREFIX.length()).trim());
	}

	/** 회원 한 종류뿐이라 권한도 하나다. 등급이 생기면 이 자리를 enum으로 바꾼다. */
	private record SimpleRole() implements org.springframework.security.core.GrantedAuthority {
		@Override
		public String getAuthority() {
			return "ROLE_USER";
		}
	}
}
