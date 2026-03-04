const { detectCongestion } = require("./congestionDetector")

function analyzeRoute(distanceKm,durationMin){

const speed=distanceKm/(durationMin/60)

const traffic=detectCongestion(speed)

return{

distanceKm,
durationMin,
speed:Number(speed.toFixed(1)),
trafficLevel:traffic.trafficLevel,
estimatedDelay:traffic.estimatedDelay

}

}

module.exports={analyzeRoute}
