package com.peakoff.favorite.domain;

import java.time.Instant;
import java.util.Objects;

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

import com.peakoff.global.support.Texts;
import com.peakoff.member.domain.Member;
import com.peakoff.place.domain.Place;

/**
 * 회원이 찜해 둔 장소 한 곳.
 *
 * <h2>⚠️ 공사 데이터를 적재하는 것이 아니다</h2>
 * 절대 규칙 1은 <b>공사가 준 자료를 DB에 쌓아 API를 사실상 호출하지 않는 구조</b>를 금한다.
 * 여기 남는 것은 그 자료가 아니라 <b>사용자가 눌렀다는 사실</b>이고, 한적도·집중률·분류처럼
 * 공사가 계산해 주는 값은 하나도 담지 않는다 — 그것들은 화면을 그릴 때마다 여전히
 * 공사에서 받아 온다. {@code SavedCoursePlace}가 코스에 담긴 장소를 남기는 것과 같은 성격이다.
 *
 * <h2>이름을 함께 남기는 이유</h2>
 * 목록을 열 때마다 장소 수만큼 공사를 부르지 않기 위해서다. 찜하는 일은 가끔이고
 * 목록을 여는 일은 자주다 — 자주 도는 쪽에서 비용을 걷어내고 가끔 도는 쪽에 한 번 둔다.
 * 저장 코스가 같은 맞바꿈을 한다({@code SavedCourseService.toEntries}).
 *
 * <p>⚠️ <b>이름은 서버가 찾아 넣는다.</b> 요청에서 받으면 찜 목록이 실제 장소와 다른 것을
 * 가리킬 수 있다. 출처가 서버여야 믿을 수 있다.
 *
 * <h2>같은 곳을 두 번 찜할 수 없다</h2>
 * {@code (member_id, place_id)}에 유니크 제약을 건다. 화면이 토글이라 두 번 눌릴 일이 없어
 * 보이지만, 연타나 두 탭에서는 실제로 두 번 들어온다 — 그러면 목록에 같은 카드가 둘 서고,
 * 취소를 눌러도 하나만 지워진다.
 */
@Entity
@Table(
		name = "favorite_places",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_favorite_member_place",
				columnNames = {"member_id", "place_id"}))
public class FavoritePlace {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "member_id", nullable = false)
	private Member member;

	/** 공사 콘텐츠 ID. 우리가 발급한 값이 아니라 문자열로 받는다 */
	@Column(name = "place_id", nullable = false, length = 64)
	private String placeId;

	/**
	 * 찜한 시점의 <b>표시용 값들</b>. 목록을 그릴 때 공사를 다시 부르지 않게 한다.
	 *
	 * <p>⚠️ <b>여기까지가 경계다.</b> 이름·분류·사진은 화면에 그대로 찍히는 값이고,
	 * 우리가 계산에 쓰는 값(한적도·집중률)은 하나도 담지 않는다 — 그것들은 화면을 그릴
	 * 때마다 여전히 공사에서 받아 온다. 절대 규칙 1이 막는 것은 "공사를 사실상 부르지 않는
	 * 구조"이지 화면에 남길 이름표가 아니다.
	 *
	 * <p>사진은 없을 수 있다. 공사 관광지 중 이미지가 빈 곳이 흔하다.
	 *
	 * <h3>⚠️ 분류와 사진 칸은 <b>DB에서 null을 허용한다</b> (2026-08-31)</h3>
	 * 이 둘은 이름보다 <b>나중에</b> 생긴 칸이다. {@code ddl-auto: update}는 이미 행이 있는
	 * 테이블에 {@code not null} 컬럼을 붙이지 못한다 — 기존 행을 채울 값이 없어서
	 * <b>서버가 아예 뜨지 않는다.</b> 실제로 그렇게 한 번 죽었다:
	 *
	 * <pre>
	 * Error executing DDL "alter table favorite_places add column category_name varchar(50) not null"
	 *   NULL not allowed for column "CATEGORY_NAME"
	 * </pre>
	 *
	 * <p>그래서 <b>제약은 풀되 앱은 늘 채운다</b> — 아래 생성자가 빈 값을 거절하므로
	 * 지금부터 들어오는 행에는 반드시 값이 있고, null인 것은 이 칸이 생기기 전에 찜한 행뿐이다.
	 * 화면은 그 자리를 비워 그린다(다시 찜하면 채워진다).
	 *
	 * <p>⚠️ <b>앞으로 칸을 더할 때도 같다.</b> 이 저장소에는 마이그레이션 도구가 없다
	 * ({@code ddl-auto: update}). 새 칸은 null을 허용하거나, 기존 행이 없다고 확신할 때만
	 * {@code not null}로 둔다.
	 */
	@Column(name = "place_name", nullable = false, length = 100)
	private String placeName;

	@Column(name = "category_name", length = 50)
	private String categoryName;

	/** 대표 이미지. <b>없을 수 있다</b> — 그때는 화면이 이름 첫 글자를 대신 세운다 */
	@Column(name = "image_url", length = 500)
	private String imageUrl;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected FavoritePlace() {
	}

	private FavoritePlace(Member member, Place place, Instant now) {
		Objects.requireNonNull(place, "장소는 필수입니다.");
		this.member = Objects.requireNonNull(member, "회원은 필수입니다.");
		this.placeId = Texts.requireNotBlank(place.id(), "장소 ID");
		this.placeName = Texts.requireNotBlank(place.name(), "장소 이름");
		this.categoryName = Texts.requireNotBlank(place.category().name(), "분류 이름");
		this.imageUrl = place.imageUrl();
		this.createdAt = Objects.requireNonNull(now, "생성 시각은 필수입니다.");
	}

	/**
	 * 장소를 통째로 받는다. 필드를 하나씩 받으면 부르는 쪽이 어느 값을 남길지 정하게 되고,
	 * 화면에 쓸 값이 늘 때마다 시그니처와 호출부를 함께 고쳐야 한다.
	 */
	public static FavoritePlace of(Member member, Place place, Instant now) {
		return new FavoritePlace(member, place, now);
	}

	public String placeId() {
		return placeId;
	}

	public String placeName() {
		return placeName;
	}

	public String categoryName() {
		return categoryName;
	}

	public String imageUrl() {
		return imageUrl;
	}

	public Instant createdAt() {
		return createdAt;
	}
}
