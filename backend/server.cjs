const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

// ================================
// HEALTH CHECK
// ================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "traffic-copilot-backend",
    time: new Date().toISOString()
  })
})

// ================================
// AGENT CHAT API
// ================================

app.post("/api/agent/ask", (req, res) => {

  const text = (req.body.text || "").toLowerCase()

  let response = "Comando não reconhecido."

  if (text.includes("status")) {
    response = "Sistema Traffic Copilot operacional."
  }

  if (text.includes("trânsito")) {
    response = "Trânsito moderado nas proximidades."
  }

  if (text.includes("rota")) {
    response = "Calculando melhor rota disponível."
  }

  if (text.includes("socorro") || text.includes("acidente")) {
    response = "Alerta enviado para emergência."
  }

  res.json({
    ok: true,
    input: text,
    response: response
  })
})

// ================================
// PANIC API
// ================================

app.post("/api/panic", (req, res) => {

  const { lat, lon } = req.body

  console.log("🚨 PANIC ALERT", lat, lon)

  res.json({
    ok: true,
    message: "Alerta de emergência registrado",
    location: { lat, lon }
  })
})

// ================================
// START SERVER
// ================================

const PORT = 8787

app.listen(PORT, () => {
  console.log("Traffic Copilot Backend running on port", PORT)
})
