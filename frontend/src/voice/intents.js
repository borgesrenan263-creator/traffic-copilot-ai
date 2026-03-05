// Upgrade 3 - Voz 2.0 (stub)
// Parse simples PT-BR
export function parseIntent(raw) {
  const text = (raw || "").toLowerCase().trim()

  // wake
  if (text.includes("copiloto iniciar")) return { intent: "WAKE" }
  if (text.includes("copiloto parar") || text.includes("cancelar")) return { intent: "CANCEL" }

  // origin/destination
  if (text.startsWith("destino ")) return { intent: "SET_DESTINATION", query: raw.slice(8).trim() }
  if (text.startsWith("origem ")) return { intent: "SET_ORIGIN", query: raw.slice(7).trim() }

  // route
  if (text.includes("iniciar trajeto") || text.includes("traçar rota") || text.includes("iniciar rota")) {
    return { intent: "ROUTE_START" }
  }

  // ui/controls
  if (text.includes("minha localização")) return { intent: "MY_LOCATION" }
  if (text.includes("ligar driver") || text.includes("driver on")) return { intent: "DRIVER_ON" }
  if (text.includes("desligar driver") || text.includes("driver off")) return { intent: "DRIVER_OFF" }
  if (text.includes("repetir")) return { intent: "REPEAT" }
  if (text.includes("silenciar")) return { intent: "MUTE" }

  // fallback
  return { intent: "UNKNOWN", raw }
}
