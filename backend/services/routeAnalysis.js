function analyzeRoute(distanceKm, durationMin) {

  let trafficLevel
  let delay

  if(durationMin < 10){
    trafficLevel="livre"
    delay=0
  }
  else if(durationMin < 20){
    trafficLevel="moderado"
    delay=3
  }
  else{
    trafficLevel="congestionado"
    delay=7
  }

  return {
    distanceKm,
    durationMin,
    trafficLevel,
    estimatedDelay:delay
  }

}

module.exports={analyzeRoute}
