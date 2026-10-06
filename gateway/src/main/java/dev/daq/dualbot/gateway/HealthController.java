package dev.daq.dualbot.gateway;

import java.time.Clock;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/health} (SPEC §9). Worker heartbeat and last Binance call come in M1. */
@RestController
@RequestMapping("/api/health")
class HealthController {

    private final Clock clock;

    HealthController(Clock clock) {
        this.clock = clock;
    }

    @GetMapping
    Health health() {
        return new Health("UP", Instant.now(clock));
    }

    record Health(String gateway, Instant serverTime) {
    }
}
