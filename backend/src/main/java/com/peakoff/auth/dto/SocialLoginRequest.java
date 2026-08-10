package com.peakoff.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 소셜 로그인 요청.
 *
 * <p>담기는 것은 인가 코드 하나뿐이다. 제공자가 준 access token이나 사용자 정보를
 * 화면이 보내오게 하면 안 된다 — 그건 <b>클라이언트가 자기가 누구인지 스스로 주장</b>하는 것이라,
 * 아무나 남의 회원 번호를 적어 보내면 그 계정으로 로그인된다. 코드만 받아 서버가 직접
 * 제공자에게 확인해야 그 주장이 검증된다.
 *
 * @param code 제공자가 redirect로 돌려준 <b>한 번만 쓸 수 있는</b> 인가 코드
 */
public record SocialLoginRequest(@NotBlank(message = "인가 코드가 필요합니다.") String code) {
}
