package com.peakoff.member.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 연결된 소셜 수단 저장소.
 *
 * <p>소셜 로그인이 회원을 찾는 <b>유일한 통로</b>가 {@link #findByProviderAndProviderUserId}다.
 * 이메일로 회원을 찾아 로그인시키는 길을 여기 두지 않은 것은 의도다 — 그 길이 열려 있으면
 * "카카오가 준 이메일과 같으면 그 계정으로 들여보낸다"는 코드를 누군가 쉽게 쓰게 되고,
 * 그것이 바로 남의 계정을 가져갈 수 있는 구멍이다. 이메일이 같을 때 무엇을 할지는
 * 서비스가 판단하고, 연결은 비밀번호 확인을 지난 뒤에만 일어난다.
 */
public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {

	/** 로그인할 때 쓴다. 제공자와 고유 번호가 모두 같아야 같은 사람이다. */
	Optional<SocialAccount> findByProviderAndProviderUserId(SocialProvider provider, String providerUserId);

	/** 마이페이지에서 "무엇이 연결돼 있는지" 보여줄 때, 그리고 연결 중복을 막을 때 쓴다. */
	List<SocialAccount> findByMemberId(Long memberId);

	/**
	 * 탈퇴할 때 함께 지운다.
	 *
	 * <p>회원을 먼저 지우면 이 행들이 사라진 회원을 가리켜 외래키 제약에 걸린다.
	 * 저장된 코스를 지우는 것과 같은 이유로, 삭제 순서를 DB 캐스케이드가 아니라
	 * 서비스 코드에 남겨 "탈퇴하면 무엇이 함께 사라지는가"가 읽히게 한다.
	 */
	void deleteByMemberId(Long memberId);
}
