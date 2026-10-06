package dev.daq.dualbot.strategy;

/**
 * The two Dual Investment products the cycle uses, with their API terms (SPEC §2).
 */
public enum Leg {
    /** {@code optionType=PUT}: invest USDT, receive BTC when exercised. */
    BUY_LOW("PUT", Coin.USDT, Coin.BTC),
    /** {@code optionType=CALL}: invest BTC, receive USDT when exercised. */
    SELL_HIGH("CALL", Coin.BTC, Coin.USDT);

    private final String optionType;
    private final Coin investCoin;
    private final Coin exercisedCoin;

    Leg(String optionType, Coin investCoin, Coin exercisedCoin) {
        this.optionType = optionType;
        this.investCoin = investCoin;
        this.exercisedCoin = exercisedCoin;
    }

    public String optionType() {
        return optionType;
    }

    public Coin investCoin() {
        return investCoin;
    }

    public Coin exercisedCoin() {
        return exercisedCoin;
    }
}
