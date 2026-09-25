# PoshanAI

Starter monorepo for an Indian-context nutrition awareness and meal-planning platform.

## Folder structure

```text
PoshanAI/
├── client/                 # React + Vite + Tailwind frontend
├── server/                 # Express API and MongoDB connection
├── ai-service/             # Optional Python OCR/RAG/pose service
├── nginx/                  # Reverse proxy and static hosting config
├── docker-compose.yml      # Local development stack
├── docker-compose.prod.yml # Production-oriented Compose overrides
├── .env.example
└── README.md
```

`client/src` is organized into components, pages, hooks, services, utils, store, and assets. `server/src` is organized into config, controllers, models, routes, middleware, services, utils, and `app.js`.

## Run locally

1. Copy `.env.example` to `.env`. Replace the example JWT secrets before implementing authentication; never commit `.env`.
2. Run `docker compose up --build` and open `http://localhost:8080`. API health is available at `http://localhost:4000/health`.
3. To run the JS apps directly, install dependencies in the root, `server`, and `client`; run MongoDB locally, set `MONGODB_URI=mongodb://127.0.0.1:27017/poshanai` in `.env`, then run `npm run dev` at the root.

## Current implementation

The frontend is a responsive landing page. The Express API connects to MongoDB and includes health endpoints, Helmet, restricted CORS, request-size limits, Mongo operator sanitization, API rate limiting, and non-revealing error responses. The `ai-service` directories are extension points only. Firebase/JWT authentication, OCR, IFCT retrieval, Gemini meal-plan generation, and application data routes are not implemented yet.

PoshanAI is intended for nutrition awareness and food suggestions. It must not diagnose or replace advice from a qualified healthcare professional.
