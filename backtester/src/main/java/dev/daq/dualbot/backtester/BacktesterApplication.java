package dev.daq.dualbot.backtester;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Runs queued backtests and calibrates the APR model (SPEC §17). Holds no Binance key and talks
 * only to the gateway; it can never create real proposals or subscriptions.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class BacktesterApplication {

    public static void main(String[] args) {
        SpringApplication.run(BacktesterApplication.class, args);
    }
}
