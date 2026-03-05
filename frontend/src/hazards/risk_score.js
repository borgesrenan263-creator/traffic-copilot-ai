// Upgrade 2 - Hazard Intelligence (stub)
// Entrada: hazards + route polyline (ou lista de pontos) -> score 0..100
export function computeRiskScore({ hazardsCount = 0, nearRouteCount = 0 }) {
  // heurística simples inicial
  const base = Math.min(100, hazardsCount * 2 + nearRouteCount * 4)
  return base
}

export function riskLabel(score) {
  if (score >= 70) return "ALTO"
  if (score >= 35) return "MÉDIO"
  return "BAIXO"
}
