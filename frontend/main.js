import "./style.css"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

const API_BASE="http://localhost:8787"
const OSRM="https://router.project-osrm.org/route/v1/driving"

let origin=null
let destination=null
let routeInfo=null

const map=L.map("map").setView([-20.84,-49.35],13)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  attribution:"© OpenStreetMap"
}).addTo(map)

let originMarker=null
let destMarker=null
let routeLine=null

function log(msg){
  const box=document.getElementById("chat-log")
  const div=document.createElement("div")
  div.className="msg"
  div.textContent=msg
  box.appendChild(div)
}

document.getElementById("btn-origin").onclick=()=>{
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude
    const lng=pos.coords.longitude

    origin={lat,lng}

    if(originMarker)map.removeLayer(originMarker)

    originMarker=L.marker([lat,lng]).addTo(map).bindPopup("Origem").openPopup()

    map.setView([lat,lng],14)

    updateInfo()
  })
}

document.getElementById("btn-destination").onclick=()=>{
  log("Toque no mapa para escolher destino.")

  map.once("click",e=>{
    const lat=e.latlng.lat
    const lng=e.latlng.lng

    destination={lat,lng}

    if(destMarker)map.removeLayer(destMarker)

    destMarker=L.marker([lat,lng]).addTo(map).bindPopup("Destino").openPopup()

    updateInfo()
    calcRoute()
  })
}

function updateInfo(){
  document.getElementById("origin").textContent=
    origin?`${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`:"—"

  document.getElementById("destination").textContent=
    destination?`${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`:"—"
}

async function calcRoute(){

  if(!origin||!destination)return

  log("Calculando rota...")

  const url=`${OSRM}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`

  const res=await fetch(url)
  const data=await res.json()

  const route=data.routes[0]

  const distance=(route.distance/1000).toFixed(1)
  const duration=(route.duration/60).toFixed(0)

  routeInfo={
    distance:Number(distance),
    duration:Number(duration)
  }

  const coords=route.geometry.coordinates.map(c=>[c[1],c[0]])

  if(routeLine)map.removeLayer(routeLine)

  routeLine=L.polyline(coords,{color:"blue",weight:5}).addTo(map)

  map.fitBounds(routeLine.getBounds())

  log(`Rota pronta: ${distance} km • ${duration} min`)
}

document.getElementById("chat-send").onclick=async()=>{

  const input=document.getElementById("chat-input")

  const question=input.value

  if(!question)return

  log(question)

  const payload={
    question,
    context:{
      origin,
      destination,
      route:routeInfo
    }
  }

  const res=await fetch(`${API_BASE}/agent/query`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  })

  const data=await res.json()

  log(data.answer)

  input.value=""
}
