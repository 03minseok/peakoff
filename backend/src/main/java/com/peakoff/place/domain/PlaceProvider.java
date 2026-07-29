package com.peakoff.place.domain;

import java.util.List;
import java.util.Optional;

/**
 * 관광지 목록을 공급한다.
 *
 * <p>이 인터페이스가 <b>교체 지점</b>이다. 지금은 목업 구현이 붙어 있고,
 * 나중에 공공데이터 API를 호출하는 구현으로 갈아끼운다.
 * 이걸 쓰는 쪽(서비스·컨트롤러)은 어느 구현이 붙었는지 알 필요가 없다.
 */
public interface PlaceProvider {

	/** 해당 지역의 관광지 전체. 지역에 데이터가 없으면 빈 목록. */
	List<Place> findByRegion(Region region);

	Optional<Place> findById(String placeId);
}
