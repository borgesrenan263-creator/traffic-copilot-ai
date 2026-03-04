const { analyzeRoute } = require("../services/routeAnalysis")
const { compareRoutes } = require("../services/routeComparator")

function trafficAgent(payload){

const ctx=payload.context||{}
const route=ctx.route

let answer="Preciso de uma rota para analisar."

if(route){

const analysis=analyzeRoute(route.distance,route.duration)

const altRoute={
distance:route.distance*1.05,
duration:route.duration-2
}

const decision=compareRoutes(route,altRoute)

answer=
`Análise da rota:

Distância: ${analysis.distanceKm} km
Tempo base: ${analysis.durationMin} min
Velocidade média: ${analysis.speed} km/h

Trânsito: ${analysis.trafficLevel}
Atraso estimado: +${analysis.estimatedDelay} min`

if(decision.recommendation==="alternative"){

answer+=`

🚀 Rota alternativa disponível
Economia estimada: ${decision.timeSaved} min`

}

}

return{
answer,
context:ctx
}

}

module.exports={trafficAgent}
