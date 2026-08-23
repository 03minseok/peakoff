package com.peakoff.external.kto;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import com.peakoff.external.kto.support.KtoProperties;

/**
 * 공사 OpenAPI 설정을 스프링에 등록한다.
 *
 * <p>{@code @ConfigurationProperties}만 붙여 두면 아무도 그 클래스를 빈으로 만들지 않아,
 * 주입 시점에 "그런 빈이 없다"고 실패한다. 등록은 어딘가에서 한 번 해야 한다.
 *
 * <p>다른 설정들이 모인 {@code global/config}에 얹지 않고 여기 둔 이유:
 * 이 연동을 통째로 들어내거나 다른 저장소로 옮길 때 {@code external/kto} 폴더 하나만
 * 움직이면 되게 하려는 것이다. 바깥 세계와 닿는 코드는 한 덩어리로 모아 둔다.
 */
@Configuration
@EnableConfigurationProperties(KtoProperties.class)
public class KtoConfig {
}
