#!/bin/bash
# Azure App Service Linux startup script
# Set this as the Startup Command in Azure Portal → App Service → Configuration → General settings
set -e

echo "=== Sanctuary Health — Azure Startup ==="

# Generate Prisma client (in case postinstall didn't run)
echo "[1/3] Generating Prisma client..."
npx prisma generate

# Apply pending database migrations
echo "[2/3] Applying database migrations..."
npx prisma migrate deploy

# Build frontend (skip if dist/ already exists from CI/CD)
if [ ! -f "apps/frontend/dist/index.html" ]; then
  echo "[3/3] Building frontend..."
  npm run frontend:build
else
  echo "[3/3] Frontend build found, skipping..."
fi

echo "=== Starting server ==="
node app.js
