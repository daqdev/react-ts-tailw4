package dev.daq.dualbot.strategy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class PayoutTest {

    private static final BigDecimal STRIKE = new BigDecimal("95000");

    /** SPEC §2 worked example: 1,000 USDT, strike 95,000. Required by SPEC §10 and §17.11. */
    @Nested
    class FullCycleExample {

        private final BigDecimal buyLowApr = new BigDecimal("0.35");
        private final BigDecimal sellHighApr = new BigDecimal("0.20");

        @Test
        void buyLowNotExercisedReturnsUsdtWithPremium() {
            Amount out = Payout.settle(Leg.BUY_LOW, new BigDecimal("1000"), STRIKE, buyLowApr, 15, false);

            assertThat(out.coin()).isEqualTo(Coin.USDT);
            assertThat(usdt(out)).isEqualByComparingTo("1014.38");
        }

        @Test
        void buyLowExercisedReturnsBtcAtStrike() {
            Amount out = Payout.settle(Leg.BUY_LOW, new BigDecimal("1000"), STRIKE, buyLowApr, 15, true);

            assertThat(out.coin()).isEqualTo(Coin.BTC);
            assertThat(btc(out)).isEqualByComparingTo("0.01067772");
        }

        @Test
        void sellHighNotExercisedKeepsBtcWithPremium() {
            Amount btc = Payout.settle(Leg.BUY_LOW, new BigDecimal("1000"), STRIKE, buyLowApr, 15, true);

            Amount out = Payout.settle(Leg.SELL_HIGH, btc.value(), STRIKE, sellHighApr, 15, false);

            assertThat(out.coin()).isEqualTo(Coin.BTC);
            assertThat(btc(out)).isEqualByComparingTo("0.01076548");
        }

        @Test
        void sellHighExercisedClosesTheCycleInUsdt() {
            Amount btc = Payout.settle(Leg.BUY_LOW, new BigDecimal("1000"), STRIKE, buyLowApr, 15, true);

            Amount out = Payout.settle(Leg.SELL_HIGH, btc.value(), STRIKE, sellHighApr, 15, true);

            assertThat(out.coin()).isEqualTo(Coin.USDT);
            assertThat(usdt(out)).isEqualByComparingTo("1022.72");
        }
    }

    @Test
    void periodRateIsAprProRataOver365Days() {
        assertThat(Payout.periodRate(new BigDecimal("0.35"), 15).setScale(6, RoundingMode.HALF_UP))
                .isEqualByComparingTo("0.014384");
        assertThat(Payout.periodRate(new BigDecimal("0.20"), 15).setScale(6, RoundingMode.HALF_UP))
                .isEqualByComparingTo("0.008219");
    }

    @Test
    void rejectsInvalidInputs() {
        BigDecimal apr = new BigDecimal("0.35");
        assertThatThrownBy(() -> Payout.settle(Leg.BUY_LOW, BigDecimal.ZERO, STRIKE, apr, 15, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Payout.settle(Leg.BUY_LOW, BigDecimal.TEN, BigDecimal.ZERO, apr, 15, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Payout.periodRate(apr, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Payout.periodRate(new BigDecimal("-0.01"), 15))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static BigDecimal usdt(Amount amount) {
        return amount.value().setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal btc(Amount amount) {
        return amount.value().setScale(8, RoundingMode.HALF_UP);
    }
}
