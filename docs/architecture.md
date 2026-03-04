# System Architecture Diagram — Traffic Copilot AI (v1)

## Camadas
- Client Layer: Driver App (PWA), Fleet Dashboard, Emergency Console
- SaaS Core: Auth/Tenancy, API Backend, Realtime (WS), Notification Service
- AI Layer: Agent Orchestrator (Agente Supremo Core), Tool Router, Guardrails, Cache/LLMOps
- Data & Observability: Operational DB, Event Store, Analytics, Registry
- Integrations: Map Provider, Routing API, Traffic API, Push, Voice (futuro), Car/Bluetooth (futuro)

## Diagrama (ASCII)
[cole a versão atual aqui quando atualizarmos]

## Fluxos-chave
- Driver Mode: pergunta → contexto → tools → resposta curta → telemetria
- Fleet Mode: tracking → ETA → alertas → métricas
- Emergency Mode: corredor → alerta ~2 min → realtime updates → auditoria
