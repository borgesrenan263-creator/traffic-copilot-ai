function compareRoutes(mainRoute,altRoute){

if(!altRoute)return null

const diff=mainRoute.duration-altRoute.duration

if(diff>1){

return{
recommendation:"alternative",
timeSaved:diff
}

}

return{
recommendation:"main",
timeSaved:0
}

}

module.exports={compareRoutes}
