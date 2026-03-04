import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet default icon fix (Vite)
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
});

/* ============================================================
   Traffic Copilot AI — MAIN (ULTRA)
   - Map init safe + invalidateSize
   - Origin (GPS) + Destination picker
   - OSRM route (main + alternative)
   - Hazards (OSM Overpass): roadworks/construction/hazard/barrier
   - Panic: share/copy + call 190/192 + map link
============================================================ */

const $ = (id) => document.getElementById(id);

const ui = {
  mapDiv: $("map"),
  originText: $("originText"),
  destText: $("destText"),
  chatLog: $("chatLog"),
  question: $("question"),
  btnSend: $("btnSend"),
  btnLoc: $("btnLoc"),
  btnDest: $("btnDest"),
  btnClear: $("btnClear"),
  // (se existir no HTML)
  btnPanic: $("btnPanic") || $("panicBtn") || $("PANIC") || null,
};

// Chips (se você já criou no HTML/CSS)
const chipMain = $("chipMain") || null;
const chipAlt = $("chipAlt") || null;
const chipTraffic = $("chipTraffic") || null;

const state = {
  map: null,
  origin: null,
  dest: null,
  pickingDest: false,
  originMarker: null,
  destMarker: null,
  routeMain: null,
  routeAlt: null,
  hazardLayer: null,
};

function now() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function logLine(text, icon = "🧠") {
  if (!ui.chatLog) return;
  const row = document.createElement("div");
  row.className = "logRow";
  row.textContent = `${icon} ${text}`;
  ui.chatLog.prepend(row);
}

function fmtCoord(c) {
  if (!c) return "—";
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

function setCoordsUI() {
  if (ui.originText) ui.originText.textContent = state.origin ? fmtCoord(state.origin) : "—";
  if (ui.destText) ui.destText.textContent = state.dest ? fmtCoord(state.dest) : "—";
}

function setDestMode(on) {
  state.pickingDest = on;
  if (ui.btnDest) {
    ui.btnDest.classList.toggle("active", on);
    ui.btnDest.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (on) logLine("Toque no mapa para escolher destino.", "🧭");
}

function safeInvalidate(tag = "invalidate") {
  try {
    if (state.map) {
      state.map.invalidateSize(true);
      // eslint-disable-next-line no-console
      console.log("[map]", tag, "invalidateSize()");
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[map]", tag, e);
  }
}

function initMap() {
  if (!ui.mapDiv) {
    console.warn("Div #map não encontrada.");
    return;
  }

  // previne double-init
  if (state.map) return;

  state.map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
  }).setView([-20.82, -49.38], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(state.map);

  state.hazardLayer = L.layerGroup().addTo(state.map);

  state.map.on("click", (e) => {
    if (!state.pickingDest) return;
    setDestination(e.latlng);
    setDestMode(false);
  });

  logLine("Mapa carregado.", "🗺️");

  // reforço: Vite + mobile layout
  setTimeout(() => safeInvalidate("boot+300ms"), 300);
  setTimeout(() => safeInvalidate("boot+1500ms"), 1500);
  window.addEventListener("resize", () => safeInvalidate("resize"));
  window.addEventListener("orientationchange", () => safeInvalidate("orientation"));
}

function setOrigin(latlng) {
  state.origin = { lat: latlng.lat, lng: latlng.lng };

  if (state.originMarker) state.originMarker.remove();
  state.originMarker = L.marker([state.origin.lat, state.origin.lng], { title: "Origem" }).addTo(state.map);

  setCoordsUI();
  state.map.setView([state.origin.lat, state.origin.lng], 14);
  logLine(`Origem definida: ${fmtCoord(state.origin)}`, "📍");

  tryBuildRoutes();
}

function setDestination(latlng) {
  state.dest = { lat: latlng.lat, lng: latlng.lng };

  if (state.destMarker) state.destMarker.remove();
  state.destMarker = L.marker([state.dest.lat, state.dest.lng], { title: "Destino" }).addTo(state.map);

  setCoordsUI();
  logLine(`Destino definido: ${fmtCoord(state.dest)}`, "🎯");

  tryBuildRoutes();
}

function clearAll() {
  state.origin = null;
  state.dest = null;
  setDestMode(false);

  if (state.originMarker) state.originMarker.remove();
  if (state.destMarker) state.destMarker.remove();
  state.originMarker = null;
  state.destMarker = null;

  if (state.routeMain) state.routeMain.remove();
  if (state.routeAlt) state.routeAlt.remove();
  state.routeMain = null;
  state.routeAlt = null;

  if (state.hazardLayer) state.hazardLayer.clearLayers();

  setCoordsUI();
  logLine("Reset completo.", "🧹");
  updateChips(null, null, null);
  safeInvalidate("clear");
}

function updateChips(mainText, altText, trafficText) {
  if (chipMain) chipMain.textContent = mainText ?? "Rota principal: —";
  if (chipAlt) chipAlt.textContent = altText ?? "Alternativa: —";
  if (chipTraffic) chipTraffic.textContent = trafficText ?? "Trânsito: —";
}

function km(m) {
  return (m / 1000).toFixed(1) + " km";
}
function mins(s) {
  return Math.max(1, Math.round(s / 60)) + " min";
}

/* ------------------ OSRM Routes ------------------ */

async function fetchOSRMRoute(origin, dest, alternatives = true) {
  // FIX CRÍTICO: sem barras/escapes inválidos
  const base = "https://router.project-osrm.org/route/v1/driving/";
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url =
    base +
    coords +
    `?overview=full&geometries=geojson&steps=false&alternatives=${alternatives ? "true" : "false"}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  return res.json();
}

function drawRoute(routeGeoJson, kind = "main") {
  const style =
    kind === "alt"
      ? { weight: 6, opacity: 0.6 }
      : { weight: 7, opacity: 0.9 };

  const layer = L.geoJSON(routeGeoJson, { style }).addTo(state.map);
  return layer;
}

function fitToRoute(layer) {
  try {
    const b = layer.getBounds();
    state.map.fitBounds(b, { padding: [20, 20] });
  } catch (_) {}
}

async function tryBuildRoutes() {
  if (!state.map || !state.origin || !state.dest) return;

  logLine("Calculando rotas (principal + alternativa)...", "🧭");

  // remove anteriores
  if (state.routeMain) state.routeMain.remove();
  if (state.routeAlt) state.routeAlt.remove();
  state.routeMain = null;
  state.routeAlt = null;

  try {
    const data = await fetchOSRMRoute(state.origin, state.dest, true);
    const routes = data?.routes || [];
    if (!routes.length) throw new Error("OSRM não retornou rotas.");

    // principal
    const r0 = routes[0];
    state.routeMain = drawRoute(r0.geometry, "main");

    const mainText = `Rota principal: ${km(r0.distance)} • ${mins(r0.duration)}`;
    logLine(`✅ ${mainText}`, "✅");

    // alternativa (se tiver)
    let altText = "Alternativa: —";
    if (routes[1]) {
      const r1 = routes[1];
      state.routeAlt = drawRoute(r1.geometry, "alt");
      altText = `Alternativa: ${km(r1.distance)} • ${mins(r1.duration)}`;
      logLine(`🧭 ${altText}`, "🧭");
    } else {
      logLine("Sem alternativa retornada (OSRM não forneceu).", "🧭");
    }

    // “trânsito” (simulado por enquanto)
    const traffic = simulateTrafficLevel(r0.distance, r0.duration);
    const trafficText = `Trânsito: ${traffic} (simulado)`;
    updateChips(mainText, altText, trafficText);

    // hazards OSM (Overpass) perto da rota principal
    await loadHazardsNearRoute(r0.geometry);

    fitToRoute(state.routeMain);
    safeInvalidate("route");
  } catch (e) {
    console.error(e);
    logLine(`Falha ao calcular rota: ${String(e.message || e)}`, "⚠️");
  }
}

function simulateTrafficLevel(distanceM, durationS) {
  // heurística simples (apenas UX)
  const speed = distanceM / Math.max(1, durationS); // m/s
  if (speed < 6) return "PESADO";
  if (speed < 10) return "MODERADO";
  return "LIVRE";
}

/* ------------------ Hazards (Overpass) ------------------ */

function bboxFromLine(coords, pad = 0.01) {
  // coords: [lng,lat]...
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lng, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return {
    s: minLat - pad,
    w: minLng - pad,
    n: maxLat + pad,
    e: maxLng + pad,
  };
}

async function loadHazardsNearRoute(geo) {
  if (!geo?.coordinates?.length) return;
  if (!state.hazardLayer) return;

  state.hazardLayer.clearLayers();

  const bb = bboxFromLine(geo.coordinates, 0.01);
  const overpass = "https://overpass-api.de/api/interpreter"\;

  // “Hazards” que fazem sentido e são legais/grátis via OSM (não é trânsito em tempo real):
  // - highway=construction
  // - construction=*
  // - hazard=*
  // - barrier=*
  // - highway=roadworks (às vezes aparece)
  const query = `
[out:json][timeout:25];
(
  node["highway"="construction"](${bb.s},${bb.w},${bb.n},${bb.e});
  way["highway"="construction"](${bb.s},${bb.w},${bb.n},${bb.e});
  node["hazard"](${bb.s},${bb.w},${bb.n},${bb.e});
  way["hazard"](${bb.s},${bb.w},${bb.n},${bb.e});
  node["barrier"](${bb.s},${bb.w},${bb.n},${bb.e});
  node["highway"="roadworks"](${bb.s},${bb.w},${bb.n},${bb.e});
  way["highway"="roadworks"](${bb.s},${bb.w},${bb.n},${bb.e});
);
out center;
`;

  try {
    const res = await fetch(overpass, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();
    const els = data?.elements || [];

    if (!els.length) {
      logLine("Hazards OSM: nada encontrado perto da rota.", "🟡");
      return;
    }

    let count = 0;
    for (const el of els) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lng !== "number") continue;

      const tags = el.tags || {};
      const title =
        tags.name ||
        tags.hazard ||
        tags.barrier ||
        tags.construction ||
        tags.highway ||
        "hazard";

      const m = L.circleMarker([lat, lng], {
        radius: 7,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.8,
      });

      m.bindPopup(`<b>⚠️ Hazard (OSM)</b><br>${escapeHtml(String(title))}`);
      m.addTo(state.hazardLayer);
      count++;
      if (count >= 25) break; // limite pra não pesar no mobile
    }

    logLine(`Hazards OSM: ${count} ponto(s) carregado(s).`, "⚠️");
  } catch (e) {
    console.warn(e);
    logLine("Hazards OSM: falha ao buscar (pode ser limite do Overpass).", "⚠️");
  }
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------ Panic ------------------ */

function buildPanicMessage() {
  const pos = state.origin || state.dest;
  const lat = pos?.lat;
  const lng = pos?.lng;

  const link = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : "(sem GPS)";
  return [
    "🚨 *PANIC — Traffic Copilot AI*",
    `Horário: ${new Date().toLocaleString()}`,
    `Local: ${lat && lng ? `${lat}, ${lng}` : "não disponível"}`,
    `Mapa: ${link}`,
    "",
    "Preciso de ajuda. (Polícia 190 / SAMU 192)",
  ].join("\n");
}

async function panicAction() {
  const msg = buildPanicMessage();

  // copiar
  try {
    await navigator.clipboard.writeText(msg);
    logLine("PANIC: mensagem copiada (clipboard).", "🚨");
  } catch (_) {
    logLine("PANIC: não consegui copiar automaticamente (clipboard bloqueado).", "🚨");
  }

  // share (se suportar)
  try {
    if (navigator.share) {
      await navigator.share({ title: "PANIC — Traffic Copilot AI", text: msg });
      logLine("PANIC: compartilhamento aberto.", "🚨");
    }
  } catch (_) {}

  // abrir discador (opções)
  // 190 Polícia / 192 SAMU
  // NÃO liga automático: só abre o discador (mais seguro)
  try {
    window.open("tel:190", "_self");
  } catch (_) {}
}

/* ------------------ UI Events ------------------ */

async function handleGPS() {
  if (!navigator.geolocation) {
    logLine("Geolocalização não suportada no navegador.", "⚠️");
    return;
  }

  logLine("Pegando GPS...", "📡");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setOrigin(latlng);
    },
    (err) => {
      logLine(`GPS falhou: ${err.message}`, "⚠️");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
  );
}

function handleAsk() {
  const q = (ui.question?.value || "").trim();
  if (!q) return;

  logLine(`Você: ${q}`, "🧠");

  // enquanto não temos API real de trânsito, damos um “copilot” simples:
  const traffic = chipTraffic ? chipTraffic.textContent : "Trânsito: —";
  logLine(`Análise: ${traffic.replace("Trânsito: ", "")}`, "📊");

  ui.question.value = "";
}

function bindEvents() {
  if (ui.btnLoc) ui.btnLoc.addEventListener("click", handleGPS);
  if (ui.btnDest) ui.btnDest.addEventListener("click", () => setDestMode(!state.pickingDest));
  if (ui.btnClear) ui.btnClear.addEventListener("click", clearAll);
  if (ui.btnSend) ui.btnSend.addEventListener("click", handleAsk);

  if (ui.question) {
    ui.question.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAsk();
    });
  }

  if (ui.btnPanic) {
    ui.btnPanic.addEventListener("click", () => {
      // confirmação simples
      const ok = confirm("Ativar PANIC? Vou copiar/compartilhar sua localização e abrir o discador (190).");
      if (ok) panicAction();
    });
  }
}

/* ------------------ Boot ------------------ */

function boot() {
  initMap();
  bindEvents();
  setCoordsUI();
  updateChips(null, null, null);
  logLine("Bem-vindo! Defina origem (📍) e destino (🎯) para calcular rota.", "🟣");
}

boot();
