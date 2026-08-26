package com.peakoff.course.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.peakoff.global.support.Scores;
import com.peakoff.global.support.Texts;
import com.peakoff.member.domain.Member;
import com.peakoff.place.domain.SupportedRegion;

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
 * 회원이 저장해둔 코스 한 벌.
 *
 * <p>{@code Course}(진단용 값 객체)와 다른 타입인 것이 중요하다. 진단용 코스는 요청마다
 * 새로 만들어지고 버려지는 계산 결과이고, 이쪽은 <b>사용자가 남기겠다고 누른 기록</b>이다.
 * 한쪽에 필드를 더한다고 다른 쪽이 따라 바뀌어야 할 이유가 없다.
 *
 * <h3>왜 점수를 저장하는가</h3>
 * 저장된 코스는 <b>과거의 판단</b>이다. 목록을 열 때마다 다시 진단하면 세 가지가 걸린다.
 * <ul>
 *   <li>여행 날짜가 지난 코스는 예측 데이터가 없어 점수를 만들 수 없다</li>
 *   <li>코스 5개면 화면 한 번 여는 데 진단이 5번 돈다</li>
 *   <li>"그때 78점이라 저장했다"는 사실이 사라진다</li>
 * </ul>
 * 대신 {@link #scoredAt}을 함께 남긴다. 분석 결과로 임계값·가중치가 확정되면
 * 그 이전에 매긴 점수만 골라 다시 계산할 수 있다.
 *
 * <p><b>이것은 공사 데이터의 적재가 아니다.</b> 한적도 계산·대안 추천·날짜 대안은 지금처럼
 * 매 요청 실시간 호출한다. 여기 남는 것은 사용자가 저장한 코스의 진단 결과 스냅샷 한 줄뿐이다.
 */
@Entity
@Table(name = "saved_courses")
public class SavedCourse {

	public static final int NAME_MAX_LENGTH = 30;

	/**
	 * 회원 한 명이 저장할 수 있는 코스 수.
	 *
	 * <p>상한이 없으면 저장이 무한히 쌓여 목록 조회가 느려지고 저장소가 는다.
	 * 50개는 "실제로 쓰다 보면 닿지 않지만 폭주는 막는" 선이다.
	 */
	public static final int MAX_PER_MEMBER = 50;

	/**
	 * 저장할 때 넘기는 장소 한 줄. 도메인이 요청 DTO를 알지 않게 하려고 여기 둔다.
	 *
	 * @param placeName 저장 시점의 장소 이름. <b>서비스가 장소 쪽에서 찾아 채운다.</b>
	 *                  요청에서 그대로 받지 않는 이유: 화면에 남을 이름을 클라이언트가
	 *                  정하게 두면 저장된 코스가 실제 장소와 다른 것을 가리킬 수 있다
	 */
	public record PlaceEntry(int day, int order, String placeId, String placeName) {
	}

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 주인.
	 *
	 * <p>{@code LAZY}인 이유: 목록을 뽑을 때 코스마다 회원을 한 번씩 더 읽을 이유가 없다.
	 * 어차피 "내 코스"만 조회하므로 누구인지는 이미 알고 있다.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "member_id", nullable = false)
	private Member member;

	/** 사용자가 붙인 여행 이름. 예: "한적한 경주 첫 여행" */
	@Column(nullable = false, length = NAME_MAX_LENGTH)
	private String name;

	/** 지역 슬러그. 예: "gyeongju" */
	@Column(nullable = false, length = 32)
	private String region;

	@Column(nullable = false)
	private LocalDate startDate;

	/** 박 수. 당일치기는 0 */
	@Column(nullable = false)
	private int nights;

	/**
	 * 저장 시점의 코스 총점 (0~100, 클수록 한적). <b>없을 수 있다.</b>
	 *
	 * <h3>점수 없이 저장되는 코스 (2026-08-26)</h3>
	 * 두 경우가 있고 <b>사용자에게 뜻이 다르다.</b>
	 * <ul>
	 *   <li><b>아직</b> 없다 — 여행일이 예측 창 밖이다. 여행이 가까워지면 생긴다</li>
	 *   <li><b>영영</b> 없다 — 밥집만 담은 코스다. 집중률이 관광지만 예측한다</li>
	 * </ul>
	 *
	 * <p>둘 다 저장을 막지 않는다. 저장은 <b>재료</b>(지역·날짜·장소·순서)를 남기는 일이고,
	 * 점수 스냅샷은 있으면 함께 남기는 것이다. 미리 짜 두고 여행이 가까워지면 다시 진단하는
	 * 흐름이 성립하려면 점수가 없어도 저장이 되어야 한다.
	 *
	 * <p>⚠️ 0으로 채우지 않는다. 0은 화면에서 "매우 붐빔"으로 읽혀, 아직 재보지도 않은 코스를
	 * 최악이라고 말하게 된다.
	 */
	@Column
	private Integer totalQuietness;

	/**
	 * 그 총점이 <b>몇 곳을 근거로 한 값인가.</b>
	 *
	 * <p>점수만 남기면 나중에 열었을 때 관광지 다섯 곳을 담아 하나만 진단된 코스인지
	 * 다섯 곳이 다 진단된 코스인지 구분할 수 없다. 코스끼리 견줄 때 특히 그렇다 —
	 * 근거가 얇은 점수와 두꺼운 점수가 같은 무게로 나란히 선다.
	 *
	 * <p>화면에 숫자를 띄울지는 진단 때 이미 갈렸지만({@code CourseScoreStandard}),
	 * <b>저장은 조건과 무관하게 열려 있다.</b> 그래서 여기에 모수를 함께 남긴다 —
	 * 숫자를 감추는 대신 맥락을 붙이는 쪽을 골랐다.
	 *
	 * <p>⚠️ <b>옛 코스는 {@code null}이다.</b> 이 컬럼이 생기기 전에 저장된 것들이라
	 * 모수를 알 길이 없다. 화면은 그때 숫자만 보여주고 "몇 곳 중 몇 곳"을 말하지 않는다 —
	 * 모르는 것을 0으로 채우면 "근거가 하나도 없는 점수"라는 거짓말이 된다.
	 */
	@Column
	private Integer diagnosedCount;

	/** 예측 대상 관광지 수. 총점의 분모. 옛 코스는 {@code null} */
	@Column
	private Integer forecastTargetCount;

	/**
	 * 그 점수를 매긴 시각. 기준이 바뀌었을 때 다시 계산할 대상을 고르는 데 쓴다.
	 *
	 * <p><b>총점과 운명을 같이한다</b> — 점수가 없으면 점수를 매긴 시각도 없다.
	 * 저장 시각으로 채워 두면 "언제 매긴 점수인가"에 매기지도 않은 시각이 답하게 된다.
	 * 저장 시각은 {@link #createdAt}이 따로 갖고 있다.
	 */
	@Column
	private Instant scoredAt;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * 담긴 장소들.
	 *
	 * <p>{@code orphanRemoval}이 있어야 코스를 지울 때 장소도 함께 사라진다.
	 * {@code @OrderBy}로 일차·순서를 DB가 정렬해 돌려주므로 화면에서 다시 정렬하지 않는다.
	 */
	@OneToMany(mappedBy = "savedCourse", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("day ASC, visitOrder ASC")
	private List<SavedCoursePlace> places = new ArrayList<>();

	/** JPA가 프록시를 만들 때 쓴다. 애플리케이션 코드에서 부르지 않는다. */
	protected SavedCourse() {
	}

	private SavedCourse(
			Member member,
			String name,
			String region,
			LocalDate startDate,
			int nights,
			Integer totalQuietness,
			Integer diagnosedCount,
			Integer forecastTargetCount,
			List<PlaceEntry> entries,
			Instant now) {

		this.member = Objects.requireNonNull(member, "회원은 필수입니다.");
		this.name = validateName(name);
		// 지원하지 않는 지역이면 여기서 걸린다. 슬러그를 그대로 저장해 URL과 같은 값을 쓴다.
		this.region = SupportedRegion.fromSlug(region).slug();
		this.startDate = Objects.requireNonNull(startDate, "시작일은 필수입니다.");
		this.nights = validateNights(nights);
		// 총점은 없을 수 있다. 있을 때만 범위를 본다.
		if (totalQuietness != null) {
			Scores.validate(totalQuietness, "코스 총점");
		}
		this.totalQuietness = totalQuietness;
		/*
		 * 모수는 <b>둘 다 있거나 둘 다 없어야 한다.</b> 하나만 있으면 "몇 곳 중 몇 곳"을
		 * 완성할 수 없는데, 화면은 값이 있는 쪽만 보고 말하려 든다.
		 */
		if (diagnosedCount != null && forecastTargetCount != null) {
			this.diagnosedCount = diagnosedCount;
			this.forecastTargetCount = forecastTargetCount;
		}
		Objects.requireNonNull(now, "저장 시각은 필수입니다.");
		// 점수가 없으면 점수를 매긴 시각도 없다.
		this.scoredAt = totalQuietness == null ? null : now;
		this.createdAt = now;

		addPlaces(entries);
	}

	/**
	 * 코스를 저장한다.
	 *
	 * @param totalQuietness      진단 화면이 받아 온 총점. 서버가 방금 내려준 값을 그대로 남긴다.
	 *                            <b>아직/영영 진단되지 않은 코스는 {@code null}</b>
	 * @param diagnosedCount      그 총점을 매긴 칸 수. 모르면 {@code null}
	 * @param forecastTargetCount 예측 대상 관광지 수. 모르면 {@code null}
	 * @param entries             담긴 장소들. 비어 있으면 거부한다
	 * @param now                 저장 시각이자 점수를 매긴 시각
	 */
	public static SavedCourse save(
			Member member,
			String name,
			String region,
			LocalDate startDate,
			int nights,
			Integer totalQuietness,
			Integer diagnosedCount,
			Integer forecastTargetCount,
			List<PlaceEntry> entries,
			Instant now) {

		return new SavedCourse(member, name, region, startDate, nights, totalQuietness,
				diagnosedCount, forecastTargetCount, entries, now);
	}

	private void addPlaces(List<PlaceEntry> entries) {
		if (entries == null || entries.isEmpty()) {
			throw new IllegalArgumentException("장소가 하나도 없는 코스는 저장할 수 없습니다.");
		}
		for (PlaceEntry entry : entries) {
			if (entry.day() > days()) {
				// 진단 요청과 같은 규칙이다. 기간을 벗어난 일차가 섞이면 화면이 조용히 깨진다.
				throw new IllegalArgumentException(
						"%d박 %d일 일정에 %d일차 장소가 있습니다.".formatted(nights, days(), entry.day()));
			}
			places.add(new SavedCoursePlace(
					this, entry.day(), entry.order(), entry.placeId(), entry.placeName()));
		}
	}

	private static String validateName(String name) {
		String trimmed = Texts.requireNotBlank(name, "여행 이름");
		if (trimmed.length() > NAME_MAX_LENGTH) {
			throw new IllegalArgumentException(
					"여행 이름은 %d자 이하여야 합니다. 입력값 길이: %d".formatted(NAME_MAX_LENGTH, trimmed.length()));
		}
		return trimmed;
	}

	private static int validateNights(int nights) {
		if (nights < 0) {
			throw new IllegalArgumentException("박 수는 0 이상이어야 합니다. 입력값: " + nights);
		}
		return nights;
	}

	/** 이 코스가 그 회원의 것인지. 조회는 리포지토리가 걸러내지만, 확인이 필요한 자리를 위해 남긴다 */
	public boolean isOwnedBy(Long memberId) {
		return member.id().equals(memberId);
	}

	/** 2박 3일이면 3 */
	public int days() {
		return nights + 1;
	}

	public LocalDate endDate() {
		return startDate.plusDays(nights);
	}

	public Long id() {
		return id;
	}

	public String name() {
		return name;
	}

	public String region() {
		return region;
	}

	public LocalDate startDate() {
		return startDate;
	}

	public int nights() {
		return nights;
	}

	public Integer totalQuietness() {
		return totalQuietness;
	}

	/** 총점을 매긴 칸 수. 이 컬럼이 생기기 전에 저장된 코스는 {@code null} */
	public Integer diagnosedCount() {
		return diagnosedCount;
	}

	/** 예측 대상 관광지 수. 이 컬럼이 생기기 전에 저장된 코스는 {@code null} */
	public Integer forecastTargetCount() {
		return forecastTargetCount;
	}

	public Instant scoredAt() {
		return scoredAt;
	}

	public Instant createdAt() {
		return createdAt;
	}

	/** 밖에서 목록을 고쳐도 코스가 흔들리지 않게 읽기 전용으로 내보낸다. */
	public List<SavedCoursePlace> places() {
		return List.copyOf(places);
	}
}
