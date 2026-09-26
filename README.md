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

1. Copy `.env.example` to `.env` and set long random values for both JWT secrets; never commit `.env`.
2. Run `docker compose up --build` and open `http://localhost:8080`. API health is available at `http://localhost:5000/health`.
3. To run the JS apps directly, install dependencies in the root, `poshanai-backend`, and `poshanai-frontend`; run MongoDB locally, set `MONGODB_URI=mongodb://127.0.0.1:27017/poshanai` in `.env`, then run `npm run dev` at the root.

## Current implementation

The frontend is a responsive landing page. The Express API connects to MongoDB and includes health endpoints, Helmet, restricted CORS, request-size limits, Mongo operator sanitization, API rate limiting, and non-revealing error responses. Authentication includes registration, login, rotating refresh cookies, logout, access-token middleware, role checks, and request validation. The `ai-service` directories are extension points only; OCR, IFCT retrieval, and Gemini meal-plan generation are not implemented yet.

PoshanAI is intended for nutrition awareness and food suggestions. It must not diagnose or replace advice from a qualified healthcare professional.
