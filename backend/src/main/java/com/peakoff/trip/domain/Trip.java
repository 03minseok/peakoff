package com.peakoff.trip.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.peakoff.course.domain.SavedCourse;
import com.peakoff.global.error.ConflictException;
import com.peakoff.global.support.Texts;
import com.peakoff.member.domain.Member;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * 여행 — 저장한 코스를 묶는 단위.
 *
 * <h3>왜 필요한가</h3>
 * 공사가 자료를 주는 단위가 시군구라 <b>한라산(제주시)과 성산일출봉(서귀포시)을 한 코스에
 * 담을 수 없다.</b> 코스는 지역 하나에 잠겨 있고, 그 제약은 이름 매칭·캐시·집중률 조회가
 * 전부 지역 단위로 맞물려 있어 풀기 비싸다. 대신 <b>코스 위에 한 층을 얹는다</b> —
 * 제주시 코스와 서귀포 코스를 "제주 3박 4일"이라는 여행으로 묶으면, 진단은 여전히
 * 코스 단위로 돌면서 사용자에게는 여행 하나가 된다. 공사 호출이 하나도 늘지 않는다.
 *
 * <h3>⚠️ 여행에는 총점이 없다</h3>
 * 여행 총점 = 코스 총점들의 평균인데, 그것은 마이페이지에서 걷어낸 "평균 한적 지수"와
 * 정확히 같은 물건이다 — 지역도 날짜도 다른 값을 평균 내면 아무 말도 아니게 되고,
 * 시도별 한적도 중앙값이 32점 벌어져 있어 <b>"여행을 잘 골랐는가"가 아니라
 * "어느 지역을 갔는가"를 재게 된다.</b> 여행은 날짜 범위와 코스 수 같은
 * <b>묶음의 사실만</b> 말하고, 점수는 각 코스가 자기 것을 갖는다.
 * 나중에 누가 이 자리에 점수를 붙이려 하면 이 주석이 막을 것이다.
 */
@Entity
@Table(name = "trips")
public class Trip {

	public static final int NAME_MAX_LENGTH = 30;

	/**
	 * 회원 한 명이 만들 수 있는 여행 수.
	 *
	 * <p>저장 코스가 50개까지인데 여행이 그보다 많으면 코스 없는 빈 여행이 쌓인다는 뜻이다.
	 * 20이면 실제로 쓰다 보면 닿지 않지만 폭주는 막는 선이다 — 저장 코스 상한과 같은 논리.
	 */
	public static final int MAX_PER_MEMBER = 20;

	/**
	 * 여행 하나에 담을 수 있는 코스 수.
	 *
	 * <p>코스 하나가 하루~나흘이니 10개면 여행 하나가 한 달을 넘는다. 그보다 긴 것은
	 * 여행 하나가 아니라 여러 여행이다.
	 */
	public static final int MAX_COURSES = 10;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** 주인. LAZY인 이유는 SavedCourse와 같다 — "내 여행"만 조회하므로 누구인지 이미 안다. */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "member_id", nullable = false)
	private Member member;

	/** 사용자가 붙인 여행 이름. 예: "가을 제주 한 바퀴" */
	@Column(nullable = false, length = NAME_MAX_LENGTH)
	private String name;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * 담긴 코스들. 담은 순서를 지킨다.
	 *
	 * <p>{@code orphanRemoval} — 이 목록에서 빼면 연결 행이 지워진다. <b>코스 자체는
	 * 지워지지 않는다.</b> 여행은 코스를 소유하지 않고 가리킬 뿐이다. 여행을 지워도
	 * 코스는 저장 목록에 그대로 남는다.
	 */
	@OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<TripCourse> courses = new ArrayList<>();

	protected Trip() {
	}

	public static Trip create(Member member, String name, Instant now) {
		Trip trip = new Trip();
		trip.member = member;
		trip.name = Texts.requireNotBlank(name, "여행 이름").strip();
		trip.createdAt = now;
		return trip;
	}

	/**
	 * 코스를 맨 뒤에 담는다.
	 *
	 * <p>같은 코스를 두 번 담을 수 없다 — 한 여행 안에서 같은 일정이 두 줄로 서면
	 * 어느 쪽을 지워야 할지부터 헷갈린다. 다만 <b>다른 여행에는 같은 코스를 담을 수 있다</b>.
	 * 코스는 재료이고 여행은 묶음이라, "경주 하루 코스"가 두 여행에 들어가는 것은 자연스럽다.
	 */
	public void add(SavedCourse course) {
		if (courses.size() >= MAX_COURSES) {
			throw new ConflictException(
					"여행 하나에는 코스를 %d개까지 담을 수 있습니다.".formatted(MAX_COURSES));
		}
		boolean already = courses.stream()
				.anyMatch(link -> link.course().id().equals(course.id()));
		if (already) {
			throw new ConflictException("이미 이 여행에 담긴 코스입니다.");
		}
		/*
		 * 순서는 지금 목록의 마지막 값 + 1이다. 빼면 번호에 구멍이 남지만 정렬에는
		 * 아무 지장이 없다 — 구멍을 메우려고 남은 행을 전부 고쳐 쓰는 것이 더 비싸다.
		 */
		int nextOrder = courses.isEmpty() ? 0 : courses.get(courses.size() - 1).sortOrder() + 1;
		courses.add(TripCourse.link(this, course, nextOrder));
	}

	/** 코스를 뺀다. 없는 코스를 빼도 조용히 지나간다 — 이미 원하는 상태다. */
	public void remove(Long courseId) {
		courses.removeIf(link -> link.course().id().equals(courseId));
	}

	public Long id() {
		return id;
	}

	public String name() {
		return name;
	}

	public Instant createdAt() {
		return createdAt;
	}

	public List<TripCourse> courses() {
		return List.copyOf(courses);
	}
}
