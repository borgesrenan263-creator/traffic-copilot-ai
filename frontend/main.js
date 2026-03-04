import "./style.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const API_BASE = "http://localhost:8787";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="header">
    <div class="brand">
      <h1>Traffic Copilot AI</h1>
      <span class="badge">MVP • Driver Mode</span>
    </div>
    <div class="small">Mapa + chat com agente (tráfego simulado)</div>
  </div>

  <div class="layout">
    <div class="card">
      <div id="map" class="mapWrap"></div>
    </div>

    <div class="card">
      <div class="panel">
        <div class="row">
          <button id="btnLocate" class="btn primary">📍 Minha localização</button>
          <button id="btnSetDest" class="btn">🎯 Definir destino (toque no mapa)</button>
          <button id="btnClear" class="btn danger">🧹 Limpar</button>
        </div>

        <div class="small">
          Origem: <span id="originTxt">—</span><br/>
          Destino: <span id="destTxt">—</span>
        </div>

        <hr/>

        <div class="chat">
          <div id="chatLog"></div>

          <form id="chatForm" class="form">
            <input id="question" class="input" placeholder="Pergunte: 'Como está o trânsito?'" />
            <button class="btn primary" type="submit">Enviar</button>
          </form>

          <div class="small">
            Dica: toque no mapa para escolher o destino depois de ativar “Definir destino”.
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const originTxt = document.getElementById("originTxt");
const destTxt = document.getElementById("destTxt");
const chatLog = document.getElementById("chatLog");

function addBubble(text, who = "bot") {
  const div = document.createElement("div");
  div.className = `bubble ${who === "me" ? "me" : ""}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

let origin = null;
let destination = null;
let destPickMode = false;

function fmtPoint(p) {
  if (!p) return "—";
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

// Map init (centro aproximado Brasil)
const map = L.map("map", { zoomControl: true }).setView([-14.235, -51.925], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

let originMarker = null;
let destMarker = null;

function setOrigin(p) {
  origin = p;
  originTxt.textContent = fmtPoint(p);

  if (originMarker) originMarker.remove();
  originMarker = L.marker([p.lat, p.lng]).addTo(map).bindPopup("Origem").openPopup();
  map.setView([p.lat, p.lng], 15);
}

function setDestination(p) {
  destination = p;
  destTxt.textContent = fmtPoint(p);

  if (destMarker) destMarker.remove();
  destMarker = L.marker([p.lat, p.lng]).addTo(map).bindPopup("Destino").openPopup();
}

document.getElementById("btnLocate").addEventListener("click", () => {
  addBubble("Ok. Pegando sua localização…", "bot");

  if (!navigator.geolocation) {
    addBubble("Geolocalização não disponível neste navegador.", "bot");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      addBubble("Localização definida como origem.", "bot");
    },
    () => addBubble("Não consegui acessar sua localização. Permita nas configurações do navegador.", "bot"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

document.getElementById("btnSetDest").addEventListener("click", () => {
  destPickMode = !destPickMode;
  addBubble(destPickMode ? "Toque no mapa para definir o destino." : "Modo destino desativado.", "bot");
});

document.getElementById("btnClear").addEventListener("click", () => {
  origin = null;
  destination = null;
  originTxt.textContent = "—";
  destTxt.textContent = "—";
  if (originMarker) originMarker.remove();
  if (destMarker) destMarker.remove();
  originMarker = null;
  destMarker = null;
  addBubble("Ok. Limpei origem e destino.", "bot");
});

map.on("click", (e) => {
  if (!destPickMode) return;
  setDestination({ lat: e.latlng.lat, lng: e.latlng.lng });
  addBubble("Destino definido.", "bot");
  destPickMode = false;
});

async function askAgent(question) {
  const payload = {
    question,
    context: {
      mode: "driver",
      locale: "pt-BR",
      origin,
      destination
    }
  };

  const res = await fetch(`${API_BASE}/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status}: ${txt || "falha na API"}`);
  }
  return res.json();
}

document.getElementById("chatForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = document.getElementById("question");
  const q = input.value.trim();
  if (!q) return;

  addBubble(q, "me");
  input.value = "";

  try {
    const data = await askAgent(q);
    addBubble(data.answer || "Ok.", "bot");
  } catch (err) {
    addBubble("Erro ao chamar o backend. Confirme se ele está rodando na porta 8787.", "bot");
  }
});

addBubble("Bem-vindo! Defina origem (📍) e destino (🎯) e pergunte sobre o trânsito.", "bot");
