package com.peakoff.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 기존 계정에 소셜 수단을 연결하는 요청.
 *
 * <p>두 증거를 함께 보낸다 — 티켓은 "소셜 인증을 통과했다"를, 비밀번호는 "이 계정의 주인이다"를
 * 증명한다. <b>둘 중 하나만으로는 연결되지 않는다.</b> 티켓만으로 이으면 남의 이메일로 미리
 * 만들어 둔 계정에 진짜 주인을 밀어 넣을 수 있고, 비밀번호만으로는 어떤 소셜 계정을 붙일지 알 수 없다.
 *
 * @param linkTicket 로그인 응답에서 받은 티켓. 5분이 지나면 무효다
 * @param password   기존 계정의 비밀번호
 */
public record SocialLinkRequest(
		@NotBlank(message = "연결 정보가 필요합니다.") String linkTicket,
		@NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
}
