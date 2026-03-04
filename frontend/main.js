import "./style.css"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

const API_BASE = "http://localhost:8787"
const OSRM_BASE = "https://router.project-osrm.org"

let origin = null
let destination = null

let originMarker = null
let destMarker = null
let routeLine = null

const app = document.querySelector("#app")

app.innerHTML = `
<div class="container">

<h1>Traffic Copilot AI</h1>

<div id="map"></div>

<div class="controls">
<button id="btnLocate">📍 Minha localização</button>
<button id="btnSetDest">🎯 Definir destino</button>
<button id="btnClear">🧹 Limpar</button>

<div id="coords">
Origem: —
<br>
Destino: —
</div>
</div>

<div id="chat">
<div class="bubble bot">
Bem-vindo! Defina origem e destino para calcular a rota.
</div>
</div>

<div class="inputRow">
<input id="question" placeholder="Pergunte: Como está o trânsito?" />
<button id="send">Enviar</button>
</div>

</div>
`

const map = L.map("map").setView([-15.78, -47.93], 4)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
 attribution:"Leaflet | OpenStreetMap"
}).addTo(map)

function addBubble(text,role="bot"){
 const chat=document.querySelector("#chat")
 const div=document.createElement("div")
 div.className="bubble "+role
 div.innerText=text
 chat.appendChild(div)
 chat.scrollTop=chat.scrollHeight
}

function updateCoords(){
 const c=document.querySelector("#coords")

 c.innerHTML=`
 Origem: ${origin ? origin.lat.toFixed(5)+","+origin.lng.toFixed(5) : "—"}
 <br>
 Destino: ${destination ? destination.lat.toFixed(5)+","+destination.lng.toFixed(5) : "—"}
 `
}

function setOrigin(p){

 origin=p

 if(originMarker) originMarker.remove()

 originMarker=L.marker([p.lat,p.lng]).addTo(map).bindPopup("Origem").openPopup()

 updateCoords()

 drawRouteIfReady()

}

function setDestination(p){

 destination=p

 if(destMarker) destMarker.remove()

 destMarker=L.marker([p.lat,p.lng]).addTo(map).bindPopup("Destino").openPopup()

 updateCoords()

 drawRouteIfReady()

}

async function drawRouteIfReady(){

 if(!origin || !destination) return

 const o=`${origin.lng},${origin.lat}`
 const d=`${destination.lng},${destination.lat}`

 const url=`${OSRM_BASE}/route/v1/driving/${o};${d}?overview=full&geometries=geojson`

 try{

 addBubble("Calculando rota...")

 const res=await fetch(url)
 const data=await res.json()

 const route=data.routes[0]

 const coords=route.geometry.coordinates.map(c=>[c[1],c[0]])

 if(routeLine) routeLine.remove()

 routeLine=L.polyline(coords,{color:"blue",weight:5}).addTo(map)

 map.fitBounds(routeLine.getBounds(),{padding:[20,20]})

 const km=(route.distance/1000).toFixed(1)
 const min=Math.round(route.duration/60)

 addBubble(`Rota pronta: ${km} km • ${min} min`)

 }catch(e){

 addBubble("Erro ao calcular rota")

 }

}

document.querySelector("#btnLocate").onclick=()=>{

 if(!navigator.geolocation){

 addBubble("Geolocalização não suportada")

 return
 }

 navigator.geolocation.getCurrentPosition(pos=>{

 const p={
 lat:pos.coords.latitude,
 lng:pos.coords.longitude
 }

 setOrigin(p)

 map.setView([p.lat,p.lng],14)

 },()=>{

 addBubble("Não consegui acessar sua localização.")

 })

}

let pickDest=false

document.querySelector("#btnSetDest").onclick=()=>{

 pickDest=true

 addBubble("Toque no mapa para escolher destino.")

}

map.on("click",e=>{

 if(!pickDest) return

 setDestination({
 lat:e.latlng.lat,
 lng:e.latlng.lng
 })

 pickDest=false

})

document.querySelector("#btnClear").onclick=()=>{

 origin=null
 destination=null

 if(originMarker) originMarker.remove()
 if(destMarker) destMarker.remove()
 if(routeLine) routeLine.remove()

 originMarker=null
 destMarker=null
 routeLine=null

 updateCoords()

 addBubble("Ok. Limpei origem e destino.")

}

document.querySelector("#send").onclick=async()=>{

 const q=document.querySelector("#question")

 const text=q.value.trim()

 if(!text) return

 addBubble(text,"user")

 q.value=""

 const payload={
 question:text,
 context:{
 mode:"driver",
 origin,
 destination,
 locale:"pt-BR"
 }
 }

 try{

 const res=await fetch(API_BASE+"/agent/query",{
 method:"POST",
 headers:{
 "Content-Type":"application/json"
 },
 body:JSON.stringify(payload)
 })

 const data=await res.json()

 addBubble(data.answer)

 }catch(e){

 addBubble("Erro ao falar com agente.")

 }

}
