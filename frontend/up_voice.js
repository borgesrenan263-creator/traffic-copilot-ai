(() => {

const $ = (id)=>document.getElementById(id)

function log(t){
const box = $("log")
console.log(t)
if(box){
box.textContent += "\n"+t
box.scrollTop = box.scrollHeight
}
}

function speak(t){
try{
speechSynthesis.cancel()
const u = new SpeechSynthesisUtterance(t)
u.lang="pt-BR"
speechSynthesis.speak(u)
}catch(e){}
}

function norm(s){
return s.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.trim()
}

window.TC = window.TC || {}

const state = TC.state = TC.state || {
active:false,
origin:null,
dest:null,
route:null
}

function updateUI(){
if(state.origin && $("originTxt")){
$("originTxt").textContent =
(state.origin.label && state.origin.label !== "Minha localização")
? state.origin.label.split(",")[0]
: `${state.origin.lat.toFixed(5)},${state.origin.lng.toFixed(5)}`
}

if(state.dest && $("destTxt")){
$("destTxt").textContent =
state.dest.label
? state.dest.label.split(",")[0]
: `${state.dest.lat.toFixed(5)},${state.dest.lng.toFixed(5)}`
}
}

async function geocode(q){

const url=
"https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent\(q\)

const r=await fetch(url)
const j=await r.json()

if(!j.length)return null

return{
lat:Number(j[0].lat),
lng:Number(j[0].lon),
label:j[0].display_name
}
}

function marker(lat,lng,label){

if(!window.L||!window.map)return

return L.marker([lat,lng])
.addTo(map)
.bindPopup(label)
}

async function startRoute(force=false){

if(!state.origin){
log("origem não definida")
speak("Defina a origem primeiro")
return
}

if(!state.dest){
log("destino não definido")
speak("Defina o destino primeiro")
return
}

log("calculando rota")

const url=
`https://router.project-osrm.org/route/v1/driving/${state.origin.lng},${state.origin.lat};${state.dest.lng},${state.dest.lat}?overview=full&geometries=geojson`

const r=await fetch(url)
const j=await r.json()

if(!j.routes||!j.routes[0]){
log("erro rota")
return
}

const coords=j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])

if(state.route) state.route.remove()

state.route=L.polyline(coords).addTo(map)

map.fitBounds(coords)

const km=j.routes[0].distance/1000
const min=j.routes[0].duration/60

log(`rota desenhada: ${km.toFixed(1)} km • ${min.toFixed(0)} min`)
speak(`Rota pronta. ${km.toFixed(1)} quilômetros`)

// envia coords pro Driver Mode
if(window.TC && typeof TC.setRouteCoords === "function"){
TC.setRouteCoords(coords)
}
}

async function origemGPS(){

navigator.geolocation.getCurrentPosition(p=>{

const lat=p.coords.latitude
const lng=p.coords.longitude

state.origin={
lat,lng,label:"Minha localização"
}

marker(lat,lng,"Origem")

updateUI()

log("origem gps definida")
speak("Origem definida")

})

}

async function destinoLugar(place){

log("buscando destino")

const g=await geocode(place)

if(!g){
speak("não encontrei destino")
return
}

state.dest=g

marker(g.lat,g.lng,"Destino")

updateUI()

log("destino definido")
speak("Destino definido")

map.setView([g.lat,g.lng],14)

}

async function partidaLugar(place){

log("buscando partida")

const g=await geocode(place)

if(!g){
speak("não encontrei partida")
return
}

state.origin=g

marker(g.lat,g.lng,"Partida")

updateUI()

log("partida definida")
speak("Partida definida")

map.setView([g.lat,g.lng],14)

}

async function processar(text){

const t=norm(text)

if(t.includes("copiloto iniciar")){
state.active=true
log("copiloto ativado")
speak("Copiloto ativado")
return
}

if(!state.active) return

if(t.includes("ajuda")){
speak("Comandos. Minha localização. Destino mais o local. Partida mais o local. Iniciar trajeto. Driver mode.")
return
}

if(t.includes("driver mode") || t.includes("modo motorista")){
if(window.TC && typeof TC.toggleDriver === "function"){
TC.toggleDriver()
speak("Alternando driver mode")
}else{
speak("Driver mode não está disponível")
}
return
}

if(t.includes("minha localizacao")){
origemGPS()
return
}

if(t.startsWith("destino ")){
const lugar=text.slice(text.toLowerCase().indexOf("destino")+7)
destinoLugar(lugar)
return
}

if(t.startsWith("partida ")){
const lugar=text.slice(text.toLowerCase().indexOf("partida")+7)
partidaLugar(lugar)
return
}

if(
t.includes("iniciar trajeto")||
t.includes("definir trajeto")||
t.includes("iniciar rota")
){
startRoute()
return
}

}

function start(){

const SR=window.SpeechRecognition||window.webkitSpeechRecognition
if(!SR) return

const r=new SR()

r.lang="pt-BR"
r.continuous=true

r.onresult=e=>{
const t=e.results[e.results.length-1][0].transcript
log("ouvi: "+t)
processar(t)
}

r.onend=()=>setTimeout(()=>r.start(),600)

// inicia no primeiro toque (mobile)
window.addEventListener("click",()=>{
try{
r.start()
log("voz pronta")
speak("Voz pronta. Diga copiloto iniciar.")
}catch(_){}
},{once:true})

log("ℹ️ toque na tela 1x para ativar o microfone. Depois diga: 'copiloto iniciar'")
}

TC.startRoute = startRoute

start()

})()
