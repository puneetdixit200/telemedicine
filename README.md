# Telemedicine Rural App

Production-style telemedicine web app built with Express, Prisma, PostgreSQL, Socket.IO, a React SPA frontend, and Azure Blob Storage.

## Overview

This app supports patient, doctor, help_worker, and admin roles with appointment booking, doctor slot management, consultation context, prescriptions, document uploads, QR-based patient sharing, and role-based authorization.

It now also includes no-show follow-up drafting, refill reminder scheduling, doctor offline reason messaging, weekly doctor feedback digest metrics, admin impact outcome KPIs, first-time patient/helper onboarding aids, printable patient health card output, and booking rebook shortcuts.

## Tech Stack

1. Backend: Node.js, Express (CommonJS)
2. Database: PostgreSQL with Prisma ORM
3. Frontend: React SPA (Vite build served by Express)
4. Realtime: Socket.IO signaling for consultation flow
5. Storage: Azure Blob Storage (Azure-only upload mode supported)
6. Security: Helmet CSP, cookie auth (JWT), rate limiting
7. Styling: custom CSS system (frontend source styles)
8. Testing: Jest + Supertest

## Core Features

1. Auth and roles: patient, doctor, help_worker, admin
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
13. Medical store workflows with pharmacy order lifecycle tracking
14. Lab test catalog + order pipeline with report linking
15. In-app PDF preview for prescriptions and uploaded reports (no forced download)
16. Doctor Patient Access Console: view full patient details by patient ID or share token
17. Patient-side profile sharing via time-bound QR token links
18. AI Consultation Summary for Referral draft generation (doctor/admin, review-required)
19. Doctor/admin no-show action with async follow-up draft support
20. Refill reminder scheduling using prescription follow-up window and handoff guidance
21. Doctor offline status reason and weekly feedback digest in analytics
22. Admin impact outcomes carding (no-show recovery, refill alerts, review coverage, active helper links)
23. First-time patient tour and helper onboarding checklist persistence
24. Appointment prep checklist in T-30 window and one-tap rebook deep links
25. Printable patient health card view for shareable care context
26. Prescription PDF handoff QR embedding
27. Capacitor scaffold support for Android/iOS wrapper workflows

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
2. `npm start`: production start (runs prestart tasks in production: Prisma generate, migrate deploy, frontend build if missing)
3. `npm run start:azure`: run `startup.sh` explicitly (Linux App Service startup script)
4. `npm run frontend:dev`: run Vite dev server
5. `npm run frontend:build`: build SPA bundle
6. `npm run prisma:generate`: generate Prisma client
7. `npm run db:migrate`: run Prisma migrate dev
8. `npm run db:deploy`: run Prisma migrate deploy
9. `npm run db:seed`: execute seed script
10. `npm test`: run tests
11. `npm run ci`: lint + test + Prisma generate + frontend build
12. `npm run mobile:build`: build frontend web assets for mobile wrapper sync
13. `npm run mobile:sync`: build and sync Capacitor web assets
14. `npm run mobile:add:android`: add Android platform
15. `npm run mobile:add:ios`: add iOS platform
16. `npm run mobile:open:android`: open Android Studio project

## High-level Architecture

1. `app.js`: minimal entrypoint wrapper for app/server composition
2. `apps/backend/server/create-app.js`: middleware stack, API mount, SPA/static serving
3. `apps/backend/server/create-server.js`: HTTP + Socket.IO server creation
4. `apps/backend/routes/*`: route definitions by domain
5. `apps/backend/controllers/*`: request handlers and business flow orchestration
6. `apps/backend/models/db.js`: Prisma client instance
7. `apps/backend/models/schemas/*`: Zod validation schemas
8. `apps/backend/services/*`: realtime, storage, presence, structured logger
9. `apps/backend/middleware/*`: auth, API mode, request context, error handling
10. `apps/frontend/*`: React + Vite SPA source

## Main Route Groups

1. `/api/*`: backward-compatible API base
2. `/api/v1/*`: versioned API base for contract stability
3. `/api/health/live`: liveness probe
4. `/api/health/ready`: readiness probe (database check)
5. `/api/pharmacy/*`: pharmacy order APIs
6. `/api/labs/*`: lab catalog and order APIs
7. `/api/documents/:documentId/preview`: PDF preview endpoint
8. `/api/innovations/patients/:patientId/full-details`: doctor/admin full-detail lookup by patient ID
9. `/api/innovations/patients/access-by-token/:token`: doctor/admin full-detail lookup by shared QR token
10. `/api/ai/referral-summary`: AI one-paragraph referral draft endpoint
11. `/api/appointments/:appointmentId/no-show-followup`: mark no-show and draft follow-up workflow

## Key Frontend Routes

1. `/ai-copilot`: AI workspace with drafting, simplification, referral summary, and async reply tools
2. `/doctor/patient-access`: doctor/admin patient access page for ID/token lookup
3. `/innovations`: innovation workflows (triage, vitals, care plans, emergency, async follow-up)

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

For Azure production deployment and hardening guidance, use `azure-deploy.md`.

## Mobile Wrapper Notes

Capacitor wrapper configuration is tracked in `capacitor.config.ts`, and usage steps are documented in `docs/CAPACITOR.md`.

Current mobile scope is wrapper readiness for the existing web app bundle; native-only feature parity is out of scope.

## Product Documentation

- Product requirements and acceptance criteria: `docs/PRD.md`
- Production deployment hardening checklist: `docs/production-readiness.md`
