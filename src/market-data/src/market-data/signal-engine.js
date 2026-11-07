
/**
 * LUX Signal Engine
 * EMA 9 / EMA 21 + RSI 14 + ATR 14
 * Paper-trading signal generation only.
 */

export class LuxSignalEngine {
  constructor({
    fastPeriod = 9,
    slowPeriod = 21,
    rsiPeriod = 14,
    atrPeriod = 14,
    riskReward = 2,
    stopAtrMultiplier = 1.5,
    historyLimit = 250,
  } = {}) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.rsiPeriod = rsiPeriod;
    this.atrPeriod = atrPeriod;
    this.riskReward = riskReward;
    this.stopAtrMultiplier = stopAtrMultiplier;
    this.historyLimit = historyLimit;

    this.instruments = new Map();
  }

  processCandle(candle) {
    const invalid = this.validateCandle(candle);

    if (invalid) {
      return { action: "WAIT", reason: invalid };
    }

    if (
      candle.status != null &&
      candle.status !== "CLOSED"
    ) {
      return {
        action: "WAIT",
        reason: "candle_not_closed",
      };
    }

    const key = `${candle.instrumentId}:${candle.timeframe}`;

    if (!this.instruments.has(key)) {
      this.instruments.set(key, {
        candles: [],
        position: null,
        lastCandleTime: -1,
      });
    }

    const state = this.instruments.get(key);

    if (candle.startTime <= state.lastCandleTime) {
      return {
        action: "WAIT",
        reason: "duplicate_or_old_candle",
      };
    }

    state.lastCandleTime = candle.startTime;
    state.candles.push({ ...candle });

    if (state.candles.length > this.historyLimit) {
      state.candles.shift();
    }

    const candles = state.candles;

    if (candles.length < this.slowPeriod + 1) {
      return {
        action: "WAIT",
        reason: "insufficient_history",
        candlesRequired: this.slowPeriod + 1,
        candlesAvailable: candles.length,
      };
    }

    const closes = candles.map(c => c.close);

    const fastEMA = this.ema(closes, this.fastPeriod);
    const slowEMA = this.ema(closes, this.slowPeriod);

    const previousFastEMA = this.ema(
      closes.slice(0, -1),
      this.fastPeriod
    );

    const previousSlowEMA = this.ema(
      closes.slice(0, -1),
      this.slowPeriod
    );

    const rsi = this.calculateRSI(closes, this.rsiPeriod);
    const atr = this.calculateATR(candles, this.atrPeriod);

    if (
      !Number.isFinite(rsi) ||
      !Number.isFinite(atr) ||
      atr <= 0
    ) {
      return {
        action: "WAIT",
        reason: "indicators_not_ready",
      };
    }

    const crossedAbove =
      previousFastEMA <= previousSlowEMA &&
      fastEMA > slowEMA;

    const crossedBelow =
      previousFastEMA >= previousSlowEMA &&
      fastEMA < slowEMA;

    const price = candle.close;

    // Manage an existing paper position first.
    if (state.position) {
      const position = state.position;

      let exitReason = null;

      if (position.side === "BUY") {
        const stopHit = candle.low <= position.stopLoss;
        const targetHit = candle.high >= position.target;

        // Conservative assumption if both are hit
        // in the same candle: stop-loss first.
        if (stopHit) {
          exitReason = "STOP_LOSS";
        } else if (targetHit) {
          exitReason = "TARGET_REACHED";
        } else if (crossedBelow) {
          exitReason = "TREND_REVERSAL";
        }
      }

      if (position.side === "SELL") {
        const stopHit = candle.high >= position.stopLoss;
        const targetHit = candle.low <= position.target;

        if (stopHit) {
          exitReason = "STOP_LOSS";
        } else if (targetHit) {
          exitReason = "TARGET_REACHED";
        } else if (crossedAbove) {
          exitReason = "TREND_REVERSAL";
        }
      }

      if (exitReason) {
        const exit = {
          action: "EXIT",
          instrumentId: candle.instrumentId,
          timeframe: candle.timeframe,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice:
  exitReason === "STOP_LOSS"
    ? position.stopLoss
    : exitReason === "TARGET_REACHED"
      ? position.target
      : price,
          reason: exitReason,
          createdAt: candle.startTime,
          signalId: `${key}:EXIT:${candle.startTime}`,
        };

        state.position = null;
        return exit;
      }

      return {
        action: "HOLD",
        instrumentId: candle.instrumentId,
        side: position.side,
        entryPrice: position.entryPrice,
        stopLoss: position.stopLoss,
        target: position.target,
        currentPrice: price,
        unrealizedPoints:
          position.side === "BUY"
            ? price - position.entryPrice
            : position.entryPrice - price,
      };
    }

    // Entry conditions.
    let side = null;

    if (crossedAbove && rsi > 50 && rsi < 70) {
      side = "BUY";
    } else if (
      crossedBelow &&
      rsi < 50 &&
      rsi > 30
    ) {
      side = "SELL";
    }

    if (!side) {
      return {
        action: "WAIT",
        instrumentId: candle.instrumentId,
        timeframe: candle.timeframe,
        price,
        rsi,
        fastEMA,
        slowEMA,
        reason: "no_entry_setup",
      };
    }

    const riskDistance = atr * this.stopAtrMultiplier;

    const stopLoss =
      side === "BUY"
        ? price - riskDistance
        : price + riskDistance;

    const target =
      side === "BUY"
        ? price + riskDistance * this.riskReward
        : price - riskDistance * this.riskReward;

    const position = {
      side,
      entryPrice: price,
      stopLoss,
      target,
      entryTime: candle.startTime,
      instrumentId: candle.instrumentId,
      timeframe: candle.timeframe,
    };

    state.position = position;

    return {
      action: side,
      instrumentId: candle.instrumentId,
      timeframe: candle.timeframe,
      entryPrice: price,
      stopLoss,
      target,
      riskDistance,
      riskReward: this.riskReward,
      rsi,
      fastEMA,
      slowEMA,
      createdAt: candle.startTime,
      signalId: `${key}:${side}:${candle.startTime}`,
      mode: "PAPER",
    };
  }

  ema(values, period) {
    if (values.length < period) return NaN;

    const multiplier = 2 / (period + 1);

    let result = values[0];

    for (let i = 1; i < values.length; i++) {
      result =
        values[i] * multiplier +
        result * (1 - multiplier);
    }

    return result;
  }

  calculateRSI(values, period) {
    if (values.length <= period) return NaN;

    let gains = 0;
    let losses = 0;

    for (let i = values.length - period; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const averageGain = gains / period;
    const averageLoss = losses / period;

    if (averageLoss === 0) {
      return averageGain === 0 ? 50 : 100;
    }

    const rs = averageGain / averageLoss;

    return 100 - 100 / (1 + rs);
  }

  calculateATR(candles, period) {
    if (candles.length <= period) return NaN;

    const ranges = [];

    for (
      let i = candles.length - period;
      i < candles.length;
      i++
    ) {
      const current = candles[i];
      const previousClose = candles[i - 1].close;

      ranges.push(
        Math.max(
          current.high - current.low,
          Math.abs(current.high - previousClose),
          Math.abs(current.low - previousClose)
        )
      );
    }

    return ranges.reduce((a, b) => a + b, 0) / period;
  }

  getPosition(instrumentId, timeframe) {
    const key = `${instrumentId}:${timeframe}`;
    const position = this.instruments.get(key)?.position;

    return position ? { ...position } : null;
  }

  validateCandle(candle) {
    if (!candle || typeof candle !== "object") {
      return "invalid_candle";
    }

    if (
      typeof candle.instrumentId !== "string" ||
      !candle.instrumentId.trim()
    ) {
      return "invalid_instrument";
    }

    if (
      typeof candle.timeframe !== "string" ||
      !candle.timeframe.trim()
    ) {
      return "invalid_timeframe";
    }

    if (
      !Number.isFinite(candle.startTime) ||
      candle.startTime < 0
    ) {
      return "invalid_timestamp";
    }

    if (
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close) ||
      candle.low <= 0 ||
      candle.high < candle.low ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close)
    ) {
      return "invalid_ohlc";
    }

    return null;
  }
}

export const luxSignalEngine = new LuxSignalEngine();
