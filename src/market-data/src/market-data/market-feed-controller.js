
import { createCoinDcxRestFeed } from "./coindcx-rest-feed.js?v=1";
import { createCoinDcxSpotFeed } from "./coindcx-spot-feed.js?v=5";

const MARKET_SELECT_ID = "marketSelect";

let selectedMarket = "india";
let feedStatus = "IDLE";
let feedStatusElement = null;

const SUPPORTED_MARKETS = ["india", "crypto"];

const coinDcxFeed = createCoinDcxRestFeed({
  onTick: (tick) => {
    const result = ingestMarketTick(tick);

    if (result.accepted) {
      console.info(
        "LUX CoinDCX tick accepted:",
        tick.instrumentId,
        tick.price
      );
    }
  },

  onStatus: (status) => {
    feedStatus = status;

    if (selectedMarket !== "crypto") {
      feedStatus = "IDLE";
    }

    if (feedStatusElement) {
      feedStatusElement.textContent =
        `COINDCX: ${feedStatus}`;
    }

    console.info("LUX CoinDCX feed:", feedStatus);
  },
});

function readSelectedMarket() {
  const selector = document.getElementById(MARKET_SELECT_ID);

  if (selector && SUPPORTED_MARKETS.includes(selector.value)) {
    selectedMarket = selector.value;
  }

  return selectedMarket;
}

export function getMarketFeedState() {
  return {
    market: selectedMarket,
    feedStatus,
    mode: "PAPER",
    providerConnected: coinDcxFeed.isConnected(),
  };
}

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

function initializeMarketFeedController() {
  const selector = document.getElementById(MARKET_SELECT_ID);

  if (!selector) {
    console.warn("LUX: Market selector not found.");
    return;
  }

  selectedMarket = selector.value;

  feedStatusElement = document.createElement("span");
  feedStatusElement.className = "pill";
  feedStatusElement.textContent = "COINDCX: IDLE";

  selector.parentElement.insertBefore(
    feedStatusElement,
    selector.nextSibling
  );

  selector.addEventListener("change", () => {
    selectedMarket = selector.value;

    if (selectedMarket === "crypto") {
      coinDcxFeed.start();
    } else {
      coinDcxFeed.stop();
      feedStatus = "IDLE";
      feedStatusElement.textContent = "COINDCX: IDLE";
    }

    console.info(
      "LUX market changed:",
      selectedMarket,
      "| PAPER ONLY"
    );
  });

  console.info(
    "LUX Market Feed Controller ready:",
    selectedMarket,
    "| PAPER ONLY"
  );
}

initializeMarketFeedController();

