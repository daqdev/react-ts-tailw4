package dev.daq.dualbot.worker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Live strategy scheduler (SPEC §5.7). Stateless: reads and writes only through the gateway API,
 * never talks to Binance or the DB, never executes orders.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class WorkerApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkerApplication.class, args);
    }
}
