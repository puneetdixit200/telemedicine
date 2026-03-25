@echo off
setlocal

cd /d "%~dp0"

echo [telemedicine] Starting local stack...

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [telemedicine] Created .env from .env.example
  )
)

if not exist "node_modules" (
  echo [telemedicine] Installing npm dependencies...
  call npm install
  if errorlevel 1 goto :error
)

where docker >nul 2>nul
if %errorlevel%==0 (
  echo [telemedicine] Starting PostgreSQL via Docker Compose...
  docker compose up -d
  if errorlevel 1 goto :error
) else (
  echo [telemedicine] Docker CLI not found. Make sure PostgreSQL is already running.
)

echo [telemedicine] Applying database migrations...
call npx prisma generate
if errorlevel 1 goto :error

call npx prisma migrate deploy
if errorlevel 1 goto :error

echo [telemedicine] Launching app on http://localhost:3000
call npm start
goto :eof

:error
echo [telemedicine] Startup failed. Please check the log above.
exit /b 1
