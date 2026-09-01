package com.peakoff.trip.domain;

import com.peakoff.course.domain.SavedCourse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 여행과 코스의 연결 한 줄.
 *
 * <p>코스에 여행 컬럼을 두지 않고 연결을 따로 두는 이유: 코스 하나가 <b>여러 여행에</b>
 * 들어갈 수 있어야 한다. "경주 하루 코스"는 재료라서, 봄 여행에도 가을 여행에도 담긴다.
 *
 * <p>유니크 제약은 <b>한 여행 안의 중복</b>만 막는다. 도메인({@code Trip.add})이 먼저 거르지만,
 * 같은 요청이 동시에 두 번 오면 검사를 둘 다 통과할 수 있다 — 마지막 문은 DB가 지킨다.
 */
@Entity
@Table(name = "trip_courses",
		uniqueConstraints = @UniqueConstraint(columnNames = { "trip_id", "course_id" }))
public class TripCourse {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "trip_id", nullable = false)
	private Trip trip;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "course_id", nullable = false)
	private SavedCourse course;

	/** 여행 안에서의 순서. 구멍이 있어도 된다 — 정렬에만 쓴다. */
	@Column(nullable = false)
	private int sortOrder;

	protected TripCourse() {
	}

	static TripCourse link(Trip trip, SavedCourse course, int sortOrder) {
		TripCourse link = new TripCourse();
		link.trip = trip;
		link.course = course;
		link.sortOrder = sortOrder;
		return link;
	}

	public SavedCourse course() {
		return course;
	}

	public int sortOrder() {
		return sortOrder;
	}
}
