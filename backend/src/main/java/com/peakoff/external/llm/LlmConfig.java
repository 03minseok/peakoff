package com.peakoff.external.llm;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.peakoff.chat.domain.CallLimiter;
import com.peakoff.chat.domain.DailyBudget;

/**
 * 챗봇에 필요한 것들을 빈으로 꺼낸다.
 *
 * <h3>왜 {@code @Component}가 아니라 여기서 만드는가</h3>
 * {@link CallLimiter}와 {@link DailyBudget}은 <b>설정값을 받아야</b> 만들어진다.
 * 도메인 클래스에 스프링 애너테이션을 붙이면 그 값들을 애너테이션으로 끌어와야 하고,
 * 그러면 <b>테스트에서 순수하게 만들 수 없다</b> — 두 클래스 다 시계를 넣어 시간을 감으며
 * 검증하는 자리라 그게 중요하다.
 *
 * <h3>키가 없어도 서버는 뜬다</h3>
 * 빈은 언제나 만들어지고, 키가 없으면 {@link GeminiClient}가 스스로 "못 부른다"고 답한다.
 * 조건부 빈으로 두면 <b>키가 없는 개발 기기에서 챗봇을 쓰는 코드가 통째로 안 뜬다</b> —
 * 그러면 화면이 어떻게 폴백하는지를 정작 개발 중에 볼 수 없다.
 */
@Configuration
@EnableConfigurationProperties(LlmProperties.class)
public class LlmConfig {

	private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);

	@Bean
	public GeminiClient geminiClient(LlmProperties properties) {
		if (properties.isConfigured()) {
			log.info("여행지 추천 챗봇을 켭니다. model={}, 하루 상한={}회, 개인 제한={}회/{}분",
					properties.model(), properties.dailyLimit(),
					properties.perKeyLimit(), properties.window().toMinutes());
		}
		else {
			/*
			 * 경고가 아니라 안내다. 키가 없는 것은 고장이 아니라 선택일 수 있다 —
			 * 공사 연동만 확인하는 중이거나, 크레딧을 아끼는 중이거나.
			 */
			log.info("여행지 추천 챗봇이 꺼져 있습니다. 켜려면 환경변수 GEMINI_API_KEY를 설정하세요.");
		}
		return new GeminiClient(properties);
	}

	/** 한 사람이 짧은 시간에 몰아치는 것을 막는다. */
	@Bean
	public CallLimiter chatCallLimiter(LlmProperties properties, Clock clock) {
		return new CallLimiter(clock, properties.perKeyLimit(), properties.window());
	}

	/** 전체가 하루치를 태우는 것을 막는다. */
	@Bean
	public DailyBudget chatDailyBudget(LlmProperties properties, Clock clock) {
		return new DailyBudget(clock, properties.dailyLimit());
	}
}
