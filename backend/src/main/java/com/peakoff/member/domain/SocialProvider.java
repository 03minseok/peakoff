package com.peakoff.member.domain;

/**
 * 소셜 로그인 제공자.
 *
 * <p>이메일 로그인(LOCAL)을 여기 넣지 않았다. 이 열거형이 가리키는 것은 <b>바깥 서비스</b>라,
 * 우리 자신을 목록에 섞으면 "카카오 인증키는 어디 있지" 같은 물음이 LOCAL에도 생긴다.
 * 어떤 회원이 이메일로도 로그인할 수 있는지는 {@code Member.hasPassword()}가 답한다.
 *
 * <p>이름을 DB에 <b>문자열로</b> 저장한다({@code @Enumerated(EnumType.STRING)}).
 * 순서(0, 1)로 저장하면 나중에 이 목록 중간에 값을 하나 끼워 넣는 순간
 * 이미 저장된 행들이 조용히 다른 제공자를 가리키게 된다.
 */
public enum SocialProvider {

	KAKAO("카카오"),
	NAVER("네이버");

	private final String displayName;

	SocialProvider(String displayName) {
		this.displayName = displayName;
	}

	/**
	 * 화면과 오류 문구에 쓰는 이름.
	 *
	 * <p>{@code name()}을 그대로 쓰면 사용자에게 "KAKAO로 가입한 계정입니다"가 나간다.
	 * 한국어 이름을 각 값 옆에 붙여두면, 문구를 만드는 자리마다 매핑 표를 다시 만들지 않아도 된다.
	 */
	public String displayName() {
		return displayName;
	}
}
