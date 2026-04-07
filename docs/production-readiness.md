# Production Readiness Checklist

## Critical blockers

- Secret rotation:
  - Local `.env` Azure storage connection string has been redacted.
  - Rotate the leaked Azure Storage key in Azure Portal immediately.
- Node version pinning:
  - `package.json` includes `engines.node`.
- Build + startup automation:
  - `npm start` now runs `prestart` automation in production.
  - `startup.sh` is available for Azure startup command.
- Startup command and migrations:
  - Azure workflow deploy step now sets startup command to `bash startup.sh`.
  - Startup script runs Prisma migrate deploy.
- WebSockets:
  - `web.config` enables WebSockets for Windows App Service.
  - Deploy workflow includes optional Azure CLI step to enforce WebSockets on App Service.
- APP_BASE_URL wildcard risk:
  - Socket.IO CORS no longer falls back to `*` in production.
  - Production now requires explicit `APP_BASE_URL` origin allowlist.

## Important fixes

- Cookie secure behavior:
  - Auth cookie `secure` already follows `NODE_ENV === 'production'`.
- CI/CD:
  - Deploy workflow exists and includes test/build/migrate/deploy.
- Ollama in App Service:
  - Production no longer defaults Ollama to localhost.
  - Leave `OLLAMA_BASE_URL` empty or set to a reachable external host.
- HTTPS enforcement:
  - App-level HTTPS redirect middleware is enabled in production.
  - Deploy workflow includes optional Azure CLI enforcement of HTTPS Only.
- Build artifacts in git:
  - `frontend/dist` is ignored in `.gitignore`.
- Ephemeral local uploads:
  - Production local document fallback is disabled unless `AZURE_UPLOADS_MODE=local-only` is explicitly set.

## Nice-to-have improvements

- Application Insights:
  - App bootstraps telemetry when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set.
  - `applicationinsights` dependency added.
- Prisma pooling:
  - Prisma connection URL is now auto-hardened with pool parameters if missing.
- Custom domain and SSL:
  - Must be configured in Azure (manual portal/DNS steps).
- Reminder scheduler:
  - Cron-style dispatcher can run with `ENABLE_REMINDER_CRON=true`.
  - Interval and batch size are configurable via env vars.

## Manual actions still required in Azure

- Rotate Azure Storage credentials and update App Service setting.
- Configure custom domain and managed certificate/SSL binding.
- Ensure App Service settings include:
  - `NODE_ENV=production`
  - `APP_BASE_URL=https://...`
  - `AZURE_STORAGE_CONNECTION_STRING=...`
  - `AZURE_UPLOADS_MODE=azure-only`
  - Optional telemetry and reminder settings.
