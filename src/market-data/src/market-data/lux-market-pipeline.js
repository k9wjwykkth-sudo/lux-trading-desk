
/**
 * LUX Market Pipeline
 * Market ticks → OHLCV candles → Trading signals
 * → Dashboard notifications.
 *
 * Initial mode: SIMULATED / PAPER TRADING
 */

import { CandleEngine } from "./candle-engine.js";

import {
  luxSignalNotificationBridge
} from "../../../notifications/signal-notification-bridge.js";

export class LuxMarketPipeline {
  constructor({
    candleEngine = new CandleEngine(),
    notificationBridge = luxSignalNotificationBridge,
  } = {}) {
    this.candleEngine = candleEngine;
    this.notificationBridge = notificationBridge;

    this.processedTicks = 0;
    this.generatedSignals = 0;
    this.rejectedTicks = 0;
  }

  ingestTick(tick) {
    const result = this.candleEngine.ingest(tick);

    if (!result.accepted) {
      this.rejectedTicks++;

      return {
        accepted: false,
        reason: result.reason,
        signals: [],
      };
    }

    this.processedTicks++;

    // Process only completed candles.
    const signals =
      this.notificationBridge.processIngestResult(result);

    const actionableSignals = signals.filter(signal =>
      ["BUY", "SELL", "EXIT"].includes(signal.action)
    );

    this.generatedSignals += actionableSignals.length;

    return {
      accepted: true,
      instrumentId: result.instrumentId,
      timestamp: result.timestamp,
      closedCandles: result.closed,
      formingCandles: result.updated,
      signals,
      actionableSignals,
    };
  }

  getCandles(instrumentId, timeframe, options = {}) {
    return this.candleEngine.getCandles(
      instrumentId,
      timeframe,
      options
    );
  }

  getMarketSnapshot(
    instrumentId,
    timeframe,
    now = Date.now(),
    maxAgeMs = 5000
  ) {
    return this.candleEngine.getSnapshot(
      instrumentId,
      timeframe,
      now,
      maxAgeMs
    );
  }

  getStats() {
    return {
      mode: "PAPER",
      processedTicks: this.processedTicks,
      rejectedTicks: this.rejectedTicks,
      generatedSignals: this.generatedSignals,
    };
  }
}

export const luxMarketPipeline = new LuxMarketPipeline();
