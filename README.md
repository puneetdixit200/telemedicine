# Telemedicine Rural App

Production-style telemedicine web app built with Express, Prisma, PostgreSQL, Socket.IO, EJS, and Azure Blob Storage.

## Overview

This app supports patient, doctor, and admin roles with appointment booking, doctor slot management, consultation context, prescriptions, document uploads, and role-based authorization.

## Tech Stack

1. Backend: Node.js, Express (CommonJS)
2. Database: PostgreSQL with Prisma ORM
3. Views: EJS server-rendered pages
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
5. Two appointment sections: upcoming and done
6. Video/audio/text consultation flow with realtime signaling
7. Prescription creation and PDF export
8. Patient + family-member context separation
9. Medical document uploads and downloads with access checks
10. Azure-only uploads with local-to-Azure migration script
11. Multi-language translation selector

## Quick Start

### Option A: One-command startup (Windows)

Run:

`run-app.bat`

This does:

1. Creates `.env` from `.env.example` if needed
2. Installs dependencies if `node_modules` is missing
3. Starts PostgreSQL via Docker Compose (if Docker exists)
4. Runs Prisma generate + migrate deploy
5. Starts app on `http://localhost:3000`

### Option B: Manual startup

1. Copy env file:

`copy .env.example .env`

1. Start database (if using Docker):

`docker compose up -d`

1. Install dependencies:

`npm install`

1. Run database setup:

`npm run db:migrate`

1. Seed sample data:

`npm run db:seed`

1. Start app:

`npm run dev`

## Seeded Accounts

1. Patient: `patient1@example.com` / `Password123!`
2. Doctor: `doctor1@example.com` / `Password123!`
3. Admin: `admin@example.com` / `Password123!`

## Environment Variables

Defined in `.env.example`:

1. `PORT`: HTTP port
2. `NODE_ENV`: environment (`development`, `production`)
3. `APP_BASE_URL`: base URL used by app/realtime config
4. `JWT_SECRET`: JWT signing secret
5. `JWT_EXPIRES_IN`: token duration
6. `DATABASE_URL`: PostgreSQL connection string
7. `AZURE_STORAGE_CONNECTION_STRING`: Azure Blob connection string
8. `AZURE_STORAGE_CONTAINER`: Blob container name
9. `AZURE_STORAGE_PUBLIC_BASE_URL`: optional/public base URL helper
10. `AZURE_UPLOADS_MODE`: upload strategy (`azure-only`, `local-only`)
11. `ADMIN_INVITE_CODE`: optional code for admin registration

## Upload Behavior (Important)

Current default is Azure-only uploads.

1. New uploads: sent to Azure Blob Storage
2. If Azure config is invalid in Azure-only mode: upload is rejected
3. Existing local files migration command:

`npm run uploads:migrate:azure`

1. Migrate and delete local files when migration succeeds:

`npm run uploads:migrate:azure:clean`

## NPM Scripts

1. `npm run dev`: start with nodemon
2. `npm start`: start app with node
3. `npm run tw:build`: build Tailwind output CSS
4. `npm run tw:watch`: watch and rebuild Tailwind CSS
5. `npm run uploads:migrate:azure`: upload local `uploads` to Azure
6. `npm run uploads:migrate:azure:clean`: migrate + remove local files
7. `npm run prisma:generate`: generate Prisma client
8. `npm run db:migrate`: run Prisma migrate dev
9. `npm run db:deploy`: run Prisma migrate deploy
10. `npm run db:seed`: execute seed script
11. `npm test`: run test suite
12. `npm run test:watch`: run Jest in watch mode

## High-level Architecture

1. `app.js`: app bootstrap, middleware, CSP, route mounting, server creation
2. `routes/*`: route definitions by domain
3. `controllers/*`: request handlers, rendering, business flow orchestration
4. `models/db.js`: Prisma client instance
5. `models/schemas/*`: Zod validation schemas
6. `services/realtime.service.js`: Socket.IO setup and room signaling
7. `services/storage.service.js`: Azure/local storage abstraction and SAS generation
8. `services/presence.service.js`: online/presence helpers
9. `middleware/auth.js`: auth, role checks, token handling
10. `middleware/errors.js`: centralized error behavior
11. `views/*`: EJS templates
12. `public/*`: CSS, JS, and static assets

## Main Route Groups

1. `/auth`: login, register, logout
2. `/users`: profile, presence endpoints
3. `/doctors`: listing, doctor details, slots, analytics
4. `/patients`: health profile, workspace, family member management
5. `/appointments`: booking, details, pre-consultation, close/cancel
6. `/calls`: consultation pages and call session state
7. `/prescriptions`: prescription create/view + PDF
8. `/documents`: upload/download with ACL checks

## Data Model Summary

Prisma models in `prisma/schema.prisma`:

1. `User`
2. `PatientProfile`
3. `DoctorProfile`
4. `Slot`
5. `Appointment`
6. `FamilyMember`
7. `CallSession`
8. `Document`
9. `Prescription`

Enums include role, appointment status, slot status, consultation mode, and call session state.

## Frontend and Styling

1. Tailwind input file: `public/css/src/tailwind.input.css`
2. Tailwind output file: `public/css/tailwind.css`
3. Main custom style system: `public/css/styles.css`
4. Shared layout shell: `views/partials/layout.ejs`

## Translation

1. Language selector in navbar
2. Google Translate element integration in `public/js/translation.js`
3. CSP configuration in `app.js` includes required translate domains

## Project Structure

```text
.
|- app.js
|- package.json
|- docker-compose.yml
|- run-app.bat
|- azure-deploy.md
|- prisma/
|  |- schema.prisma
|  |- seed.js
|- controllers/
|- routes/
|- middleware/
|- models/
|  |- db.js
|  |- schemas/
|- services/
|  |- realtime.service.js
|  |- storage.service.js
|  |- presence.service.js
|- scripts/
|  |- migrate-local-uploads-to-azure.js
|- public/
|  |- css/
|  |- js/
|  |- img/
|- views/
|- tests/
|- uploads/
```

## Testing

Run:

`npm test`

Current tests validate core route health and auth redirect behavior.

## Deployment Notes

For Azure deployment guidance, use:

`azure-deploy.md`
