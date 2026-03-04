const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "traffic-copilot-backend"
  });
});

app.post("/agent/query", (req, res) => {
  const { question } = req.body;

  const response = {
    answer: "Simulação inicial do agente. Pergunta recebida: " + question
  };

  res.json(response);
});

const PORT = 8787;

app.listen(PORT, () => {
  console.log("Traffic Copilot backend rodando na porta", PORT);
});
