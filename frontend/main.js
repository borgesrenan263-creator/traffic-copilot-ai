/* Traffic Copilot AI — MAIN (ULTRA)
   - Leaflet map + safe invalidateSize
   - Driver Mode (watchPosition + speed)
   - Destination pick mode
   - OSRM route (main + alternative)
   - OSM Hazards via Overpass (speed bumps, crossings, traffic signals)
   - PANIC button: 192/190 + copy location
*/

const $ = (id) => document.getElementById(id);

const logEl = $("log");
const originTxt = $("originTxt");
const destTxt = $("destTxt");
const mainChip = $("mainChip");
const altChip = $("altChip");
const trafficChip = $("trafficChip");
const speedChip = $("speedChip");

const mapOverlay = $("mapOverlay");
const overlayText = $("overlayText");

const themeBtn = $("themeBtn");
const panicBtn = $("panicBtn");
const locBtn = $("locBtn");
const destBtn = $("destBtn");
const clearBtn = $("clearBtn");
const sendBtn = $("sendBtn");
const q = $("q");

function log(line){
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${line}\n` + (logEl.textContent || "");
}

function setOverlay(show, text){
  if(show){
    overlayText.textContent = text || "Carregando…";
    mapOverlay.classList.remove("hidden");
  }else{
    mapOverlay.classList.add("hidden");
  }
}

/* -------------------- Theme -------------------- */
function getTheme(){
  return localStorage.getItem("tcp_theme") || "dark";
}
function setTheme(theme){
  localStorage.setItem("tcp_theme", theme);
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  themeBtn.textContent = theme === "light" ? "☀️" : "🌙";
}
themeBtn.addEventListener("click", () => {
  const cur = getTheme();
  setTheme(cur === "dark" ? "light" : "dark");
});
setTheme(getTheme());

/* -------------------- Map -------------------- */
let map;
let origin = null;        // {lat, lon}
let destination = null;   // {lat, lon}
let pickMode = false;

let originMarker = null;
let destMarker = null;
let routeLineMain = null;
let routeLineAlt = null;

let hazardsLayer = L.layerGroup();
let watchId = null;

function ensureMapVisible(){
  try{
    if(map) map.invalidateSize();
  }catch(e){}
}

function initMap(){
  map = L.map("map", { zoomControl: true }).setView([-20.82, -49.38], 12);
  window.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: 'Leaflet | © OpenStreetMap'
  }).addTo(map);

  hazardsLayer.addTo(map);

  map.on("click", (e) => {
    if(!pickMode){
      log("Toque ignorado (ative 🎯 Definir destino).");
      return;
    }
    destination = { lat: e.latlng.lat, lon: e.latlng.lng };
    setDestinationMarker(destination);
    destTxt.textContent = fmt(destination);
    log(`Destino definido: ${fmt(destination)}`);
    pickMode = false;
    destBtn.textContent = "🎯 Definir destino";
    calcRoutes();
  });

  window.addEventListener("load", ensureMapVisible);
  window.addEventListener("resize", ensureMapVisible);
  window.addEventListener("orientationchange", ensureMapVisible);

  // give time for mobile layout
  setTimeout(ensureMapVisible, 350);

  log("🗺️ mapa carregado");
}

function fmt(p){
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}

function setOriginMarker(p){
  if(originMarker) originMarker.remove();
  originMarker = L.marker([p.lat, p.lon]).addTo(map);
}

function setDestinationMarker(p){
  if(destMarker) destMarker.remove();
  destMarker = L.marker([p.lat, p.lon]).addTo(map);
}

function clearRoutes(){
  if(routeLineMain) routeLineMain.remove();
  if(routeLineAlt) routeLineAlt.remove();
  routeLineMain = null;
  routeLineAlt = null;
}

function clearHazards(){
  hazardsLayer.clearLayers();
}

/* -------------------- Geolocation / Driver Mode -------------------- */
async function getOneShotLocation(){
  if(!navigator.geolocation){
    log("❌ Geolocation não suportado.");
    return null;
  }
  setOverlay(true, "Pegando GPS…");
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOverlay(false);
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        resolve({ p, speed: pos.coords.speed });
      },
      (err) => {
        setOverlay(false);
        log(`❌ GPS erro: ${err.message || err.code}`);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
    );
  });
}

function startDriverMode(){
  if(!navigator.geolocation){
    log("❌ Sem geolocation.");
    return;
  }
  if(watchId) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      origin = p;
      originTxt.textContent = fmt(origin);
      setOriginMarker(origin);

      const sp = pos.coords.speed;
      if(typeof sp === "number" && !Number.isNaN(sp)){
        const kmh = Math.max(0, sp * 3.6);
        speedChip.textContent = `Velocidade: ${kmh.toFixed(0)} km/h`;
      }

      // keep centered softly
      if(map) map.panTo([p.lat, p.lon], { animate: true, duration: 0.5 });

    },
    (err) => {
      log(`❌ Driver mode erro: ${err.message || err.code}`);
    },
    { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }
  );

  log("🚗 Driver Mode: ligado (GPS ao vivo)");
}

/* -------------------- Routing (OSRM) -------------------- */
function km(m){ return (m/1000).toFixed(1); }
function mins(s){ return Math.max(1, Math.round(s/60)); }

async function osrmRoute(from, to, alternatives=false){
  // ✅ IMPORTANT: sem " no final (isso quebrava o Vite)
  const base = "https://router.project-osrm.org/route/v1/driving/";
  const url =
    `${base}${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=${alternatives ? "true" : "false"}`;

  const res = await fetch(url);
  if(!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  return await res.json();
}

function drawRoute(geojson, kind){
  const line = L.geoJSON(geojson, {
    style: {
      color: kind === "alt" ? "#8aa7ff" : "#2e6bff",
      weight: 7,
      opacity: kind === "alt" ? 0.65 : 0.9
    }
  }).addTo(map);

  return line;
}

async function calcRoutes(){
  if(!origin || !destination){
    log("⚠️ Defina origem + destino antes de calcular rota.");
    return;
  }
  setOverlay(true, "Calculando rota (OSRM)…");
  clearRoutes();
  clearHazards();

  try{
    const json = await osrmRoute(origin, destination, true);
    if(!json || !json.routes || !json.routes.length) throw new Error("OSRM sem rotas");

    const main = json.routes[0];
    routeLineMain = drawRoute(main.geometry, "main");

    mainChip.textContent = `Rota principal: ${km(main.distance)} km • ${mins(main.duration)} min`;

    if(json.routes[1]){
      const alt = json.routes[1];
      routeLineAlt = drawRoute(alt.geometry, "alt");
      altChip.textContent = `Alternativa: ${km(alt.distance)} km • ${mins(alt.duration)} min`;
      log("✅ rota principal + alternativa calculadas");
    } else {
      altChip.textContent = "Alternativa: —";
      log("⚠️ Sem alternativa retornada (OSRM não forneceu).");
    }

    // Fit bounds
    const group = L.featureGroup([routeLineMain, routeLineAlt].filter(Boolean));
    map.fitBounds(group.getBounds().pad(0.15));
    ensureMapVisible();

    // “Trânsito” ainda é simulado (dados reais exigem provedor dedicado)
    trafficChip.textContent = "Trânsito: MODERADO (simulado)";

    // Hazards (OSM)
    await loadHazardsAlongRoute(main.geometry);

  }catch(e){
    log(`❌ rota falhou: ${e.message}`);
  }finally{
    setOverlay(false);
  }
}

/* -------------------- Hazards (Overpass OSM) -------------------- */
function bboxFromGeoJSONLine(lineGeo){
  const coords = lineGeo.coordinates;
  let minLat= 999, minLon= 999, maxLat= -999, maxLon= -999;
  for(const [lon, lat] of coords){
    minLat = Math.min(minLat, lat);
    minLon = Math.min(minLon, lon);
    maxLat = Math.max(maxLat, lat);
    maxLon = Math.max(maxLon, lon);
  }
  return { minLat, minLon, maxLat, maxLon };
}

async function overpass(query){
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method:"POST",
    headers: { "Content-Type":"text/plain;charset=UTF-8" },
    body: query
  });
  if(!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return await res.json();
}

function hazardIcon(emoji){
  return L.divIcon({
    className: "hazIcon",
    html: `<div style="font-size:20px;filter: drop-shadow(0 6px 14px rgba(0,0,0,.45));">${emoji}</div>`,
    iconSize: [22,22],
    iconAnchor: [11,11]
  });
}

async function loadHazardsAlongRoute(routeGeo){
  try{
    setOverlay(true, "Buscando hazards (OSM)…");

    // BBox do trajeto + uma folga
    const bb = bboxFromGeoJSONLine(routeGeo);
    const padLat = (bb.maxLat - bb.minLat) * 0.12 + 0.01;
    const padLon = (bb.maxLon - bb.minLon) * 0.12 + 0.01;

    const south = (bb.minLat - padLat).toFixed(6);
    const west  = (bb.minLon - padLon).toFixed(6);
    const north = (bb.maxLat + padLat).toFixed(6);
    const east  = (bb.maxLon + padLon).toFixed(6);

    // Hazards úteis e legais via OSM:
    // - traffic_calming (lombada), crossing (faixa), traffic_signals (semáforo)
    const q = `
[out:json][timeout:25];
(
  node["traffic_calming"](${south},${west},${north},${east});
  node["highway"="crossing"](${south},${west},${north},${east});
  node["highway"="traffic_signals"](${south},${west},${north},${east});
);
out body;
`;

    const data = await overpass(q);
    const els = (data && data.elements) ? data.elements : [];
    let count = 0;

    for(const el of els){
      if(el.type !== "node") continue;
      const tags = el.tags || {};
      let emoji = "⚠️";
      let title = "Hazard";

      if(tags.traffic_calming){
        emoji = "🟡";
        title = "Lombada / traffic calming";
      } else if(tags.highway === "crossing"){
        emoji = "🚶";
        title = "Faixa de pedestre";
      } else if(tags.highway === "traffic_signals"){
        emoji = "🚦";
        title = "Semáforo";
      }

      L.marker([el.lat, el.lon], { icon: hazardIcon(emoji) })
        .bindPopup(`<b>${title}</b><br/><small>OSM</small>`)
        .addTo(hazardsLayer);

      count++;
      if(count >= 60) break; // limite pra não poluir
    }

    log(`🧠 Hazards OSM: ${count} pontos no entorno da rota`);
  }catch(e){
    log(`⚠️ Hazards falhou: ${e.message}`);
  }finally{
    setOverlay(false);
  }
}

/* -------------------- PANIC -------------------- */
async function panicFlow(){
  // sempre tentar ter a localização mais atual possível
  let msgP = origin;

  const one = await getOneShotLocation();
  if(one && one.p) msgP = one.p;

  if(!msgP){
    alert("PANIC: sem GPS disponível.");
    return;
  }

  const lat = msgP.lat;
  const lon = msgP.lon;
  const link = `https://maps.google.com/?q=${lat},${lon}`;
  const msg = `🚨 EMERGÊNCIA\nLocalização: ${lat.toFixed(6)},${lon.toFixed(6)}\nMapa: ${link}`;

  // Copiar para clipboard (pra colar no WhatsApp/SMS)
  try{
    await navigator.clipboard.writeText(msg);
    log("✅ PANIC: localização copiada (clipboard).");
  }catch(e){
    log("⚠️ PANIC: não consegui copiar (clipboard).");
  }

  const ok = confirm("PANIC: OK = ligar 192 (SAMU)\nCancelar = ligar 190 (Polícia)");
  const number = ok ? "192" : "190";
  // abre app de telefone
  window.location.href = `tel:${number}`;

  alert("Localização copiada! Cole no WhatsApp/SMS.\n\n" + msg);
}

panicBtn.addEventListener("click", panicFlow);

/* -------------------- UI actions -------------------- */
locBtn.addEventListener("click", async () => {
  const one = await getOneShotLocation();
  if(!one || !one.p) return;

  origin = one.p;
  originTxt.textContent = fmt(origin);
  setOriginMarker(origin);

  map.setView([origin.lat, origin.lon], 15);
  ensureMapVisible();

  log(`📍 Origem definida: ${fmt(origin)}`);
  startDriverMode(); // liga driver mode automático
});

destBtn.addEventListener("click", () => {
  pickMode = !pickMode;
  destBtn.textContent = pickMode ? "🎯 Toque no mapa…" : "🎯 Definir destino";
  log(pickMode ? "🎯 toque no mapa para escolher destino" : "🎯 modo destino desligado");
});

clearBtn.addEventListener("click", () => {
  pickMode = false;
  destBtn.textContent = "🎯 Definir destino";

  destination = null;
  destTxt.textContent = "—";
  if(destMarker) destMarker.remove();
  destMarker = null;

  clearRoutes();
  clearHazards();

  mainChip.textContent = "Rota principal: —";
  altChip.textContent = "Alternativa: —";
  trafficChip.textContent = "Trânsito: —";
  log("🧹 limpo");
});

sendBtn.addEventListener("click", () => {
  const text = (q.value || "").trim();
  if(!text){
    log("⚠️ Pergunta vazia.");
    return;
  }
  // por enquanto: resposta simulada
  log(`🧠 Você: ${text}`);
  log("📊 Análise: Trânsito MODERADO (simulado).");
  q.value = "";
});

/* -------------------- Boot -------------------- */
initMap();
