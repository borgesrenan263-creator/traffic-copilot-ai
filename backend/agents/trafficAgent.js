const { analyzeRoute } = require("../services/routeAnalysis")

function trafficAgent(payload){

  const ctx=payload.context||{}

  const route=ctx.route

  let answer="Preciso de uma rota para analisar."

  if(route){

    const analysis=analyzeRoute(route.distance,route.duration)

    const speed=(route.distance/(route.duration/60)).toFixed(1)

    answer=
`Análise da rota:

Distância: ${analysis.distanceKm} km
Tempo base: ${analysis.durationMin} min
Velocidade média: ${speed} km/h

Trânsito: ${analysis.trafficLevel}
Atraso estimado: +${analysis.estimatedDelay} min`
  }

  return{
    answer,
    context:ctx
  }

}

module.exports={trafficAgent}
