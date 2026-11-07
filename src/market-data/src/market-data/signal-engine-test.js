
import { LuxSignalEngine } from "./signal-engine.js";

export function runSignalEngineTests() {
  const results = [];

  function test(name, condition) {
    results.push({
      test: name,
      result: condition ? "PASS" : "FAIL"
    });
  }

  // Test 1: Invalid candle
  {
    const engine = new LuxSignalEngine();
    const result = engine.processCandle(null);

    test(
      "Reject invalid candle",
      result.action === "WAIT" &&
      result.reason === "invalid_candle"
    );
  }

  // Test 2: Forming candle
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

    test(
      "Ignore forming candles",
      result.action === "WAIT" &&
      result.reason === "candle_not_closed"
    );
  }

  // Test 3: Insufficient history
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
      status: "CLOSED"
    });

    test(
      "Wait for sufficient history",
      result.action === "WAIT" &&
      result.reason === "insufficient_history"
    );
  }

  // Test 4: Duplicate candle
  {
    const engine = new LuxSignalEngine();

    const candle = {
      instrumentId: "TEST",
      timeframe: "1m",
      startTime: 2000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      status: "CLOSED"
    };

    engine.processCandle(candle);
    const result = engine.processCandle(candle);

    test(
      "Reject duplicate candle",
      result.reason === "duplicate_or_old_candle"
    );
  }

  // Test 5: Older candle
  {
    const engine = new LuxSignalEngine();

    engine.processCandle({
      instrumentId: "TEST",
      timeframe: "1m",
      startTime: 2000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      status: "CLOSED"
    });

    const result = engine.processCandle({
      instrumentId: "TEST",
      timeframe: "1m",
      startTime: 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      status: "CLOSED"
    });

    test(
      "Reject older candle",
      result.reason === "duplicate_or_old_candle"
    );
  }

  const passed = results.filter(
    item => item.result === "PASS"
  ).length;

  console.table(results);

  console.log(
    `LUX SIGNAL TESTS: ${passed}/${results.length} PASSED`
  );

  return {
    passed,
    failed: results.length - passed,
    results,
    mode: "PAPER ONLY"
  };
}

runSignalEngineTests();
