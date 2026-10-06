package dev.daq.dualbot.strategy;

import java.math.BigDecimal;
import java.util.Objects;

/** A quantity of one coin. Money is always {@link BigDecimal}, never {@code double}. */
public record Amount(Coin coin, BigDecimal value) {

    public Amount {
        Objects.requireNonNull(coin, "coin");
        Objects.requireNonNull(value, "value");
    }
}
