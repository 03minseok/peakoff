package com.peakoff.course.domain;

import com.peakoff.global.support.Texts;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * 저장된 코스에 담긴 장소 한 곳.
 *
 * <p>장소 목록을 JSON 한 덩어리로 말지 않고 테이블로 편 이유: 나중에
 * "이 장소가 담긴 코스가 몇 개인가" 같은 것을 세야 할 때 JSON은 뒤질 수 없다.
 *
 * <p><b>장소의 이름·좌표를 여기 복사해두지 않는다.</b> 그건 장소 API가 가진 값이고,
 * 여기에 베껴두면 두 벌이 되어 언젠가 어긋난다. 저장하는 것은 {@code placeId}뿐이고
 * 나머지는 화면에 내보낼 때 그때그때 붙인다.
 */
@Entity
@Table(name = "saved_course_places")
public class SavedCoursePlace {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "saved_course_id", nullable = false)
	private SavedCourse savedCourse;

	/**
	 * 몇 일차인가. 1부터 시작한다.
	 *
	 * <p>컬럼명이 {@code visit_day}인 이유: {@code day}는 {@code order}와 마찬가지로 SQL 예약어다
	 * (H2에서는 시간 간격 단위로 쓰인다). 그대로 두면 {@code CREATE TABLE}이 문법 오류로 실패한다.
	 */
	@Column(name = "visit_day", nullable = false)
	private int day;

	/**
	 * 그 날 안에서의 방문 순서. 1부터 시작한다.
	 *
	 * <p>{@code order}도 예약어라 {@code ORDER BY}와 부딪힌다.
	 */
	@Column(name = "visit_order", nullable = false)
	private int visitOrder;

	@Column(nullable = false, length = 64)
	private String placeId;

	/** JPA가 프록시를 만들 때 쓴다. 애플리케이션 코드에서 부르지 않는다. */
	protected SavedCoursePlace() {
	}

	SavedCoursePlace(SavedCourse savedCourse, int day, int visitOrder, String placeId) {
		if (day < 1) {
			throw new IllegalArgumentException("일차는 1 이상이어야 합니다. 입력값: " + day);
		}
		if (visitOrder < 1) {
			throw new IllegalArgumentException("순서는 1 이상이어야 합니다. 입력값: " + visitOrder);
		}
		this.savedCourse = savedCourse;
		this.day = day;
		this.visitOrder = visitOrder;
		this.placeId = Texts.requireNotBlank(placeId, "장소");
	}

	public Long id() {
		return id;
	}

	public int day() {
		return day;
	}

	public int visitOrder() {
		return visitOrder;
	}

	public String placeId() {
		return placeId;
	}
}
