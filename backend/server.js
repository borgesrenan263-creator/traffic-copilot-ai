const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "traffic-copilot-backend", time: new Date().toISOString() });
});

/**
 * Endpoint simples p/ "Panic" (log + retorno).
 * (Sem enviar nada automaticamente — só serve de prova de vida / auditoria local.)
 */
app.post("/panic", (req, res) => {
  const payload = req.body || {};
  res.json({
    ok: true,
    received: payload,
    note: "panic received (no automatic messaging).",
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Traffic Copilot backend rodando na porta ${PORT}`);
});
