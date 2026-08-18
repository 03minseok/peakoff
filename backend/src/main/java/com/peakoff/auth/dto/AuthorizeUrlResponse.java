package com.peakoff.auth.dto;

/**
 * 사용자를 보낼 소셜 로그인 창 주소.
 *
 * <p>문자열 하나지만 record로 감싼다. 봉투({@code ApiResponse})의 {@code data}에 맨 문자열이
 * 들어가면 나중에 값을 하나 더 내려보낼 때 응답 모양이 통째로 바뀌어, 화면의 읽는 코드를
 * 함께 고쳐야 한다. 이름이 붙어 있으면 필드가 늘어도 기존 코드가 그대로 동작한다.
 */
public record AuthorizeUrlResponse(String authorizeUrl) {
}
