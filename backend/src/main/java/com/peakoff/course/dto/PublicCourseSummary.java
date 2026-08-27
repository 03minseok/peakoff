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
 * 남이 저장한 코스를 <b>익명으로</b> 요약한 것. 홈의 "다른 사람들의 여행"에 쓴다.
 *
 * <h2>무엇을 빼는가</h2>
 * <b>코스 id와 저장한 사람</b>이 없다.
 *
 * <p>id가 없는 것은 열어 볼 길을 아예 두지 않기 위해서다. 있으면 언젠가 "눌러서 자세히"가
 * 붙고, 그때 남의 코스가 통째로 열린다. 목록에 담지 않으면 그 유혹이 생기지 않는다.
 *
 * <h2>이름은 내보낸다 (2026-08-27)</h2>
 * 예전에는 뺐다. <b>"사용자가 자기만 볼 줄 알고 지은 것"</b>이라는 이유였고,
 * "엄마 생신 여행" 같은 이름이 공개에 동의 없이 나가는 것을 걱정했다.
 *
 * <p>대신 <b>저장할 때 그 사실을 알린다.</b> 이름 입력칸 아래에 홈에 보일 수 있다고 적어 두면,
 * 사용자가 알고 짓는다 — 감추는 것보다 알리는 쪽이 정직하고, 그러면 이름은
 * "남의 여행"을 남의 여행답게 만드는 재료가 된다. 지역과 기간만으로는
 * 어느 카드나 "경주 1박 2일"이라 서로 구분되지 않았다.
 *
 * <p>⚠️ 이름을 내보내기로 한 이상 <b>저장 화면의 안내와 한 몸이다.</b> 그 안내를 떼면
 * 사용자는 다시 자기만 볼 줄 알고 이름을 짓는다.
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
		String name,
		String region,
		String regionName,
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

		return new PublicCourseSummary(
				course.name(),
				course.region(),
				SupportedRegion.fromSlug(course.region()).displayName(),
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
