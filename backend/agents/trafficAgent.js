const { analyzeRoute } = require("../services/routeAnalysis")

function trafficAgent(payload){

  const ctx = payload.context || {}

  const origin = ctx.origin
  const destination = ctx.destination

  let answer="Preciso de origem e destino."

  if(origin && destination){

    const distance=8
    const duration=10

    const analysis=analyzeRoute(distance,duration)

    answer=
`Análise de trânsito:

Rota: ${analysis.distanceKm} km
Tempo base: ${analysis.durationMin} min

Trânsito: ${analysis.trafficLevel}
Atraso estimado: +${analysis.estimatedDelay} min

Sugestão:
Mantenha velocidade constante e evite horários de pico.`

  }

  return {
    answer,
    context:ctx
  }

}

module.exports={trafficAgent}
