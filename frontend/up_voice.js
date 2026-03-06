;(() => {
  // ======================================
  // TRAFFIC COPILOT AI - VOICE STABLE
  // compatível com main.js atual
  // ======================================

const API_BASE = "https://traffic-copilot-ai.onrender.com";

  const logEl = () => document.getElementById("log");

  function log(msg) {
    const el = logEl();
    if (!el) {
      console.log(msg);
      return;
    }
    el.textContent += msg + "\n";
    el.scrollTop = el.scrollHeight;
    console.log(msg);
  }

  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = "pt-BR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  window.addEventListener("error", (e) => {
    log("❌ ERRO JS: " + (e?.message || "desconhecido"));
  });

  window.addEventListener("unhandledrejection", (e) => {
    log("❌ PROMISE: " + (e?.reason?.message || e?.reason || "rejeitada"));
  });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    log("❌ SpeechRecognition não suportado neste navegador.");
    return;
  }

  const recognition = new SR();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.continuous = true;

  let voiceEnabled = false;
  let started = false;
  let unlocked = false;

  function callIf(fnName) {
    const fn = window[fnName];
    if (typeof fn === "function") return fn();
    log("⚠️ função não encontrada: " + fnName + "()");
    return null;
  }

  async function askBackend(text) {
    const res = await fetch(API_BASE + "/api/agent/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || ("HTTP " + res.status));
    }

    return data;
  }

  async function processVoice(raw) {
    const text = String(raw || "").trim();
    const t = text.toLowerCase();

    if (t.includes("copiloto iniciar")) {
      voiceEnabled = true;
      log("🟢 copiloto ativado");
      speak("Copiloto ativado. Diga minha localização, definir destino ou iniciar trajeto.");
      return;
    }

    if (!voiceEnabled) return;

    if (t.includes("minha localização") || t.includes("minha localizacao")) {
      callIf("setMyLocation");
      log("📍 comando: minha localização");
      speak("Obtendo sua localização.");
      return;
    }

    if (t.includes("definir destino")) {
      callIf("enableDestinationMode");
      log("🎯 comando: definir destino");
      speak("Modo destino ativado. Toque no mapa para escolher.");
      return;
    }

    if (t.includes("iniciar trajeto") || t.includes("iniciar rota")) {
      await callIf("startRoute");
      log("🧭 comando: iniciar trajeto");
      speak("Calculando rota.");
      return;
    }

    if (t.includes("limpar")) {
      callIf("clearRoute");
      log("🧹 comando: limpar");
      speak("Rota limpa.");
      return;
    }

    if (t.includes("pânico") || t.includes("panic")) {
      callIf("triggerPanic");
      log("🚨 comando: pânico");
      speak("Pânico ativado.");
      return;
    }

    try {
      const data = await askBackend(text);
      const reply = data?.response || "Ok.";
      log("🤖 " + reply);
      speak(reply);
    } catch (err) {
      log("❌ backend: " + (err?.message || err));
      speak("Não consegui falar com o servidor.");
    }
  }

  function startRecognition() {
    if (started) return;
    try {
      recognition.start();
      started = true;
      log("🎧 voz pronta");
    } catch (_) {}
  }

  recognition.onresult = async (e) => {
    try {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (!text) return;
      log("🗣️ ouvi: " + text);
      await processVoice(text);
    } catch (err) {
      log("❌ processVoice: " + (err?.message || err));
    }
  };

  recognition.onerror = (e) => {
    started = false;
    log("❌ voz erro: " + (e?.error || "desconhecido"));
  };

  recognition.onend = () => {
    started = false;
    if (voiceEnabled) {
      setTimeout(() => {
        startRecognition();
      }, 500);
    }
  };

  log("ℹ️ toque na tela 1x para ativar o microfone. Depois diga: copiloto iniciar");

  window.addEventListener("click", () => {
    if (!unlocked) {
      unlocked = true;
      speak("Voz pronta. Diga copiloto iniciar.");
      startRecognition();
    }
  }, { once: true });

})();
