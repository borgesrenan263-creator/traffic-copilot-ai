function buildContext(payload) {
  const ctx = payload?.context || {};
  return {
    locale: ctx.locale || "pt-BR",
    mode: ctx.mode || "driver", // driver | fleet | emergency
    origin: ctx.origin || null,
    destination: ctx.destination || null,
    prefs: ctx.prefs || { avoidTolls: false, avoidHighways: false }
  };
}

function safetyReply(text) {
  // resposta curta e objetiva (safe driving)
  if (!text) return "Ok.";
  const trimmed = String(text).trim();
  return trimmed.length > 180 ? trimmed.slice(0, 177) + "..." : trimmed;
}

function trafficAgent(payload) {
  const question = (payload?.question || "").trim();
  const ctx = buildContext(payload);

  // Telemetria mínima (no futuro vai para Event Store)
  const telemetry = {
    ts: new Date().toISOString(),
    event: "agent_query",
    mode: ctx.mode,
    hasOrigin: !!ctx.origin,
    hasDestination: !!ctx.destination,
    questionSize: question.length
  };

  // MVP: resposta simulada, mas já com estrutura
  let answer = "Entendi. No MVP, ainda não estou consultando tráfego real.";
  if (!question) answer = "Me diga sua dúvida de trânsito ou destino.";
  else if (ctx.destination) answer = `Entendi. Vou considerar seu destino e o trânsito ao redor. Pergunta: "${question}"`;
  else answer = `Entendi sua pergunta: "${question}". Se você informar destino, melhoro a orientação.`;

  return {
    answer: safetyReply(answer),
    context: ctx,
    telemetry
  };
}

module.exports = { trafficAgent };
