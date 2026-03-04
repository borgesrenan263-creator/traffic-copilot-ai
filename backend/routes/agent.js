const express = require("express");
const { trafficAgent } = require("../agents/trafficAgent");

const router = express.Router();

router.post("/query", (req, res) => {
  const result = trafficAgent(req.body);

  // Telemetria no console (por enquanto)
  console.log("[telemetry]", JSON.stringify(result.telemetry));

  res.json({
    answer: result.answer,
    context: result.context
  });
});

module.exports = router;
