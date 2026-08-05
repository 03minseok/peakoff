package com.peakoff.auth.jwt;

/**
 * 토큰에서 꺼낸 로그인 사용자.
 *
 * <p>{@code Member} 엔티티를 그대로 쓰지 않는 이유가 두 가지다.
 * 하나는 요청마다 DB를 한 번 더 다녀오지 않아도 되는 것, 다른 하나는
 * <b>토큰이 실제로 담고 있는 것만</b> 타입으로 드러내는 것이다. 엔티티를 principal로 두면
 * 컨트롤러에서 {@code member.passwordHash()} 같은 값에 손이 닿는다.
 *
 * <p>컨트롤러는 {@code @AuthenticationPrincipal AuthenticatedMember} 로 받는다.
 */
public record AuthenticatedMember(Long id, String nickname) {
}
