# PoshanAI Frontend

PoshanAI is a nutrition awareness application. This repository contains its React frontend, with placeholder pages for the dashboard, account screens, profile, reports, and meal plans.

## Tech stack

- React 18 and Vite
- Tailwind CSS
- Redux Toolkit and React Redux
- React Router
- Axios and Framer Motion

## Prerequisites

- Node.js 20 or newer
- npm

## Setup

```sh
git clone https://github.com/shrijan-cyber/Poshan-AI.git
cd Poshan-AI/poshanai-frontend
npm install
cp .env.example .env
npm run dev
```

Vite prints the local development URL after startup. Update `.env` with your API and Firebase configuration as needed. Do not commit real credentials.

## Project structure

```text
src/
  api/          Shared Axios client and endpoint wrappers
  components/   Reusable UI components
  context/      React contexts, including authentication
  hooks/        Reusable React hooks
  pages/        Route page components
  routes/       Route guards
  services/     API service re-exports used by application state
  store/        Redux store and feature slices
  App.jsx       Application route tree
  main.jsx      React entry point and providers
```

## Available scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` checks JavaScript and JSX with ESLint.
- `npm run lint:fix` applies available ESLint fixes.
- `npm run format` formats supported project files with Prettier.

## Coding conventions

Read the repository's [`AI_CONTEXT.json`](../AI_CONTEXT.json) before contributing. Keep components focused, use JavaScript and JSX, prefer Tailwind utilities for page styling, and use the shared API client for HTTP requests.

## Git workflow

Create a feature branch from the current integration branch, keep each pull request focused, and open a pull request for review before merging. Do not commit generated output, local environment files, or real credentials.

## AI agent usage

AI agents working in this repository must read [`AI_CONTEXT.json`](../AI_CONTEXT.json) before making changes and follow its conventions and security rules. Review generated changes and run the relevant lint or build command before opening a pull request.
