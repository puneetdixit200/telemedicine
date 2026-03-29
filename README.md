# Telemedicine Rural App

Production-style telemedicine web app built with Express, Prisma, PostgreSQL, Socket.IO, a React SPA frontend, and Azure Blob Storage.

## Overview

This app supports patient, doctor, and admin roles with appointment booking, doctor slot management, consultation context, prescriptions, document uploads, and role-based authorization.

## Tech Stack

1. Backend: Node.js, Express (CommonJS)
2. Database: PostgreSQL with Prisma ORM
3. Frontend: React SPA (Vite build served by Express)
4. Realtime: Socket.IO signaling for consultation flow
5. Storage: Azure Blob Storage (Azure-only upload mode supported)
6. Security: Helmet CSP, cookie auth (JWT), rate limiting
7. Styling: Tailwind build pipeline + custom CSS system
8. Testing: Jest + Supertest

## Core Features

1. Auth and roles: patient, doctor, admin
2. Doctor discovery with filtering and booking flow
3. Calendar-like slot selection and appointment booking
4. Appointment lifecycle: booked, completed, cancelled, no_show
5. Video/audio/text consultation flow with realtime signaling
6. Prescription creation and PDF export
7. Patient + family-member context separation
8. Medical document uploads and downloads with access checks
9. Azure-only uploads with local-to-Azure migration script
10. Multi-language translation selector
11. Ollama-powered AI Copilot workspace with safety-first draft tools
12. In-call chat translation support

## Quick Start

### Option A: One-command startup (Windows)

Run:

`run-app.bat`

### Option B: Manual startup

1. Copy env file: `copy .env.example .env`
2. Start database (if using Docker): `docker compose up -d`
3. Install dependencies: `npm install`
4. Run migrations: `npm run db:migrate`
5. Seed sample data: `npm run db:seed`
6. Start app: `npm run dev`

## Seeded Accounts

1. Patient: `patient1@example.com` / `Password123!`
2. Doctor: `doctor1@example.com` / `Password123!`
3. Admin: `admin@example.com` / `Password123!`

## Environment Variables

Defined in `.env.example`:

1. `PORT`
2. `NODE_ENV`
3. `APP_BASE_URL`
4. `JWT_SECRET`
5. `JWT_EXPIRES_IN`
6. `DATABASE_URL`
7. `AZURE_STORAGE_CONNECTION_STRING`
8. `AZURE_STORAGE_CONTAINER`
9. `AZURE_STORAGE_PUBLIC_BASE_URL`
10. `AZURE_UPLOADS_MODE`
11. `ADMIN_INVITE_CODE`
12. `OLLAMA_BASE_URL`
13. `OLLAMA_MODEL`
14. `OLLAMA_TIMEOUT_MS`

## NPM Scripts

1. `npm run dev`: start with nodemon
2. `npm start`: start app with node
3. `npm run frontend:dev`: run Vite dev server
4. `npm run frontend:build`: build SPA bundle
5. `npm run prisma:generate`: generate Prisma client
6. `npm run db:migrate`: run Prisma migrate dev
7. `npm run db:deploy`: run Prisma migrate deploy
8. `npm run db:seed`: execute seed script
9. `npm test`: run tests
10. `npm run ci`: lint + test + Prisma generate + frontend build

## High-level Architecture

1. `app.js`: minimal entrypoint wrapper for app/server composition
2. `server/create-app.js`: middleware stack, API mount, SPA/static serving
3. `server/create-server.js`: HTTP + Socket.IO server creation
4. `routes/*`: route definitions by domain
5. `controllers/*`: request handlers and business flow orchestration
6. `models/db.js`: Prisma client instance
7. `models/schemas/*`: Zod validation schemas
8. `services/*`: realtime, storage, presence, structured logger
9. `middleware/*`: auth, API mode, request context, error handling
10. `frontend/*`: React + Vite SPA source

## Main Route Groups

1. `/api/*`: backward-compatible API base
2. `/api/v1/*`: versioned API base for contract stability
3. `/api/health/live`: liveness probe
4. `/api/health/ready`: readiness probe (database check)

## API Contract Standard

1. New integrations should prefer `/api/v1/*`.
2. API errors return:
   - `error`
   - `code`
   - `requestId`
   - `timestamp`
3. OpenAPI baseline: `docs/openapi.yaml`.

## Observability Standard

1. Every request includes `X-Request-Id`.
2. Server request logs are structured JSON.
3. Health probes are available for uptime/dependency monitoring.

## Testing

Run:

`npm test`

Current tests validate session behavior, SPA fallback, auth protection, versioned API compatibility, and health endpoints.

## CI Quality Gates

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

1. Dependency install
2. Lint
3. Test
4. Prisma client generation
5. Frontend build

## Deployment Notes

For Azure deployment guidance, use `azure-deploy.md`.
