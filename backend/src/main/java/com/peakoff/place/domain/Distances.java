package com.peakoff.place.domain;

/**
 * 두 장소 사이의 직선 거리.
 *
 * <p>추천도의 "동선 근접도" 항목에 쓴다. 실제 도로 거리가 아니라 직선 거리인 이유는,
 * 최단 경로 최적화는 이 서비스의 범위가 아니고 "근처인가 아닌가"만 가리면 충분하기 때문이다.
 */
public final class Distances {

	private static final double EARTH_RADIUS_KM = 6371.0;

	private Distances() {
	}

	/** 하버사인 공식. 지구를 구로 보고 두 좌표 사이의 대권 거리를 구한다. */
	public static double betweenKm(Place a, Place b) {
		double lat1 = Math.toRadians(a.latitude());
		double lat2 = Math.toRadians(b.latitude());
		double deltaLat = Math.toRadians(b.latitude() - a.latitude());
		double deltaLon = Math.toRadians(b.longitude() - a.longitude());

		double h = Math.pow(Math.sin(deltaLat / 2), 2)
				+ Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLon / 2), 2);

		return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(h)));
	}
}
