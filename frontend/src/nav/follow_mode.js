// Upgrade 1 - Follow Mode (stub)
// Objetivo: centralizar no GPS + atualizar rota em loop + re-route fora da rota
export function createFollowMode({ log, speak }) {
  let enabled = false
  let timer = null

  function start(onTick, ms = 12000) {
    stop()
    timer = setInterval(() => {
      if (!enabled) return
      try { onTick?.() } catch (e) { log?.("⚠️ follow tick erro: " + e.message) }
    }, ms)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function setEnabled(v) {
    enabled = !!v
  }

  return { start, stop, setEnabled }
}
