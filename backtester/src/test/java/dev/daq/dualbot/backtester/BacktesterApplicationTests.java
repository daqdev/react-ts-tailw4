package dev.daq.dualbot.backtester;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "dualbot.gateway.url=http://gateway.test:8080")
class BacktesterApplicationTests {

    @Autowired
    GatewayProperties gateway;

    @Test
    void bindsGatewayLocation() {
        assertThat(gateway.url()).isEqualTo("http://gateway.test:8080");
    }
}
