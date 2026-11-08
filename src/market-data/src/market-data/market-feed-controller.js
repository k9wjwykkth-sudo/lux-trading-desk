src/market-data/src/market-data/market-feed-controller.js

/**
 * LUX Market Feed Controller
 *
 * Connects a future market-data adapter to the existing
 * candle and signal pipeline.
 *
 * PAPER ONLY — no live orders.
 * No provider connection is active yet.
 */

import { luxMarketPipeline } from "./lux-market-pipeline.js";

const MARKET_SELECT_ID = "marketSelect";

let selectedMarket = "india";
let feedStatus = "AWAITING_PROVIDER";

const SUPPORTED_MARKETS = ["india", "crypto"];

/**
 * Read the market currently selected on the dashboard.
 */
function readSelectedMarket() {
  const selector = document.getElementById(MARKET_SELECT_ID);

  if (selector && SUPPORTED_MARKETS.includes(selector.value)) {
    selectedMarket = selector.value;
  }

  return selectedMarket;
}

/**
 * Get controller status.
 */
export function getMarketFeedState() {
  return {
    market: selectedMarket,
    feedStatus,
    mode: "PAPER",
    providerConnected: false,
  };
}

/**
 * Receive a normalized tick from a future provider adapter.
 *
 * Required:
 * market, instrumentId, timestamp, price
 *
 * Optional:
 * volume, eventId
 */
export function ingestMarketTick(tick) {
  readSelectedMarket();

  if (!tick || typeof tick !== "object") {
    return {
      accepted: false,
      reason: "invalid_tick",
    };
  }

  if (tick.market !== selectedMarket) {
    return {
      accepted: false,
      reason: "market_mismatch",
    };
  }

  const normalizedTick = {
    instrumentId: tick.instrumentId,
    timestamp: tick.timestamp,
    price: tick.price,
    volume: tick.volume ?? 0,
    eventId: tick.eventId,
  };

  return luxMarketPipeline.ingestTick(normalizedTick);
}

/**
 * Update the selected market when the dashboard selector changes.
 */
function initializeMarketFeedController() {
  const selector = document.getElementById(MARKET_SELECT_ID);

  if (!selector) {
    console.warn("LUX: Market selector not found.");
    return;
  }

  selectedMarket = selector.value;

  selector.addEventListener("change", () => {
    selectedMarket = selector.value;
    feedStatus = "AWAITING_PROVIDER";

    console.info(
      "LUX market changed:",
      selectedMarket,
      "| PAPER ONLY"
    );
  });

  console.info(
    "LUX Market Feed Controller ready:",
    selectedMarket,
    "| Awaiting provider connection"
  );
}

initializeMarketFeedController();
