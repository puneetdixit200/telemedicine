# Telemedicine (Rural)

Node.js + Express + PostgreSQL + WebRTC (Socket.IO signaling) + Azure Blob Storage.

## Quickstart (local)

1. Copy env:

- `copy .env.example .env`

1. Start Postgres (Docker):

- `docker compose up -d`

1. Install deps:

- `npm install`

1. Migrate + seed:

- `npm run db:migrate`
- `npm run db:seed`

1. Run:

- `npm run dev`

Seeded users:

- Patient: `patient1@example.com` / `Password123!`
- Doctor: `doctor1@example.com` / `Password123!`
- Admin: `admin@example.com` / `Password123!`

## Azure deployment

See `docs/azure-deploy.md`.
