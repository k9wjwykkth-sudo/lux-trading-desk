
/**
 * LUX Market Data Engine
 * Converts normalized market ticks into OHLCV candles.
 */

export const DEFAULT_TIMEFRAMES = Object.freeze({
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
});

export class CandleEngine {
  constructor({
    timeframes = DEFAULT_TIMEFRAMES,
    anchors = {},
    historyLimit = 500,
    maxEventIds = 5000,
  } = {}) {
    if (!timeframes || !Object.keys(timeframes).length) {
      throw new TypeError("At least one timeframe is required.");
    }

    for (const [name, duration] of Object.entries(timeframes)) {
      if (!Number.isSafeInteger(duration) || duration <= 0) {
        throw new TypeError(`Invalid timeframe: ${name}`);
      }
    }

    if (!Number.isInteger(historyLimit) || historyLimit < 1) {
      throw new TypeError("Invalid history limit.");
    }

    this.timeframes = { ...timeframes };
    this.anchors = { ...anchors };
    this.historyLimit = historyLimit;
    this.maxEventIds = maxEventIds;
    this.instruments = new Map();
  }

  ingest(tick) {
    const invalid = this.validateTick(tick);

    if (invalid) {
      return {
        accepted: false,
        reason: invalid,
        closed: [],
        updated: [],
      };
    }

    const instrumentId = tick.instrumentId.trim();
    const state = this.getInstrumentState(instrumentId);

    if (
      tick.eventId != null &&
      state.eventIds.has(String(tick.eventId))
    ) {
      return {
        accepted: false,
        reason: "duplicate_event",
        closed: [],
        updated: [],
      };
    }

    if (tick.timestamp < state.lastTimestamp) {
      return {
        accepted: false,
        reason: "out_of_order_tick",
        closed: [],
        updated: [],
      };
    }

    if (tick.eventId != null) {
      const id = String(tick.eventId);
      state.eventIds.add(id);
      state.eventIdQueue.push(id);

      if (state.eventIdQueue.length > this.maxEventIds) {
        state.eventIds.delete(state.eventIdQueue.shift());
      }
    }

    state.lastTimestamp = Math.max(
      state.lastTimestamp,
      tick.timestamp
    );

    const closed = [];
    const updated = [];

    for (const [timeframe, duration] of Object.entries(
      this.timeframes
    )) {
      let tfState = state.timeframes.get(timeframe);

      if (!tfState) {
        tfState = { history: [], forming: null };
        state.timeframes.set(timeframe, tfState);
      }

      const anchor = this.anchors[timeframe] ?? 0;

      const bucketStart =
        Math.floor(
          (tick.timestamp - anchor) / duration
        ) * duration + anchor;

      if (!tfState.forming) {
        tfState.forming = this.newCandle(
          instrumentId,
          timeframe,
          bucketStart,
          tick
        );
      } else if (bucketStart > tfState.forming.startTime) {
        const completed = {
          ...tfState.forming,
          status: "CLOSED",
          closeTime:
            tfState.forming.startTime + duration,
        };

        tfState.history.push(completed);

        if (tfState.history.length > this.historyLimit) {
          tfState.history.shift();
        }

        closed.push(completed);

        tfState.forming = this.newCandle(
          instrumentId,
          timeframe,
          bucketStart,
          tick
        );
      } else if (bucketStart === tfState.forming.startTime) {
        this.applyTick(tfState.forming, tick);
      } else {
        return {
          accepted: false,
          reason: "timeframe_out_of_order",
          closed: [],
          updated: [],
        };
      }

      updated.push({
        ...tfState.forming,
        status: "FORMING",
      });
    }

    return {
      accepted: true,
      instrumentId,
      timestamp: tick.timestamp,
      closed,
      updated,
    };
  }

  getCandles(instrumentId, timeframe, {
    includeForming = true,
  } = {}) {
    const tfState = this.instruments
      .get(instrumentId)?.timeframes.get(timeframe);

    if (!tfState) return [];

    const result = tfState.history.map(c => ({ ...c }));

    if (includeForming && tfState.forming) {
      result.push({
        ...tfState.forming,
        status: "FORMING",
      });
    }

    return result;
  }

  getSnapshot(
    instrumentId,
    timeframe,
    now = Date.now(),
    maxAgeMs = 5000
  ) {
    const instrument = this.instruments.get(instrumentId);
    const tfState = instrument?.timeframes.get(timeframe);

    if (!instrument || !tfState?.forming) {
      return {
        instrumentId,
        timeframe,
        status: "NO_DATA",
        lastTickTime: null,
        candle: null,
      };
    }

    const ageMs = Math.max(
      0,
      now - instrument.lastTimestamp
    );

    return {
      instrumentId,
      timeframe,
      status: ageMs > maxAgeMs ? "STALE" : "LIVE",
      ageMs,
      lastTickTime: instrument.lastTimestamp,
      candle: {
        ...tfState.forming,
        status: "FORMING",
      },
    };
  }

  validateTick(tick) {
    if (!tick || typeof tick !== "object") {
      return "invalid_tick";
    }

    if (
      typeof tick.instrumentId !== "string" ||
      !tick.instrumentId.trim()
    ) {
      return "invalid_instrument";
    }

    if (
      !Number.isFinite(tick.timestamp) ||
      tick.timestamp < 0
    ) {
      return "invalid_timestamp";
    }

    if (!Number.isFinite(tick.price) || tick.price <= 0) {
      return "invalid_price";
    }

    if (
      tick.volume != null &&
      (!Number.isFinite(tick.volume) || tick.volume < 0)
    ) {
      return "invalid_volume";
    }

    return null;
  }

  getInstrumentState(instrumentId) {
    if (!this.instruments.has(instrumentId)) {
      this.instruments.set(instrumentId, {
        lastTimestamp: -1,
        timeframes: new Map(),
        eventIds: new Set(),
        eventIdQueue: [],
      });
    }

    return this.instruments.get(instrumentId);
  }

  newCandle(instrumentId, timeframe, startTime, tick) {
    return {
      instrumentId,
      timeframe,
      startTime,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: tick.volume ?? 0,
      tradeCount: 1,
      lastUpdateTime: tick.timestamp,
    };
  }

  applyTick(candle, tick) {
    candle.high = Math.max(candle.high, tick.price);
    candle.low = Math.min(candle.low, tick.price);
    candle.close = tick.price;
    candle.volume += tick.volume ?? 0;
    candle.tradeCount += 1;
    candle.lastUpdateTime = tick.timestamp;
  }
}
