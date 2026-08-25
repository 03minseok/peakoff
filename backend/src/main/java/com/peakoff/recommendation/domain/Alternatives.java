package com.peakoff.recommendation.domain;

import java.util.List;
import java.util.Objects;

import com.peakoff.congestion.domain.CongestionLevel;
import com.peakoff.global.support.Scores;

/**
 * 장소 교체 추천의 답 전체. 후보 목록<b>과</b> 그 목록이 그렇게 나온 이유를 함께 담는다.
 *
 * <p>예전에는 {@code List<Alternative>}만 돌려줬다. 개선폭 하한이 생기기 전에는 목록이
 * 비는 일이 드물었고, 비어도 "못 찾았다" 하나뿐이라 이유를 물을 일이 없었다.
 * 지금은 다르다 — 비는 경우가 흔해졌고 그 이유가 여럿이다({@link PlaceOffStatus}).
 *
 * <p>날짜 대안이 같은 모양을 이미 쓴다({@code DateAlternativeResponse}) — 상태와 임계값과
 * 목록이 한 덩어리로 나간다. 두 회피 경로(날짜·장소)가 같은 모양으로 답해야
 * 화면이 같은 방식으로 말할 수 있다.
 *
 * @param status           왜 이런 목록이 나왔는가
 * @param originQuietness  원래 장소의 그 날 한적도. 모르면 {@code null}.
 *                         후보의 절대 점수만 보여주면 "이게 지금보다 나은가"를 사용자가
 *                         암산해야 한다 — 비교 대상을 함께 내려보낸다
 * @param picked           추천도 순으로 정렬된 후보. 없으면 빈 목록
 */
public record Alternatives(
		PlaceOffStatus status,
		Integer originQuietness,
		List<Alternative> picked) {

	public Alternatives {
		Objects.requireNonNull(status, "추천 상태는 필수입니다.");
		if (originQuietness != null) {
			Scores.validate(originQuietness, "원래 장소의 한적도");
		}
		Objects.requireNonNull(picked, "후보 목록은 필수입니다.");
		picked = List.copyOf(picked);
		/*
		 * 상태와 목록이 어긋나면 화면이 어느 쪽을 믿어야 할지 알 수 없다.
		 * "추천했다"면서 목록이 비어 있거나, 못 찾았다면서 후보가 담겨 있으면 안 된다.
		 */
		if (status == PlaceOffStatus.RECOMMENDED && picked.isEmpty()) {
			throw new IllegalArgumentException("추천했다고 하면서 후보가 비어 있습니다.");
		}
		if (status != PlaceOffStatus.RECOMMENDED && !picked.isEmpty()) {
			throw new IllegalArgumentException(
					"추천하지 않는다면서 후보가 담겨 있습니다. status=" + status);
		}
	}

	/**
	 * 원래 장소의 한적도를 모르는 자리. <b>개선폭을 잴 기준이 없다.</b>
	 *
	 * <p>음식점·숙박처럼 공사가 예측하지 않는 분류가 여기 온다.
	 */
	public static Alternatives originNotForecasted() {
		return new Alternatives(PlaceOffStatus.ORIGIN_NOT_FORECASTED, null, List.of());
	}

	/**
	 * 후보를 다 거르고 뽑은 결과로 답을 만든다. <b>상태는 여기서 정한다.</b>
	 *
	 * <p>판정을 한 곳에 모으는 이유: 목업과 실데이터 공급자가 각자 상태를 정하면
	 * 같은 상황에 다른 답이 나온다. 공급자는 "무엇을 찾았는가"만 전하고
	 * "그것을 뭐라고 부를지"는 여기가 정한다.
	 *
	 * @param originQuietness 원래 장소의 그 날 한적도
	 * @param consideredCount 지역·분류·자료 조건까지 통과해 <b>개선폭을 따져 본</b> 후보 수.
	 *                        이 값이 0인 것과 0이 아닌데 아무도 못 넘은 것은 다른 상황이다
	 * @param picked          최종적으로 뽑힌 후보
	 */
	public static Alternatives of(int originQuietness, int consideredCount, List<Alternative> picked) {
		return new Alternatives(decide(originQuietness, consideredCount, picked), originQuietness, picked);
	}

	/**
	 * 상태를 정한다. <b>위에서부터 먼저 들어맞는 것을 쓴다.</b>
	 *
	 * <p>조건을 병렬로 두면 둘이 동시에 참일 때 어느 쪽이 보일지가 코드 순서로 우연히 정해진다.
	 * 순서 자체가 규칙이라 여기 한 곳에 모아 둔다 — 날짜 대안의 {@code decide}와 같은 이유다.
	 */
	private static PlaceOffStatus decide(int originQuietness, int consideredCount,
			List<Alternative> picked) {

		if (!picked.isEmpty()) {
			return PlaceOffStatus.RECOMMENDED;
		}
		// 개선폭까지 가 보지도 못했다. "더 나은 곳이 없다"와는 다른 말이다.
		if (consideredCount == 0) {
			return PlaceOffStatus.NO_VALID_CANDIDATE;
		}
		/*
		 * 후보는 있었는데 아무도 하한을 넘지 못했다. 원래 자리가 이미 한적하면
		 * 그것은 우리가 못 찾은 것이 아니라 사용자가 잘 고른 것이다.
		 */
		if (CongestionLevel.fromQuietness(originQuietness) == CongestionLevel.QUIET) {
			return PlaceOffStatus.ALREADY_QUIET;
		}
		return PlaceOffStatus.NO_MEANINGFUL_IMPROVEMENT;
	}
}
