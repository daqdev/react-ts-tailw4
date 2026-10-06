package dev.daq.dualbot.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class HardLimitsTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
            .withUserConfiguration(Config.class);

    @Test
    void bindsAllLimits() {
        runner.withPropertyValues(
                        "dualbot.hard.max-subscriptions-per-day=6",
                        "dualbot.hard.max-per-subscription-usdt=1000",
                        "dualbot.hard.max-total-usdt=5000")
                .run(context -> {
                    HardLimits limits = context.getBean(HardLimits.class);
                    assertThat(limits.maxSubscriptionsPerDay()).isEqualTo(6);
                    assertThat(limits.maxPerSubscriptionUsdt()).isEqualByComparingTo("1000");
                    assertThat(limits.maxTotalUsdt()).isEqualByComparingTo("5000");
                });
    }

    @Test
    void refusesToStartWithoutMoneyCaps() {
        runner.withPropertyValues("dualbot.hard.max-subscriptions-per-day=6")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void refusesNonPositiveCaps() {
        runner.withPropertyValues(
                        "dualbot.hard.max-subscriptions-per-day=6",
                        "dualbot.hard.max-per-subscription-usdt=0",
                        "dualbot.hard.max-total-usdt=5000")
                .run(context -> assertThat(context).hasFailed());
    }

    @EnableConfigurationProperties(HardLimits.class)
    static class Config {
    }
}
