
const SOCKET_ENDPOINT = "https://stream-spot.coindcx.com";
const PRICE_CHANNEL = "currentPrices@spot@1s";
const PRICE_EVENT = "currentPrices@spot#update";

const WATCHED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
];

export function createCoinDcxSpotFeed({
  onTick = () => {},
  onStatus = () => {},
} = {}) {
  let socket = null;

  function start() {
    if (typeof window.io !== "function") {
      onStatus("SOCKET_LIBRARY_MISSING");
      return;
    }

    if (socket && socket.connected) return;

    onStatus("CONNECTING");

    socket = window.io.connect(SOCKET_ENDPOINT, {
          transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      onStatus("CONNECTED");

      socket.emit("join", {
        channelName: PRICE_CHANNEL,
      });
    });

    socket.on("connect_error", (error) => {
  const detail = error && error.message
    ? error.message
    : String(error || "unknown");

  onStatus(`CONNECTION_ERROR: ${detail}`);
  console.error("LUX CoinDCX connection error:", error);
});

    socket.on("disconnect", () => {
      onStatus("DISCONNECTED");
    });

    socket.on(PRICE_EVENT, (response) => {
      const data = response && response.data
        ? response.data
        : response;

      if (!data || !data.prices) return;

      const timestamp = Number(data.ts) || Date.now();

      WATCHED_SYMBOLS.forEach((symbol) => {
        if (!Object.prototype.hasOwnProperty.call(
          data.prices,
          symbol
        )) return;

        const price = Number(data.prices[symbol]);

        if (!Number.isFinite(price) || price <= 0) return;

        onTick({
          market: "crypto",
          instrumentId: `COINDCX:${symbol}`,
          timestamp,
          price,
          volume: 0,
          eventId: `coindcx:${symbol}:${timestamp}:${price}`,
        });
      });
    });
  }

  function stop() {
    if (!socket) return;

    socket.emit("leave", {
      channelName: PRICE_CHANNEL,
    });

    socket.disconnect();
    socket = null;

    onStatus("DISCONNECTED");
  }

  return {
    start,
    stop,
    isConnected: () => Boolean(socket && socket.connected),
  };
}

