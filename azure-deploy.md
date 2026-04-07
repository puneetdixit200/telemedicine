# Azure Deployment (Production Checklist)

## 1) Infrastructure

- Azure App Service (Linux, Node 20+)
- Azure Database for PostgreSQL (Flexible Server)
- Azure Storage Account (Blob)

## 2) Required App Settings

Set these in App Service Configuration:

- `NODE_ENV=production`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=1d`
- `DATABASE_URL=postgresql://...`
- `APP_BASE_URL=https://your-app.azurewebsites.net` (or custom domain)
- `AZURE_STORAGE_CONNECTION_STRING=...`
- `AZURE_STORAGE_CONTAINER=patient-documents`
- `AZURE_UPLOADS_MODE=azure-only`
- `ADMIN_INVITE_CODE=...` (optional)

Optional but recommended:

- `APPLICATIONINSIGHTS_CONNECTION_STRING=...`
- `ENABLE_REMINDER_CRON=true`
- `REMINDER_CRON_INTERVAL_MS=300000`
- `REMINDER_CRON_BATCH_LIMIT=30`
- `PRISMA_CONNECTION_LIMIT=10`
- `PRISMA_POOL_TIMEOUT=30`
- `PRISMA_SSL_MODE=require`

AI hosting note:

- Do not rely on local Ollama inside App Service.
- Either leave `OLLAMA_BASE_URL` empty (app uses safe fallback mode), or point it to a separately hosted Ollama-compatible endpoint.

## 3) App Service Runtime Settings

- HTTPS Only: enabled
- WebSockets: enabled
- Startup Command: `bash startup.sh`

The deploy workflow also includes an optional Azure CLI hardening step that enforces startup command, WebSockets, and HTTPS when `AZURE_CREDENTIALS`, `AZURE_RESOURCE_GROUP`, and `AZURE_WEBAPP_NAME` secrets are configured.

## 4) Deployment Flow

1. Push to `main`.
2. Workflow `.github/workflows/deploy.yml` runs:
  - install
  - Prisma generate
  - lint + tests
  - frontend build
  - `prisma migrate deploy`
  - deploy to App Service
3. Runtime startup runs `startup.sh`:
  - Prisma generate
  - Prisma migrate deploy
  - frontend build if missing
  - starts Node server

## 5) Security Actions To Complete

- Rotate any leaked Azure storage key immediately.
- Replace old leaked secrets in Azure App Settings and local `.env`.
- Keep `.env` out of git (already ignored).

## 6) Operational Notes

- Local disk on App Service is ephemeral; production document storage must use Azure Blob.
- Local `/documents/local/*` route is disabled in production unless `AZURE_UPLOADS_MODE=local-only` is explicitly set.
- WebSocket CORS is strict in production and requires `APP_BASE_URL` allowlist values.
