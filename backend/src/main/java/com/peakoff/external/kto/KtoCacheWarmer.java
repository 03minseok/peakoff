package com.peakoff.external.kto;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.peakoff.external.kto.client.KtoCongestionClient;
import com.peakoff.external.kto.client.KtoPlaceClient;
import com.peakoff.external.kto.provider.KtoCongestionProvider;
import com.peakoff.external.kto.provider.KtoPlaceProvider;
import com.peakoff.place.domain.SupportedRegion;

/**
 * 공사 원자료 캐시를 <b>요청이 오기 전에</b> 채운다 — 프리워밍.
 *
 * <h2>왜 필요한가 (2026-09-09 실측)</h2>
 * 홈 첫 화면이 콜드 상태에서 <b>3.3초</b>, 두 번째부터 0.5초였다. 캐시가 비어 있어 첫 손님이
 * 지역 카탈로그(최대 5,000행)와 집중률 예측을 공사에서 받아오는 시간을 떠안은 것이다.
 * 심사위원은 늘 첫 손님이다 — 배포 직후, 혹은 6시간 수명이 끝난 직후에 들어온다.
 *
 * <p>같은 문제를 OffWay(team-offway/core, ADR 0001)는 "89개 고정 지역 캐시를 부팅 후·주기적으로
 * 요청 경로 밖에서 채운다"로 풀었다. 우리도 지역이 고정({@link SupportedRegion} 11곳)이라
 * 같은 처방이 그대로 맞는다.
 *
 * <h2>무엇을 채우나</h2>
 * 비싼 둘만 — <b>지역 카탈로그</b>({@link KtoPlaceClient})와 <b>집중률 예측</b>({@link KtoCongestionClient}).
 * 검색·진단·대안·홈·챗봇이 모두 이 둘 위에 선다. 연관 관광지·중심 관광지는 가볍고 쓰는 화면이
 * 좁아 요청 때 받아도 된다.
 *
 * <h2>언제</h2>
 * <ul>
 *   <li><b>부팅 완료 시</b> 카탈로그 11곳. 집중률은 {@link KtoStartupCheck#verify}가 같은 시점에
 *       지역마다 이미 부르므로 여기서 다시 부르지 않는다 — 두 번 부르면 한도만 두 배로 쓴다.</li>
 *   <li><b>5시간마다</b> 둘 다 <b>강제 갱신</b>({@code refresh*}). 수명(6시간)을 앞질러야 한다 —
 *       주기가 수명보다 길면 그 사이 값이 죽고 다음 사용자가 콜드 호출을 떠안아, 워머가 있어도
 *       첫 손님은 기다린다. {@code get}이 아니라 {@code refresh}인 이유는 {@code TtlCache#refresh}에.</li>
 * </ul>
 *
 * <h2>비용</h2>
 * 지역 11곳 × 2호출 × 하루 5번(부팅 포함) ≈ <b>110건/일</b>. 가정 한도 1,000건의 11%다.
 * 그 대신 사용자 요청이 만드는 카탈로그·집중률 호출은 거의 0이 된다 — 늘 캐시가 맞으니까.
 * 호출 <b>총량은 줄고 시각만 규칙적</b>이 되며, 규칙적인 호출 이력은 "실제로 공사 API를 쓴다"는
 * 심사 증거로도 읽기 좋다({@code /api/quotas}).
 *
 * <h2>⚠️ 목업이면 아무 일도 하지 않는다</h2>
 * real 공급자 빈({@link KtoPlaceProvider} · {@link KtoCongestionProvider})이 있을 때만 그 쪽을
 * 채운다. 설정 값을 다시 읽지 않고 <b>빈이 있는지</b>로 판단한다 — 스위치가 하나 더 생기지 않는다.
 *
 * <h2>⚠️ 한 지역의 실패가 나머지를 막지 않는다</h2>
 * 지역마다 따로 감싼다. 클라이언트 캐시가 실패 시 옛 값을 지키고 60초 백오프에 들기 때문에,
 * 워머는 그저 다음 지역으로 넘어가면 된다. 공사가 통째로 죽어 있으면 11번 빠르게 실패하고 끝난다
 * (연결 3초 상한).
 */
@Component
public class KtoCacheWarmer {

	private static final Logger log = LoggerFactory.getLogger(KtoCacheWarmer.class);

	/**
	 * 갱신 주기 — 5시간. 캐시 수명(6시간)보다 짧아야 한다(이유는 클래스 주석에).
	 * {@code Duration}으로 적지 못하는 이유: 애너테이션 값은 컴파일 상수여야 한다.
	 */
	static final long REFRESH_INTERVAL_MS = 5L * 60 * 60 * 1000;

	private final KtoPlaceClient placeClient;
	private final KtoCongestionClient congestionClient;
	private final ObjectProvider<KtoPlaceProvider> placeProvider;
	private final ObjectProvider<KtoCongestionProvider> congestionProvider;

	public KtoCacheWarmer(KtoPlaceClient placeClient, KtoCongestionClient congestionClient,
			ObjectProvider<KtoPlaceProvider> placeProvider,
			ObjectProvider<KtoCongestionProvider> congestionProvider) {
		this.placeClient = placeClient;
		this.congestionClient = congestionClient;
		this.placeProvider = placeProvider;
		this.congestionProvider = congestionProvider;
	}

	/**
	 * 부팅이 끝나면 카탈로그를 채운다.
	 *
	 * <p>{@code ApplicationReadyEvent}는 서버가 이미 요청을 받는 뒤에 온다. 이 루프가 도는 동안
	 * 들어오는 요청은 그냥 콜드 호출을 하면 되므로 기동을 막지 않는다.
	 */
	@EventListener(ApplicationReadyEvent.class)
	public void warmOnStartup() {
		if (placeProvider.getIfAvailable() == null) {
			return;
		}
		Instant started = Instant.now();
		int done = 0;
		for (SupportedRegion region : SupportedRegion.values()) {
			if (warm(region, "카탈로그", () -> placeClient.catalogOf(region.toRegion()))) {
				done++;
			}
		}
		log.info("[공사 API] 프리워밍 — 카탈로그 {}/{}곳, {}ms", done, SupportedRegion.values().length,
				Duration.between(started, Instant.now()).toMillis());
	}

	/**
	 * 5시간마다 둘 다 강제 갱신한다.
	 *
	 * <p>⚠️ {@code fixedDelay}는 프로세스가 살아 있는 동안의 간격이라 재배포하면 처음부터 다시 센다.
	 * 여기서는 그게 맞다 — 부팅 워밍이 이미 채웠으니 5시간 뒤부터 갱신하면 된다.
	 */
	@Scheduled(initialDelay = REFRESH_INTERVAL_MS, fixedDelay = REFRESH_INTERVAL_MS)
	public void refreshAll() {
		boolean places = placeProvider.getIfAvailable() != null;
		boolean forecasts = congestionProvider.getIfAvailable() != null;
		if (!places && !forecasts) {
			return;
		}
		Instant started = Instant.now();
		int done = 0;
		for (SupportedRegion region : SupportedRegion.values()) {
			if (places && warm(region, "카탈로그", () -> placeClient.refreshCatalog(region.toRegion()))) {
				done++;
			}
			if (forecasts && warm(region, "집중률", () -> congestionClient.refreshForecast(region.toRegion()))) {
				done++;
			}
		}
		log.info("[공사 API] 캐시 갱신 — {}건, {}ms", done, Duration.between(started, Instant.now()).toMillis());
	}

	/** 한 지역 한 종류. 실패는 경고로 남기고 다음으로 넘어간다. */
	private static boolean warm(SupportedRegion region, String what, Runnable call) {
		try {
			call.run();
			return true;
		}
		catch (RuntimeException e) {
			log.warn("[공사 API] 프리워밍 실패 — {} {}: {}", region.displayName(), what, e.getMessage());
			return false;
		}
	}
}
