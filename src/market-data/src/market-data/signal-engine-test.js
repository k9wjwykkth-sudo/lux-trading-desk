
import { LuxSignalEngine } from "./signal-engine.js";

const buyPrices = [
  100, 100.0071, 99.9002, 99.9127, 99.6276,
  99.8282, 100.0371, 100.1099, 99.7881, 99.7546,
  99.5668, 99.3168, 99.6291, 99.9763, 99.5620,
  99.8001, 99.8327, 99.6879, 99.4648, 99.5548,
  99.4703, 99.5690, 99.6484, 99.3048, 99.4691,
  100.6691
];

const sellPrices = [
  100, 100.0297, 100.2056, 100.3888, 100.1528,
  99.8115, 99.7613, 99.6306, 99.9289, 100.1313,
  100.2625, 100.3590, 100.5381, 100.3043, 100.3064,
  100.0862, 100.4610, 100.1580, 100.4631, 100.1728,
  100.3723, 100.2919, 100.2656, 100.5896, 100.2544,
  99.0544
];

function makeCandle(instrumentId, time, close, extra = {}) {
  return {
    instrumentId,
    timeframe: "1m",
    startTime: time,
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    status: "CLOSED",
    ...extra
  };
}

function prepareEngine(prices, instrumentId) {
  const engine = new LuxSignalEngine();
  let result;

  prices.forEach((price, index) => {
    result = engine.processCandle(
      makeCandle(instrumentId, index * 60000, price)
    );
  });

  return { engine, result };
}

export function runSignalEngineTests() {
  const results = [];

  function test(name, condition) {
    results.push({
      test: name,
      result: condition ? "PASS" : "FAIL"
    });
  }

  // Original safety tests

  {
    const engine = new LuxSignalEngine();
    const result = engine.processCandle(null);
    test("Reject invalid candle", result.reason === "invalid_candle");
  }

  {
    const engine = new LuxSignalEngine();
    const result = engine.processCandle({
      instrumentId: "TEST",
      timeframe: "1m",
      startTime: 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      status: "FORMING"
    });

    test("Ignore forming candles", result.reason === "candle_not_closed");
  }

  {
    const engine = new LuxSignalEngine();
    const result = engine.processCandle(
      makeCandle("TEST", 1000, 100)
    );

    test("Wait for sufficient history",
      result.reason === "insufficient_history");
  }

  {
    const engine = new LuxSignalEngine();
    const candle = makeCandle("TEST", 2000, 100);
    engine.processCandle(candle);
    const result = engine.processCandle(candle);

    test("Reject duplicate candle",
      result.reason === "duplicate_or_old_candle");
  }

  {
    const engine = new LuxSignalEngine();
    engine.processCandle(makeCandle("TEST", 2000, 100));
    const result = engine.processCandle(
      makeCandle("TEST", 1000, 100)
    );

    test("Reject older candle",
      result.reason === "duplicate_or_old_candle");
  }

  // Trading behaviour tests

  const buy = prepareEngine(buyPrices, "BUY-TEST");
  const sell = prepareEngine(sellPrices, "SELL-TEST");

  test("Generate BUY signal", buy.result.action === "BUY");
  test("Generate SELL signal", sell.result.action === "SELL");

  test(
    "Maintain 1:2 risk/reward",
    buy.result.action === "BUY" &&
    Math.abs(
      (buy.result.target - buy.result.entryPrice) /
      (buy.result.entryPrice - buy.result.stopLoss) - 2
    ) < 0.01
  );

  // HOLD test
  {
    const { engine, result } = prepareEngine(buyPrices, "HOLD-TEST");
    const next = engine.processCandle(
      makeCandle("HOLD-TEST", 26 * 60000, result.entryPrice)
    );

    test("Hold position before exit levels",
      next.action === "HOLD");
  }

  // Stop-loss test
  {
    const { engine, result } = prepareEngine(buyPrices, "STOP-TEST");
    const next = engine.processCandle(
      makeCandle("STOP-TEST", 26 * 60000, result.entryPrice, {
        low: result.stopLoss - 0.1
      })
    );

    test("Exit when stop-loss is reached",
      next.action === "EXIT" && next.reason === "STOP_LOSS");
  }

  // Target test
  {
    const { engine, result } = prepareEngine(buyPrices, "TARGET-TEST");
    const next = engine.processCandle(
      makeCandle("TARGET-TEST", 26 * 60000, result.entryPrice, {
        high: result.target + 0.1
      })
    );

    test("Exit when target is reached",
      next.action === "EXIT" && next.reason === "TARGET_REACHED");
  }

  const passed = results.filter(
    item => item.result === "PASS"
  ).length;

  const report = {
    passed,
    failed: results.length - passed,
    results,
    mode: "PAPER ONLY"
  };

  console.table(results);
  console.log(`LUX SIGNAL TESTS: ${passed}/${results.length} PASSED`);

  return report;
}


