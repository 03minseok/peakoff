package com.peakoff.auth.oauth;

import com.peakoff.member.domain.SocialProvider;

/**
 * 소셜 제공자가 알려준 사용자 정보. 제공자가 어디든 <b>같은 모양</b>으로 담는다.
 *
 * <p>카카오는 {@code kakao_account.profile.nickname}, 네이버는 {@code response.nickname}처럼
 * 응답 구조가 서로 다르다. 그 차이를 각 클라이언트가 흡수하고 이 타입만 밖으로 내보내면,
 * 회원을 찾고 만드는 로직은 제공자가 몇 개든 한 벌로 끝난다.
 *
 * @param provider       어느 서비스에서 왔는가
 * @param providerUserId 그 서비스가 매긴 고유 식별자. <b>신원의 기준</b>이다
 * @param nickname       화면에 쓸 이름. 없을 수 있어 회원을 만들 때 기본값으로 메운다
 * @param email          제공자가 준 이메일. <b>없을 수 있다</b> — 동의하지 않았거나 받지 않는 항목이면 null
 * @param emailVerified  그 이메일이 제공자 쪽에서 확인된 값인가.
 *                       확인되지 않은 이메일로 기존 계정을 찾으면, 남이 등록해둔 주소로
 *                       남의 계정에 닿는 길이 열린다. 그래서 값과 확인 여부를 함께 들고 다닌다
 */
public record SocialProfile(
		SocialProvider provider,
		String providerUserId,
		String nickname,
		String email,
		boolean emailVerified) {

	/**
	 * 기존 계정을 찾아볼 만한 이메일이 있는가.
	 *
	 * <p>이 조건을 통과하지 못하면 <b>연결 후보를 찾지 않고</b> 새 계정으로 간다.
	 * 이메일이 없거나 확인되지 않았는데 억지로 맞춰보는 것이 계정 탈취의 출발점이다.
	 */
	public boolean hasVerifiedEmail() {
		return emailVerified && email != null && !email.isBlank();
	}
}
