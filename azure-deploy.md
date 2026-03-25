# Azure Deployment (App Service + Azure Database for PostgreSQL + Blob Storage)

## Resources

- Azure Database for PostgreSQL (Flexible Server)
- Azure Storage Account (Blob)
- Azure App Service (Linux, Node 20+)

## App Settings (Environment Variables)

Set these in App Service configuration:

- `NODE_ENV=production`
- `PORT=3000` (App Service sets this automatically; keep code reading `process.env.PORT`)
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=1d`
- `DATABASE_URL=postgresql://...` (from Postgres flexible server)
- `AZURE_STORAGE_CONNECTION_STRING=...`
- `AZURE_STORAGE_CONTAINER=patient-documents`
- `ADMIN_INVITE_CODE=...` (optional)

## Deployment steps (simple)

1. Create DB and run migrations:

- Run locally: `npm run db:deploy` pointing to Azure `DATABASE_URL`, OR
- Use GitHub Actions to run `prisma migrate deploy` in a job.

1. Upload code to App Service (GitHub Actions recommended).

1. Ensure HTTPS is enabled and "HTTPS Only" is ON.

## CI/CD idea (GitHub Actions)

- On push to main:
  - `npm ci`
  - `npm test`
  - `npm run prisma:generate`
  - `npm run db:deploy`
  - Deploy to App Service
