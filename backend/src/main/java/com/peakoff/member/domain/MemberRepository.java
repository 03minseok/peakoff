package com.peakoff.member.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 회원 저장소.
 *
 * <p>인터페이스가 도메인 패키지에 있는 것은 {@code CongestionProvider}와 같은 이유다.
 * 저장 방식(JPA·H2)은 바깥의 사정이고, 도메인은 "이메일로 회원을 찾을 수 있다"만 요구한다.
 */
public interface MemberRepository extends JpaRepository<Member, Long> {

	/** 이메일은 소문자로 눕혀 저장되므로, 찾을 때도 {@link Member#normalizeEmail} 을 거친 값을 넘긴다. */
	Optional<Member> findByEmail(String email);

	boolean existsByEmail(String email);
}
