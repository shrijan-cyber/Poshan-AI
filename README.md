# PoshanAI

Starter monorepo for an Indian-context nutrition awareness and meal-planning platform. The architecture reference is in `PoshanAI_System_Architecture.md` if you add it to this repository; OCR, Firebase/JWT auth, IFCT retrieval, and Gemini generation are future modules, not implemented integrations in this scaffold.

## Structure

```text
poshanai/
├── poshanai-frontend/   # React + Vite + Tailwind client
├── poshanai-backend/    # Express API, MongoDB connection, security middleware
├── ai-service/          # Reserved for optional Python OCR/AI workers
├── nginx/               # Reverse proxy and static hosting config
├── docker-compose.yml   # Local MongoDB, Redis, API, and frontend
├── .env.example
└── README.md
```

## Run locally

1. Copy `.env.example` to `.env` and set a long random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` before adding authentication. Never commit `.env`.
2. For containers: `docker compose up --build` then open `http://localhost:8080`; API health is at `http://localhost:4000/health`.
3. For local development: run `npm install` in the root, `poshanai-backend`, and `poshanai-frontend`; start MongoDB locally, set `MONGODB_URI=mongodb://127.0.0.1:27017/poshanai` and `CLIENT_ORIGIN=http://localhost:5173` in `.env`; run `npm run dev` at the root.

API has Helmet headers, strict CORS origin, JSON size limits, Mongo operator sanitization, basic API rate limiting, safe error responses, and health/readiness routes. Before production, add authentication and route-level authorization, refresh-token rotation, request schemas for each endpoint, secure uploaded-file storage, TLS, and secret management.

PoshanAI provides awareness and food suggestions only. It must not diagnose deficiencies or replace clinical advice.
