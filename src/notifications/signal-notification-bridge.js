
/**
 * LUX Signal Notification Bridge
 * Connects trading signals to dashboard notifications.
 */

import { luxNotifications } from "./dashboard-notifications.js";

import {
  luxSignalEngine
} from "../market-data/src/market-data/signal-engine.js?v=4";

export class SignalNotificationBridge {
  constructor({
    signalEngine = luxSignalEngine,
    notifications = luxNotifications,
  } = {}) {
    this.signalEngine = signalEngine;
    this.notifications = notifications;
  }

  processCandle(candle) {
    const signal = this.signalEngine.processCandle(candle);

    this.notifySignal(signal);

    return signal;
  }

  processClosedCandles(candles = []) {
    const results = [];

    for (const candle of candles) {
      results.push(this.processCandle(candle));
    }

    return results;
  }

  processIngestResult(result) {
    if (!result || !Array.isArray(result.closed)) {
      return [];
    }

    return this.processClosedCandles(result.closed);
  }

  notifySignal(signal) {
    if (!signal || !["BUY", "SELL", "EXIT"].includes(signal.action)) {
      return null;
    }

    let title;
    let message;
    let level = "info";

    const format = value =>
      Number.isFinite(value) ? value.toFixed(2) : "N/A";

    if (signal.action === "BUY") {
      title = "LUX BUY ENTRY SIGNAL";

      message =
        `Instrument: ${signal.instrumentId}\n` +
        `Entry: ${format(signal.entryPrice)}\n` +
        `Stop Loss: ${format(signal.stopLoss)}\n` +
        `Target: ${format(signal.target)}\n` +
        `RSI: ${format(signal.rsi)}\n` +
        `Mode: PAPER`;

      level = "success";
    }

    if (signal.action === "SELL") {
      title = "LUX SELL ENTRY SIGNAL";

      message =
        `Instrument: ${signal.instrumentId}\n` +
        `Entry: ${format(signal.entryPrice)}\n` +
        `Stop Loss: ${format(signal.stopLoss)}\n` +
        `Target: ${format(signal.target)}\n` +
        `RSI: ${format(signal.rsi)}\n` +
        `Mode: PAPER`;

      level = "warning";
    }

    if (signal.action === "EXIT") {
      title = "LUX EXIT SIGNAL";

      message =
        `Instrument: ${signal.instrumentId}\n` +
        `Side: ${signal.side}\n` +
        `Entry: ${format(signal.entryPrice)}\n` +
        `Exit: ${format(signal.exitPrice)}\n` +
        `Reason: ${signal.reason}`;

      level =
        signal.reason === "STOP_LOSS"
          ? "critical"
          : "warning";
    }

    return this.notifications.add({
      title,
      message,
      level,
    });
  }
}

export const luxSignalNotificationBridge =
  new SignalNotificationBridge();
