package com.peakoff.course.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.course.domain.SavedCourse;
import com.peakoff.course.domain.SavedCoursePlace;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 저장된 코스를 요약한 것. 홈의 "요즘 저장된 여행"에 쓴다.
 *
 * <h2>무엇을 빼는가</h2>
 * <b>코스 id</b>가 없다.
 *
 * <p>id가 없는 것은 열어 볼 길을 아예 두지 않기 위해서다. 있으면 언젠가 "눌러서 자세히"가
 * 붙고, 그때 남의 코스가 통째로 열린다. 목록에 담지 않으면 그 유혹이 생기지 않는다.
 *
 * <h2>닉네임을 내보낸다 (2026-08-31)</h2>
 * 카드 제목이 <b>"챔석님의 경주"</b>가 되면서 필요해졌다. 코스 이름 대신 이 꼴로 세우면
 * 목록이 "누가 어디를 다녀왔나"로 읽힌다 — 사용자가 지은 이름은 저마다 문법이 달라
 * ("엄마 생신 여행", "경주 2일") 카드 다섯이 한 목록으로 읽히지 않았다.
 *
 * <p>⚠️ <b>이메일이나 회원 번호는 나가지 않는다.</b> 닉네임은 회원가입 때부터
 * "화면에 표시할 이름"으로 받은 값이고(개인정보 처리방침), 코스를 가리키는 주소가 되지도
 * 않는다. 그래도 <b>공개 토글의 문구와 한 몸이다</b> — 무엇이 나가는지 그 자리에서
 * 말하지 않으면 사용자는 이름만 나가는 줄 안다.
 *
 * <h2>코스 이름은 다시 뺐다 (2026-08-31)</h2>
 * 2026-08-27에 내보내기로 했던 값이다. 지역과 기간만으로는 어느 카드나
 * "경주 1박 2일"이라 서로 구분되지 않아서였고, 대신 저장 화면이 그 사실을 알렸다.
 *
 * <p>카드 제목이 <b>"챔석님의 경주"</b>가 되면서 그 역할이 <b>닉네임으로 넘어갔다.</b>
 * 구분은 이제 사람이 하고, 코스 이름은 화면 어디에도 서지 않는다.
 *
 * <p>그러면 <b>보내지도 않는다.</b> 화면이 쓰지 않는 값을 응답에 남겨 두면,
 * 개발자 도구를 여는 것만으로 "엄마 생신 여행"이 보인다 — 2026-08-27에 걱정했던 바로
 * 그 문자열이다. 쓰지 않을 것은 내보내지 않는 편이 안전하고, 필요해지면 그때 다시 넣는다.
 *
 * <h2>무엇을 남기는가</h2>
 * 지역·기간·총점, 그리고 <b>담긴 장소 전부</b>. 장소는 공공 관광지라 개인을 가리키지 않고,
 * 이것이 없으면 "다른 사람의 여행"이라는 느낌이 남지 않는다 — 숫자만 늘어놓은 표는
 * 남의 여행으로 읽히지 않는다.
 *
 * <h2>맛보기 셋에서 전부로 바꾼 이유 (2026-08-25)</h2>
 * 홈에서 카드를 눌러 코스를 펼쳐 볼 수 있게 됐다. 위 주석이 걱정하던 바로 그 화면인데,
 * <b>코스 id를 되살리는 대신 목록 응답에 장소를 전부 실었다.</b>
 *
 * <p>id를 주고 상세 엔드포인트를 여는 쪽이 흔한 설계지만, 그러면 번호를 훑어 남의 코스를
 * 하나씩 여는 통로가 생긴다. 여기서는 <b>주소가 없는 채로</b> 내용만 나가므로 그 통로가
 * 열리지 않는다 — 홈이 고른 최근 몇 개 말고는 아무것도 가리킬 수 없다.
 * 누를 때 추가 호출이 없다는 것도 덤이다.
 *
 * <p>앞쪽 몇 개만 자르던 일은 화면이 맡는다. 카드에는 여전히 세 곳만 보이고,
 * 나머지는 펼쳤을 때 나온다.
 *
 * @param places 담긴 순서(일차·순번)대로 <b>전부</b>. 화면이 앞에서 몇 개만 잘라 쓴다
 */
public record PublicCourseSummary(
		/** 저장한 사람의 닉네임. 카드 제목이 "OO님의 OO"로 서는 데 쓴다 */
		String nickname,
		String region,
		String regionName,
		/**
		 * 짧은 지역 이름("경주"). {@code regionName}은 정식 이름("경상북도 경주시")이라
		 * 제목에 그대로 넣으면 "챔석님의 경상북도 경주시"가 된다.
		 *
		 * <p>화면이 앞을 잘라 쓰지 않는 이유: 그렇게 하면 "경주시"까지밖에 못 줄이고,
		 * 무엇보다 <b>표기 규칙이 화면으로 새어 나간다</b>. 제주만 "제주시"로 두는 판단은
		 * 서버({@code SupportedRegion.shortName})의 것이다.
		 */
		String regionShortName,
		LocalDate startDate,
		LocalDate endDate,
		int nights,
		int days,
		int totalQuietness,
		CongestionLevel level,
		String levelLabel,
		List<PublicPlace> places,
		Instant createdAt) {

	/**
	 * 남의 코스에 담긴 장소 한 곳.
	 *
	 * @param placeId <b>관광지 식별자이지, 코스 식별자가 아니다.</b> 공사 콘텐츠 ID라
	 *                누구나 조회할 수 있는 공개 값이고 저장한 사람을 가리키지 않는다.
	 *                이것이 있어야 "이 코스로 나도 짜보기"가 성립한다 — 이름만으로는
	 *                같은 장소를 다시 찾을 수 없다(집중률 API의 이름 매칭이 어려운 이유와 같다).
	 * @param name    저장 시점의 이름. 화면에 보이는 것은 이 값이다
	 */
	public record PublicPlace(int day, int order, String placeId, String name) {
	}

	/**
	 * ⚠️ <b>총점이 있는 코스만 넘어온다.</b> {@code SavedCourseService.recent()}가 걸러 준다 —
	 * 이 응답에는 점수를 비울 자리가 없다(원형 게이지와 배지가 그 값을 전제한다).
	 */
	public static PublicCourseSummary from(SavedCourse course) {
		CongestionLevel level = CongestionLevel.fromQuietness(course.totalQuietness());

		// 담은 순서대로. 무작위로 섞으면 같은 코스가 볼 때마다 달라 보인다.
		List<PublicPlace> places = course.places().stream()
				.sorted(Comparator.comparingInt(SavedCoursePlace::day)
						.thenComparingInt(SavedCoursePlace::visitOrder))
				.map(place -> new PublicPlace(
						place.day(),
						place.visitOrder(),
						place.placeId(),
						place.placeName()))
				.toList();

		SupportedRegion region = SupportedRegion.fromSlug(course.region());
		return new PublicCourseSummary(
				course.authorNickname(),
				course.region(),
				region.displayName(),
				region.shortName(),
				course.startDate(),
				course.endDate(),
				course.nights(),
				course.days(),
				course.totalQuietness(),
				level,
				level.label(),
				places,
				course.createdAt());
	}
}
