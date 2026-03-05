# Backend endpoints (Traffic Copilot AI)

## Health
GET /health

## Agent
POST /api/agent/ask
Body: { "text": "..." }

## Routing (OSRM proxy - se existir no backend)
GET /api/route?from=lat,lng&to=lat,lng

## Hazards (Overpass proxy - se existir no backend)
GET /api/hazards?lat=...&lng=...&radius=...
