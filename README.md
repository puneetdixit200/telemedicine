# Telemedicine (Rural)

Node.js + Express + PostgreSQL + WebRTC (Socket.IO signaling) + Azure Blob Storage.

## Quickstart (local)

Fastest way (single file startup):

- Run `run-app.bat`

What it does automatically:

- Creates `.env` from `.env.example` (if missing)
- Installs npm dependencies (if needed)
- Starts PostgreSQL with Docker Compose (if Docker is available)
- Runs Prisma generate + migrate deploy
- Starts the app on `http://localhost:3000`

If Docker is not installed, keep PostgreSQL running manually and then run `run-app.bat`.

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

## Translation

- Use the language selector in the top navigation.
- Selecting a language applies full-page translation after reload.

## Azure deployment

See `docs/azure-deploy.md`.
