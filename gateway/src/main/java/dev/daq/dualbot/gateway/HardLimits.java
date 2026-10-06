package dev.daq.dualbot.gateway;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The {@code hard_*} guardrail caps (SPEC §6). They come from environment variables, never from
 * the DB, so changing them requires a redeploy. The gateway refuses to start without them.
 */
@Validated
@ConfigurationProperties("dualbot.hard")
public record HardLimits(
        @NotNull @Positive Integer maxSubscriptionsPerDay,
        @NotNull @Positive BigDecimal maxPerSubscriptionUsdt,
        @NotNull @Positive BigDecimal maxTotalUsdt) {
}
