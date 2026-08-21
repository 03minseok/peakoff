package com.peakoff.place.domain;

import java.util.List;
import java.util.Optional;

/**
 * 관광지 목록을 공급한다.
 *
 * <p>이 인터페이스가 <b>교체 지점</b>이다. 목업 구현과 공공데이터 구현이 같은 모양을 지킨다.
 * 이걸 쓰는 쪽(서비스·컨트롤러)은 어느 구현이 붙었는지 알 필요가 없다.
 *
 * <h3>왜 "지역 전체 목록"이 없는가</h3>
 * 예전에는 {@code findByRegion}으로 지역의 모든 장소를 돌려줬다. 경주만 621곳이고
 * 지역이 늘면 수천 곳이 된다 — <b>화면에 늘어놓을 수 있는 양이 아니다.</b>
 * 그래서 장소는 검색으로 찾고, 검색 전에는 대표 관광지를 보여준다.
 *
 * <p>서버가 지역 자료를 통째로 캐시하는 것과는 다른 이야기다. 그건 빠르게 답하기 위한
 * 내부 사정이고, 이 인터페이스는 <b>화면이 감당할 수 있는 모양</b>으로만 답한다.
 */
public interface PlaceProvider {

	/**
	 * 이름에 검색어가 든 장소를 찾는다. 검색 범위는 그 지역 안으로 제한된다.
	 *
	 * @param limit 최대 개수. 화면이 한 번에 보여줄 만큼만
	 * @return 없으면 빈 목록. 검색은 "못 찾음"이 정상적인 결과다
	 */
	List<Place> search(Region region, String keyword, int limit);

	/**
	 * 지역을 대표하는 관광지를 <b>대표성 순으로</b> 돌려준다.
	 *
	 * <p>검색어를 아직 안 친 화면에 보여줄 목록이다. 빈 검색창만 두면 그 지역을 모르는
	 * 사용자는 첫 글자를 치지 못한다.
	 *
	 * <p>⚠️ 이 순서는 <b>인기 순</b>이지 추천 순이 아니다. 인기 장소는 붐비는 장소이므로
	 * 추천 점수에 가점으로 쓰면 오버투어리즘 과제와 어긋난다. 목록을 늘어놓는 순서로만 쓴다.
	 */
	List<Place> representatives(Region region, int limit);

	Optional<Place> findById(String placeId);
}
