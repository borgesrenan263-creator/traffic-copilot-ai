const express = require("express");
const cors = require("cors");

const agentRoutes = require("./routes/agent");

const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "traffic-copilot-backend" });
});

// Routes
app.use("/agent", agentRoutes);

const PORT = 8787;

app.listen(PORT, () => {
  console.log("Traffic Copilot backend rodando na porta", PORT);
});
