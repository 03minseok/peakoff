package com.peakoff.external.kto;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.peakoff.place.domain.SupportedRegion;

/**
 * 서버가 뜰 때 공사 OpenAPI에 실제로 닿는지 한 번 확인한다.
 *
 * <h3>왜 기동 시점인가</h3>
 * 이것이 없으면 인증키가 틀렸다는 사실이 <b>첫 사용자 요청이 500으로 터질 때</b> 드러난다.
 * 배포 환경에서는 그게 심사위원의 첫 클릭일 수 있다. 로그 맨 위에서 알 수 있으면
 * 배포 직후 1분 안에 잡는다.
 *
 * <h3>왜 기동을 막지 않는가</h3>
 * 공사 API가 잠깐 죽었다고 우리 서버까지 못 뜨면, 로그인·코스 편집처럼 <b>공사와 무관한
 * 기능까지</b> 함께 멈춘다. 크게 남기되 서비스는 띄운다.
 *
 * <h3>덤</h3>
 * 이 호출로 지역 예측이 캐시에 올라간다. 첫 사용자가 기다릴 일이 하나 줄고,
 * 규칙이 요구하는 호출 이력도 기동할 때마다 쌓인다.
 */
@Component
public class KtoStartupCheck {

	private static final Logger log = LoggerFactory.getLogger(KtoStartupCheck.class);

	/** 이 값일 때만 공사 API를 실제로 부른다. {@code application.yaml}의 설명 참고. */
	private static final String REAL = "real";

	private final KtoProperties properties;
	private final KtoCongestionClient client;

	public KtoStartupCheck(KtoProperties properties, KtoCongestionClient client) {
		this.properties = properties;
		this.client = client;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void verify() {
		boolean usingRealData = REAL.equals(properties.congestion());

		if (!usingRealData) {
			log.info("[공사 API] 한적도는 목업으로 동작합니다. 실제 호출을 쓰려면 peakoff.kto.congestion=real");
			return;
		}

		if (!properties.isConfigured()) {
			log.error("""
					[공사 API] ❌ 인증키가 비어 있는데 실데이터 모드입니다.
					  환경변수 KTO_SERVICE_KEY 또는 application-local.yml의 peakoff.kto.service-key를 확인하세요.
					  한적도가 필요한 모든 요청이 실패합니다.""");
			return;
		}

		// 호출보다 먼저 본다. 실패한 뒤에 나오는 힌트는 이미 늦다.
		warnIfSecretLooksLikeDecodingKey();

		try {
			RegionForecast forecast = client.forecastOf(SupportedRegion.GYEONGJU.toRegion());
			if (forecast.isEmpty()) {
				log.warn("[공사 API] ⚠️ 호출은 됐지만 예측 자료가 비어 있습니다. 지역 코드를 확인하세요.");
				return;
			}
			log.info("[공사 API] ✅ 집중률 연결 확인. 관광지 {}곳, 예측 가능 기간 {} ~ {}",
					forecast.placeNames().size(),
					forecast.firstDate(),
					forecast.lastForecastDate().map(LocalDate::toString).orElse("알 수 없음"));
		}
		catch (KtoApiException e) {
			/*
			 * 여기서 가장 흔한 원인은 "그 API에 활용신청이 안 된 것"이다.
			 * 인증키는 계정당 하나인데 승인은 API마다 따로라, 하나가 되면 나머지도 될 거라고
			 * 착각하기 쉽다. 메시지에 그 힌트를 함께 남긴다.
			 */
			log.error("[공사 API] ❌ 집중률 호출 실패: {}", e.getMessage());
			log.error("[공사 API]    인증키가 이 API에 활용신청·승인되었는지 확인하세요 "
					+ "(승인 표시 후에도 게이트웨이 반영에 1~2시간 걸립니다).");
		}
		catch (RuntimeException e) {
			// 예상하지 못한 사고까지 기동을 막지는 않는다. 무엇이 터졌는지만 남긴다.
			log.error("[공사 API] ❌ 확인 중 예상하지 못한 오류", e);
		}
	}

	/**
	 * Decoding 키를 넣었을 가능성을 알린다.
	 *
	 * <p>Encoding 키는 URL 인코딩된 값이라 {@code %}가 들어 있다. Decoding 키에는 {@code +}나
	 * {@code /}가 그대로 있어서, 주소에 실으면 {@code +}가 공백으로 읽혀 공사가 다른 키로 본다.
	 * <b>인증 오류 메시지만으로는 이 둘을 구분할 수 없어</b> 한참 헤매게 되는 자리다.
	 */
	private void warnIfSecretLooksLikeDecodingKey() {
		String key = properties.serviceKey();
		if (key != null && !key.contains("%") && (key.contains("+") || key.contains("/"))) {
			log.warn("[공사 API] ⚠️ 인증키에 % 가 없고 + 또는 / 가 있습니다. "
					+ "Decoding 키를 넣으신 것 같습니다 — 마이페이지의 \"일반 인증키(Encoding)\"를 쓰세요.");
		}
	}
}
