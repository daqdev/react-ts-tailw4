package dev.daq.dualbot.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Boots the whole gateway against a real PostgreSQL 16. Skipped where Docker is unavailable. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "dualbot.hard.max-per-subscription-usdt=1000",
            "dualbot.hard.max-total-usdt=5000"
        })
class GatewayApplicationTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    TestRestTemplate http;

    @Test
    void healthReportsGatewayUp() {
        var body = http.getForObject("/api/health", String.class);

        assertThat(body).contains("\"gateway\":\"UP\"");
    }
}
