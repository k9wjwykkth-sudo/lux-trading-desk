
const TICKER_ENDPOINT = "https://lux-market-relay.lakshayanagarethinam2002.workers.dev/ticker";
const WATCHED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const POLL_INTERVAL_MS = 2000;

export function createCoinDcxRestFeed({
  onTick = () => {},
  onStatus = () => {},
} = {}) {
  let timer = null;
  let stopped = true;
  let polling = false;
  let connected = false;
  let lastSuccess = 0;
  let lastError = "";

  async function poll() {
    if (stopped || polling) return;
    polling = true;

    try {
      const response = await fetch(TICKER_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rows = await response.json();

      if (!Array.isArray(rows)) {
        throw new Error("Unexpected ticker response");
      }

      const receivedAt = Date.now();
      let matched = 0;

      for (const row of rows) {
        const symbol = String(row.market || "").toUpperCase();

        if (!WATCHED_SYMBOLS.has(symbol)) continue;

        const price = Number(row.last_price);
        const timestamp = Number(row.timestamp);

        if (
          !Number.isFinite(price) || price <= 0 ||
          !Number.isFinite(timestamp) || timestamp <= 0
        ) continue;

        matched++;

        onTick({
          market: "crypto",
          instrumentId: `COINDCX:${symbol}`,
          timestamp,
          price,
          volume: 0,
          eventId: `coindcx-rest:${symbol}:${timestamp}`,
        });
      }

      lastSuccess = receivedAt;
      lastError = "";
      connected = matched > 0;

      onStatus(
        matched > 0
          ? `LIVE · ${matched} SYMBOLS`
          : "NO_MATCHING_MARKETS"
      );
    } catch (error) {
      connected = false;
      lastError = error?.message || String(error);
      onStatus(`REST_ERROR: ${lastError}`);
      console.error("LUX CoinDCX REST feed:", error);
    } finally {
      polling = false;
    }
  }

  function start() {
    if (!stopped) return;

    stopped = false;
    onStatus("FETCHING");
    poll();
    timer = window.setInterval(poll, POLL_INTERVAL_MS);
  }

  function stop() {
    stopped = true;
    connected = false;

    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }

    onStatus("IDLE");
  }

  return {
    start,
    stop,
    isConnected: () =>
      connected && Date.now() - lastSuccess <= 8000,
    getLastError: () => lastError,
  };
}
