package dev.daq.dualbot.backtester;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Where the gateway lives and the token this component authenticates with (SPEC §9). */
@ConfigurationProperties("dualbot.gateway")
public record GatewayProperties(String url, String token) {
}
