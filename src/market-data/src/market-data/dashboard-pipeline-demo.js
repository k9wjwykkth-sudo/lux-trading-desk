import { luxMarketPipeline } from "./lux-market-pipeline.js";

const topRight = document.querySelector(".topright");

const button = document.createElement("button");
button.className = "btn primary";
button.textContent = "Run PAPER Pipeline";
button.id = "runPaperPipeline";

topRight.appendChild(button);

button.addEventListener("click", () => {
  let accepted = 0;
  let rejected = 0;
  let closed = 0;
  let signals = 0;

  const instrument = "LUX-DASH-DEMO";
  const baseTime = 1800000000000;

  for (let i = 0; i < 45; i++) {
    let price;

    if (i < 20) {
      price = 100 + i * 0.3;
    } else if (i < 32) {
      price = 106 - (i - 20) * 0.35;
    } else {
      price = 101.8 + (i - 32) * 0.5;
    }
        const result = luxMarketPipeline.ingestTick({
      instrumentId: instrument,
      timestamp: baseTime + i * 60000,
      price,
      volume: 10,
      eventId: instrument + "-" + i
    });

    if (result.accepted) {
      accepted++;
      closed += result.closedCandles.length;
      signals += result.actionableSignals.length;
    } else {
      rejected++;
    }
  }

  const report =
    "PAPER PIPELINE COMPLETED\n\n" +
    "Accepted ticks: " + accepted + "\n" +
    "Rejected ticks: " + rejected + "\n" +
    "Closed candles: " + closed + "\n" +
    "Trading signals: " + signals + "\n\n" +
    "Mode: PAPER ONLY";

  document.getElementById("decision").textContent =
    signals > 0 ? "SIGNAL GENERATED" : "WAIT";

  document.getElementById("decisionText").textContent = report;

  document.getElementById("chiefStatus").textContent = "PAPER TEST DONE";
  document.getElementById("chiefStatus").className = "status active";

  document.getElementById("entry").textContent = "See notifications";
  document.getElementById("stop").textContent = "PAPER";
  document.getElementById("target").textContent = "PAPER";

  const activity = document.getElementById("activity");
  const item = document.createElement("div");
  item.className = "activity";
  item.textContent = report;
  activity.prepend(item);
});
