(() => {
const $ = (id) => document.getElementById(id)

function log(t){
  const box = $("log")
  if(box){
    box.textContent += "\n" + t
    box.scrollTop = box.scrollHeight
  }
  console.log(t)
}

function speak(t){
  try{
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = "pt-BR"
    speechSynthesis.speak(u)
  }catch(_){}
}

function norm(s){
  return String(s||"")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .trim()
}

function haversine(a,b){
  const R = 6371000
  const toRad = (x)=> x*Math.PI/180
  const dLat = toRad(b.lat-a.lat)
  const dLng = toRad(b.lng-a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const s1 = Math.sin(dLat/2)
  const s2 = Math.sin(dLng/2)
  const h = s1*s1 + Math.cos(la1)*Math.cos(la2)*s2*s2
  return 2*R*Math.asin(Math.sqrt(h))
}

// distância aproximada de um ponto até uma rota (lista de [lat,lng])
function distToRoute(p, route){
  if(!route || route.length < 2) return Infinity
  // aproxima: menor distância até os pontos da rota (bom o suficiente pro MVP)
  let best = Infinity
  for(let i=0;i<route.length;i+=3){
    const q = {lat: route[i][0], lng: route[i][1]}
    const d = haversine(p,q)
    if(d < best) best = d
  }
  return best
}

// estado global compartilhado
window.TC = window.TC || {}
TC.driver = TC.driver || {
  enabled: false,
  watchId: null,
  lastRouteAt: 0,
  lastHazardAt: 0,
  currentPos: null,
  lastSpeed: null,
  routeCoords: null
}

function uiDriver(on){
  const b = $("btnDriver")
  if(b){
    b.textContent = on ? "🚗 Driver Mode: ON" : "🚗 Driver Mode: OFF"
  }
}

function setSpeedUI(ms){
  // tenta achar um lugar padrão pra mostrar velocidade
  const sp = $("speedTxt")
  if(sp){
    if(ms == null) sp.textContent = "—"
    else sp.textContent = Math.round(ms*3.6) + " km/h"
  }
}

function setOriginUI(lat,lng){
  const o = $("originTxt")
  if(o) o.textContent = `${lat.toFixed(5)},${lng.toFixed(5)}`
}

function ensureMarker(){
  if(!window.map || !window.L) return null
  if(!TC.driver._marker){
    TC.driver._marker = L.circleMarker([0,0], {radius: 8}).addTo(map)
  }
  return TC.driver._marker
}

async function maybeRoute(reason){
  const now = Date.now()
  if(!window.TC || !TC.state) return
  if(!TC.state.dest || !TC.state.origin) return

  // limite pra não espammar OSRM
  const cooldown = 15000
  if(now - TC.driver.lastRouteAt < cooldown) return

  TC.driver.lastRouteAt = now
  log("🛰️ recalculando rota ("+reason+")")
  speak("Recalculando rota")

  try{
    await TC.startRoute(true) // força
  }catch(e){
    log("❌ erro ao recalcular rota")
  }
}

function maybeHazardAlert(){
  const now = Date.now()
  const cooldown = 20000
  if(now - TC.driver.lastHazardAt < cooldown) return
  if(!TC.driver.currentPos) return

  const hazards = window.__tc_hazards
  if(!Array.isArray(hazards) || hazards.length === 0) return

  let closest = null
  let best = Infinity

  for(const h of hazards){
    if(h && typeof h.lat === "number" && typeof h.lng === "number"){
      const d = haversine(TC.driver.currentPos, h)
      if(d < best){
        best = d
        closest = h
      }
    }
  }

  if(best < 250){
    TC.driver.lastHazardAt = now
    const type = closest.type ? ` ${closest.type}` : ""
    log(`⚠️ hazard próximo: ${Math.round(best)}m${type}`)
    speak(`Atenção. Risco na via a ${Math.round(best)} metros`)
  }
}

function onPos(p){
  const lat = p.coords.latitude
  const lng = p.coords.longitude
  const spd = p.coords.speed // m/s (pode ser null)
  TC.driver.currentPos = {lat,lng}

  // atualiza origin global do app (se o voice já usa TC.state)
  TC.state = TC.state || {}
  TC.state.origin = {lat,lng,label:"Minha localização"}

  setOriginUI(lat,lng)
  setSpeedUI(spd)

  const m = ensureMarker()
  if(m) m.setLatLng([lat,lng])

  // se existe rota desenhada (vinda do TC.startRoute), checa desvio
  if(Array.isArray(TC.driver.routeCoords)){
    const off = distToRoute({lat,lng}, TC.driver.routeCoords)
    if(off > 120){
      maybeRoute("desvio")
      return
    }
  }

  // reroute “suave” por tempo
  maybeRoute("atualização")
  maybeHazardAlert()
}

function onErr(){
  log("❌ GPS falhou no Driver Mode")
  speak("GPS indisponível")
}

function enable(){
  if(!navigator.geolocation){
    log("❌ sem geolocation")
    speak("Geolocalização indisponível")
    return
  }
  if(TC.driver.enabled) return

  TC.driver.enabled = true
  uiDriver(true)
  log("🚗 Driver Mode ON")
  speak("Driver mode ativado")

  TC.driver.watchId = navigator.geolocation.watchPosition(
    onPos,
    onErr,
    { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
  )
}

function disable(){
  if(!TC.driver.enabled) return
  TC.driver.enabled = false
  uiDriver(false)
  log("🛑 Driver Mode OFF")
  speak("Driver mode desativado")

  if(TC.driver.watchId != null){
    try{ navigator.geolocation.clearWatch(TC.driver.watchId) }catch(_){}
    TC.driver.watchId = null
  }
}

function toggle(){
  if(TC.driver.enabled) disable()
  else enable()
}

// liga botão quando existir
window.addEventListener("load", () => {
  const b = $("btnDriver")
  if(b){
    b.addEventListener("click", toggle)
    uiDriver(false)
  }
})

// comando por voz via TC.processVoice (se existir)
TC.toggleDriver = toggle
TC.enableDriver = enable
TC.disableDriver = disable

// recebe rota do main/voice (hook)
TC.setRouteCoords = (coords) => {
  // coords: [[lat,lng],...]
  TC.driver.routeCoords = Array.isArray(coords) ? coords : null
}

})()
