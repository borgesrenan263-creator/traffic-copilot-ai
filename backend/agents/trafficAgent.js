const { getTrafficInfo } = require("../services/trafficService");

function buildContext(payload) {
  const ctx = payload?.context || {};

  return {
    locale: ctx.locale || "pt-BR",
    mode: ctx.mode || "driver",
    origin: ctx.origin || null,
    destination: ctx.destination || null
  };
}

function trafficAgent(payload) {

  const ctx = buildContext(payload);

  let traffic = null;

  if (ctx.origin && ctx.destination) {
    traffic = getTrafficInfo(ctx.origin, ctx.destination);
  }

  let answer = "Preciso de origem e destino para analisar o trânsito.";

  if (traffic) {
    answer =
      `Trânsito ${traffic.trafficStatus}. ` +
      `A rota pode ter aproximadamente ${traffic.extraMinutes} minutos extras.`;
  }

  return {
    answer,
    context: ctx,
    traffic
  };
}

module.exports = { trafficAgent };
