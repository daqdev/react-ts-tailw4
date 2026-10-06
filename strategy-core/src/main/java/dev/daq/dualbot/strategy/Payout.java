package dev.daq.dualbot.strategy;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Objects;

/**
 * Settlement arithmetic for one position (SPEC §2 payout table).
 *
 * <p>Results keep full precision; rounding to an exchange's {@code purchaseDecimal} or to display
 * precision is the caller's job.
 */
public final class Payout {

    /** Precision used for every intermediate step. */
    public static final MathContext MC = MathContext.DECIMAL128;

    private static final BigDecimal DAYS_PER_YEAR = BigDecimal.valueOf(365);

    private Payout() {
    }

    /** {@code r = apr × duration_days / 365}, with {@code apr} as a decimal ({@code 0.35} = 35%). */
    public static BigDecimal periodRate(BigDecimal apr, int durationDays) {
        Objects.requireNonNull(apr, "apr");
        if (apr.signum() < 0) {
            throw new IllegalArgumentException("apr must not be negative: " + apr);
        }
        if (durationDays <= 0) {
            throw new IllegalArgumentException("durationDays must be positive: " + durationDays);
        }
        return apr.multiply(BigDecimal.valueOf(durationDays), MC).divide(DAYS_PER_YEAR, MC);
    }

    /**
     * What a settled position pays.
     *
     * @param leg          product leg
     * @param invested     amount subscribed, in {@link Leg#investCoin()}
     * @param strike       strike price in USDT per BTC
     * @param apr          APR fixed at subscription, as a decimal
     * @param durationDays product duration in days
     * @param exercised    whether the settlement price triggered conversion
     * @return the amount credited, in {@link Leg#investCoin()} if not exercised, otherwise in
     *     {@link Leg#exercisedCoin()}
     */
    public static Amount settle(
            Leg leg, BigDecimal invested, BigDecimal strike, BigDecimal apr, int durationDays, boolean exercised) {
        Objects.requireNonNull(leg, "leg");
        Objects.requireNonNull(invested, "invested");
        Objects.requireNonNull(strike, "strike");
        if (invested.signum() <= 0) {
            throw new IllegalArgumentException("invested must be positive: " + invested);
        }
        if (strike.signum() <= 0) {
            throw new IllegalArgumentException("strike must be positive: " + strike);
        }

        BigDecimal grown = invested.multiply(BigDecimal.ONE.add(periodRate(apr, durationDays), MC), MC);
        if (!exercised) {
            return new Amount(leg.investCoin(), grown);
        }
        BigDecimal converted = switch (leg) {
            case BUY_LOW -> grown.divide(strike, MC);
            case SELL_HIGH -> grown.multiply(strike, MC);
        };
        return new Amount(leg.exercisedCoin(), converted);
    }
}
