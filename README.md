# PoshanAI

Starter monorepo for an Indian-context nutrition awareness and meal-planning platform.

## Folder structure

```text
PoshanAI/
├── poshanai-frontend/      # React + Vite + Tailwind frontend
├── poshanai-backend/       # Express API, MongoDB connection, and Dockerfile
├── ai-service/             # Optional Python OCR/RAG/pose service
├── nginx/                  # Reverse proxy and static hosting config
├── docker-compose.yml      # Local development stack
├── docker-compose.prod.yml # Production-oriented Compose overrides
├── .env.example
└── README.md
```

`poshanai-frontend/src` is organized into components, pages, hooks, services, utils, store, and assets. `poshanai-backend/src` follows MVC with config, controllers, models, routes, and middleware, plus services, utils, `app.js`, and `server.js`.

## Run locally

1. Copy `poshanai-backend/.env.example` to `poshanai-backend/.env`; set long random values for both JWT secrets and configure `MONGODB_URI` for local MongoDB or Atlas. Replace the sample Atlas username/password placeholders with real credentials (URL-encode reserved characters in the password). Never commit `.env`.
2. Install dependencies in the root, `poshanai-backend`, and `poshanai-frontend`. Start the apps with `npm.cmd run dev` from PowerShell (this bypasses a restrictive `npm.ps1` execution policy without changing system settings). Open `http://localhost:5173`; API health is at `http://localhost:5000/health`.
3. If port 5000 is occupied, identify the listener with `Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess`. Stop only a process you recognize, or set `PORT=5001` in `poshanai-backend/.env` and set `VITE_API_URL=http://localhost:5001/api` in `poshanai-frontend/.env`.

The backend requires a valid `MONGODB_URI`; it does not replace placeholder Atlas credentials with a local connection. For local development, set it to `mongodb://127.0.0.1:27017/poshanai` and start MongoDB. Docker Compose supplies its own MongoDB URI. See `poshanai-frontend/src/components/motion/README.md` for Motion Primitives setup notes.

## Current implementation

The frontend is a responsive landing page. The Express API connects to MongoDB and includes health endpoints, Helmet, restricted CORS, request-size limits, Mongo operator sanitization, API rate limiting, and non-revealing error responses. Authentication includes registration, login, rotating refresh cookies, logout, access-token middleware, role checks, and request validation. The `ai-service` directories are extension points only; OCR, IFCT retrieval, and Gemini meal-plan generation are not implemented yet.

PoshanAI is intended for nutrition awareness and food suggestions. It must not diagnose or replace advice from a qualified healthcare professional.
