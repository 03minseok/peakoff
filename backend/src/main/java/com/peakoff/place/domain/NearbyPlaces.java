package com.peakoff.place.domain;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * 후보 무더기에서 "기준 장소 근처의 같은 분류 장소"를 골라낸다.
 *
 * <p>후보를 <b>어디서 가져올지는 여기서 정하지 않는다.</b> 실데이터는 지역 카탈로그에서,
 * 목업은 목업 목록에서 가져온다. 여기는 "주어진 무더기에서 무엇을 남길 것인가"만 답한다 —
 * 두 구현이 같은 규칙을 각자 적어 두면 한쪽만 고쳐지는 사고가 난다.
 */
public final class NearbyPlaces {

	/**
	 * 이 거리 밖은 보여주지 않는다.
	 *
	 * <p>5km는 경주 시내를 한 바퀴 도는 정도다. "그 자리 대신 갈 만한 곳"으로 읽히려면
	 * 이 정도여야 한다 — 30km 떨어진 밥집은 같은 코스의 같은 칸을 대신할 수 없다.
	 *
	 * <p>⚠️ 대신 <b>감포항처럼 외곽에 담은 곳은 후보가 적거나 아예 없다.</b>
	 * 그 경우 빈 목록이 나가고 화면이 "가까운 곳을 찾지 못했어요"라고 말한다.
	 * 억지로 반경을 넓혀 먼 곳을 채우는 것보다 없다고 말하는 편이 정직하다.
	 *
	 * <p><b>분석 검증 전 임시값이다.</b>
	 */
	public static final double DEFAULT_RADIUS_KM = 5.0;

	private NearbyPlaces() {
	}

	/**
	 * @param candidates 훑을 장소들. 기준 장소가 섞여 있어도 된다 — 여기서 걸러낸다
	 * @param origin     기준 장소
	 * @param radiusKm   이 거리 안까지만
	 * @param limit      최대 개수
	 */
	public static List<NearbyPlace> from(Collection<Place> candidates, Place origin,
			double radiusKm, int limit) {

		if (candidates == null || origin == null) {
			return List.of();
		}
		if (limit < 1) {
			throw new IllegalArgumentException("개수는 1 이상이어야 합니다. 입력값: " + limit);
		}

		return candidates.stream()
				// 자기 자신은 대신할 수 없다.
				.filter(candidate -> !candidate.id().equals(origin.id()))
				/*
				 * 분류가 같아야 한다. 밥집 자리에 숙소를 내밀면 코스의 그 칸이 하려던 일이 바뀐다.
				 * 대안 추천이 쓰는 기준과 같다 — 그쪽은 점수까지 매기지만 이 조건은 공통이다.
				 */
				.filter(candidate -> sameCategory(candidate, origin))
				.map(candidate -> new NearbyPlace(candidate, Distances.betweenKm(origin, candidate)))
				.filter(nearby -> nearby.distanceKm() <= radiusKm)
				// 점수가 없으므로 줄을 세울 것은 거리뿐이다. 화면에 보이는 값으로 정렬한다.
				.sorted(Comparator.comparingDouble(NearbyPlace::distanceKm))
				.limit(limit)
				.toList();
	}

	/**
	 * 분류를 모르는 장소는 <b>어느 것과도 같지 않다고 본다.</b>
	 *
	 * <p>모르는 것끼리 묶으면 "기타" 무더기가 서로의 대체재가 되어, 성격이 전혀 다른 곳이
	 * 같은 칸의 후보로 올라온다.
	 */
	private static boolean sameCategory(Place candidate, Place origin) {
		return candidate.category() != null
				&& origin.category() != null
				&& candidate.category().code().equals(origin.category().code());
	}
}
