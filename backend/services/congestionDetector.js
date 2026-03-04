function detectCongestion(speed){

let level="livre"
let delay=0

if(speed<25){
level="congestionado"
delay=10
}

else if(speed<45){
level="moderado"
delay=3
}

return{
trafficLevel:level,
estimatedDelay:delay
}

}

module.exports={detectCongestion}
