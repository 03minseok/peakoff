package com.peakoff.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 주기 작업을 켠다. 지금 쓰는 곳은 하나 — 공사 캐시 프리워밍({@code KtoCacheWarmer}).
 *
 * <p>여기 따로 두는 이유: {@code @EnableScheduling}을 워머 클래스에 얹으면 "스케줄링이 켜져
 * 있다"는 사실이 그 파일 안에 숨는다. 두 번째 주기 작업을 붙이는 사람이 그것을 모르고
 * 한 번 더 켜거나, 어디서 켰는지 찾아다닌다. 설정은 설정 자리에 둔다.
 *
 * <p>⚠️ 주기 작업은 <b>공사 호출을 만든다.</b> 새로 붙일 때는 "하루에 몇 건 나가나"를 숫자로
 * 적을 것 — 한도가 하루 단위고, 2026-08-26에 그 한도를 태워 본 적이 있다.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
