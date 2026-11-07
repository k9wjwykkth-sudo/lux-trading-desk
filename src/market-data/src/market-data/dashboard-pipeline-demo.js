const topRight = document.querySelector(".topright");

const button = document.createElement("button");
button.className = "btn primary";
button.textContent = "Run PAPER Pipeline";
button.id = "runPaperPipeline";

if (topRight) {
  topRight.appendChild(button);
}

import("./lux-market-pipeline.js")
  .then(({ luxMarketPipeline }) => {

    button.addEventListener("click", () => {
      let accepted = 0;
      let rejected = 0;
      let closed = 0;
      let signals = 0;

      const instrument = "LUX-TEST-" + Date.now();
      const baseTime = Math.floor(Date.now() / 60000) * 60000;
      const rejectionReasons = {};

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
          closed += result.closedCandles?.length ?? 0;
          signals += result.actionableSignals?.length ?? 0;
        } else {
          rejected++;
          const reason = result.reason || "unknown";
          rejectionReasons[reason] =
            (rejectionReasons[reason] || 0) + 1;
        }
      }

      const report =
        "PAPER PIPELINE COMPLETED\n\n" +
        "Accepted ticks: " + accepted + "\n" +
        "Rejected ticks: " + rejected + "\n" +
        "Closed candles: " + closed + "\n" +
        "Trading signals: " + signals + "\n\n" +
        "Rejection details: " +
        JSON.stringify(rejectionReasons) + "\n\n" +
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

      if (activity) {
        const item = document.createElement("div");
        item.className = "activity";
        item.textContent = report;
        activity.prepend(item);
      }
    });
  })
  .catch(error => {
    button.textContent = "Pipeline unavailable";
    console.error("LUX pipeline error:", error);
  });
