# QA Checklist Results

- Generated at: 2026-04-04T20:50:26.878Z
- Total: 55
- Passed: 55
- Failed: 0
- Duration: 0.50s

| ID | Area | Test | Method | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| A-1 | Authentication | Login/register/logout routes are defined | static | PASS | apps/backend/routes/auth.routes.js:8 POST /login route \| apps/backend/routes/auth.routes.js:11 POST /register route \| apps/backend/routes/auth.routes.js:12 POST /logout route |
| A-2 | Authentication | Role model includes patient/doctor/admin/help_worker | static | PASS | prisma/schema.prisma:10 Role enum \| prisma/schema.prisma:11 patient role \| prisma/schema.prisma:12 doctor role \| prisma/schema.prisma:13 admin role \| prisma/schema.prisma:14 help_worker role |
| A-3 | Authentication | Unauthorized API request is blocked | runtime | PASS | /api/appointments => 401 code=UNAUTHORIZED |
| A-4 | Authentication | /api and /api/v1 compatibility exists for session | runtime | PASS | /api/session=200, /api/v1/session=200 |
| B-1 | Dashboard | Protected shell routes include dashboard/book/appointments/ai-copilot | static | PASS | apps/frontend/src/App.jsx:341 dashboard route \| apps/frontend/src/App.jsx:342 book route \| apps/frontend/src/App.jsx:350 appointments route \| apps/frontend/src/App.jsx:357 ai-copilot route |
| B-2 | Dashboard | Connectivity banner and data saver toggle are present | static | PASS | apps/frontend/src/App.jsx:545 connectivity banner class \| apps/frontend/src/App.jsx:576 data saver label \| apps/frontend/src/App.jsx:196 data saver toggle handler |
| B-3 | Dashboard | Profile language picker is available | static | PASS | apps/frontend/src/App.jsx:936 language picker id \| apps/frontend/src/App.jsx:933 language trigger class |
| C-1 | Booking | Doctor directory supports specialization/language/online filters | static | PASS | apps/backend/controllers/doctors.controller.js:97 specialization filter logic \| apps/backend/controllers/doctors.controller.js:97 language filter logic \| apps/backend/controllers/doctors.controller.js:3 online filter logic |
| C-2 | Booking | Booking wizard exposes 4 guided steps | static | PASS | apps/frontend/src/App.jsx:2602 wizard step 1 \| apps/frontend/src/App.jsx:2609 wizard step 2 \| apps/frontend/src/App.jsx:2616 wizard step 3 \| apps/frontend/src/App.jsx:2621 wizard step 4 |
| C-3 | Booking | Booking API requires patient role | static | PASS | apps/backend/routes/appointments.routes.js:12 patient role gate on book |
| C-4 | Booking | Slot race guard prevents booking unavailable slot | static | PASS | apps/backend/controllers/appointments.controller.js:462 transactional slot update \| apps/backend/controllers/appointments.controller.js:463 availability condition in updateMany \| apps/backend/controllers/appointments.controller.js:466 stale slot conflict guard |
| C-5 | Booking | Family-member booking validates ownership | static | PASS | apps/backend/controllers/appointments.controller.js:148 family member payload usage \| apps/backend/controllers/appointments.controller.js:454 owner check |
| D-1 | Appointments | Lifecycle routes include prep/review/cancel/end | static | PASS | apps/backend/routes/appointments.routes.js:13 prep route \| apps/backend/routes/appointments.routes.js:14 review route \| apps/backend/routes/appointments.routes.js:15 cancel route \| apps/backend/routes/appointments.routes.js:16 end route |
| D-2 | Appointments | Pre-consult updates blocked for closed appointments | static | PASS | apps/backend/controllers/appointments.controller.js:529 status gate in pre-consult update |
| D-3 | Appointments | Review submission only allowed after completion | static | PASS | apps/backend/controllers/appointments.controller.js:609 completed-only review check |
| D-4 | Appointments | Presence endpoint exists for call readiness | static | PASS | apps/backend/routes/appointments.routes.js:10 presence route |
| E-1 | Calls | Call join/end routes are auth protected | static | PASS | apps/backend/routes/calls.routes.js:7 auth on call join \| apps/backend/routes/calls.routes.js:8 auth on call end |
| E-2 | Calls | Call access check binds user to appointment | static | PASS | apps/backend/controllers/calls.controller.js:16 appointment ACL check |
| E-3 | Calls | Closed appointments cannot start calls | static | PASS | apps/backend/controllers/calls.controller.js:62 booked status requirement |
| F-1 | Prescription | Prescription routes include view/upsert/pdf | static | PASS | apps/backend/routes/prescriptions.routes.js:7 view route \| apps/backend/routes/prescriptions.routes.js:8 doctor-only upsert route \| apps/backend/routes/prescriptions.routes.js:9 pdf route |
| F-2 | Prescription | Saving prescription auto-completes appointment | static | PASS | apps/backend/controllers/prescriptions.controller.js:222 appointment completion write |
| F-3 | Prescription | Handoff code generation exists | static | PASS | apps/backend/controllers/prescriptions.controller.js:79 handoff code helper \| apps/backend/controllers/prescriptions.controller.js:86 handoff code persistence |
| G-1 | Documents | Upload size capped at 10MB | static | PASS | apps/backend/routes/documents.routes.js:7 multer 10MB limit |
| G-2 | Documents | Document access ACL checks owner and appointment scope | static | PASS | apps/backend/controllers/documents.controller.js:23 owner ACL shortcut \| apps/backend/controllers/documents.controller.js:27 appointment ACL \| apps/backend/controllers/documents.controller.js:52 upload role gate |
| G-3 | Documents | Local download fallback route is available | static | PASS | apps/backend/routes/documents.routes.js:12 local blob route |
| K-1 | Pharmacy and Labs | Prisma schema includes pharmacy and lab order models | static | PASS | prisma/schema.prisma:380 PharmacyOrder model \| prisma/schema.prisma:430 LabOrder model \| prisma/schema.prisma:411 LabTestCatalog model |
| K-2 | Pharmacy and Labs | API route registry mounts pharmacy and labs route groups | static | PASS | apps/backend/routes/index.js:36 pharmacy routes mounted \| apps/backend/routes/index.js:37 labs routes mounted |
| K-3 | Pharmacy and Labs | Pharmacy routes include list/create/detail/status update | static | PASS | apps/backend/routes/pharmacy.routes.js:7 list route \| apps/backend/routes/pharmacy.routes.js:8 create route \| apps/backend/routes/pharmacy.routes.js:9 detail route \| apps/backend/routes/pharmacy.routes.js:10 status route |
| K-4 | Pharmacy and Labs | Lab routes include catalog/orders/status/report endpoints | static | PASS | apps/backend/routes/labs.routes.js:7 catalog list route \| apps/backend/routes/labs.routes.js:8 catalog create route \| apps/backend/routes/labs.routes.js:10 orders list route \| apps/backend/routes/labs.routes.js:13 status route \| apps/backend/routes/labs.routes.js:14 report route |
| K-5 | Pharmacy and Labs | Document PDF preview route is available | static | PASS | apps/backend/routes/documents.routes.js:14 preview route \| apps/backend/controllers/documents.controller.js:162 preview handler |
| K-6 | Pharmacy and Labs | Frontend includes pharmacy, lab, and PDF preview pages | static | PASS | apps/frontend/src/App.jsx:353 pharmacy page route \| apps/frontend/src/App.jsx:354 labs page route \| apps/frontend/src/App.jsx:355 pdf preview route |
| K-7 | Pharmacy and Labs | Prescription and document links use preview-first behavior | static | PASS | apps/frontend/src/App.jsx:119 preview helper \| apps/frontend/src/App.jsx:4858 document preview link \| apps/backend/controllers/prescriptions.controller.js:254 download toggle support |
| K-8 | Pharmacy and Labs | Pharmacy and lab order APIs are auth-protected | runtime | PASS | /api/pharmacy/orders=401, /api/labs/orders=401 |
| H-1 | Workspace | Patient workspace and family APIs exist | static | PASS | apps/backend/routes/patients.routes.js:9 workspace route \| apps/backend/routes/patients.routes.js:10 family create route \| apps/backend/routes/patients.routes.js:11 family update route |
| H-2 | Workspace | Family member updates enforce owner constraint | static | PASS | apps/backend/controllers/patients.controller.js:131 owner check in family update |
| I-1 | Reminders | Reminder scheduler creates 24h and 30m jobs | static | PASS | apps/backend/services/reminder.service.js:88 24h reminder offset \| apps/backend/services/reminder.service.js:89 30m reminder offset \| apps/backend/services/reminder.service.js:104 scheduled status writes |
| I-2 | Reminders | Reminder dispatch route is doctor/admin only | static | PASS | apps/backend/routes/reminders.routes.js:8 dispatch role gate |
| J-1 | Support and Consent | Helper link, consent grant, and toggle routes exist | static | PASS | apps/backend/routes/support.routes.js:8 helper create route \| apps/backend/routes/support.routes.js:9 helper toggle route \| apps/backend/routes/support.routes.js:7 consent route |
| J-2 | Support and Consent | Revocation trail updates active consents and revokedAt | static | PASS | apps/backend/controllers/support.controller.js:286 bulk revoke existing consents \| apps/backend/controllers/support.controller.js:297 audit action for toggle |
| L-1 | AI | AI routes are auth-protected and rate-limited | static | PASS | apps/backend/routes/ai.routes.js:19 auth middleware on AI routes \| apps/backend/routes/ai.routes.js:20 rate limiter middleware |
| L-2 | AI | AI context endpoint blocks unauthenticated access | runtime | PASS | /api/ai/context => 401 code=UNAUTHORIZED |
| L-3 | AI | AI responses expose fallbackUsed metadata | static | PASS | apps/backend/controllers/ai.controller.js:450 fallbackUsed metadata set |
| L-4 | AI | All AI endpoints mark outputs as requiresReview=true | static | PASS | apps/backend/controllers/ai.controller.js: no match for forbidden requiresReview false |
| L-5 | AI | UI labels outputs as Draft - requires human review | static | PASS | apps/frontend/src/App.jsx:6090 explicit draft label |
| L-6 | AI | Offline AI draft queue persists and retries | static | PASS | apps/frontend/src/App.jsx:20 offline storage key \| apps/frontend/src/App.jsx:6010 queue helper \| apps/frontend/src/App.jsx:6034 retry helper |
| M-1 | Localization | Language widget limits options to approved language codes | static | PASS | apps/frontend/src/TranslationService.jsx:3 language whitelist \| apps/frontend/src/TranslationService.jsx:60 dropdown sanitizer \| apps/frontend/src/TranslationService.jsx:87 unknown option removal |
| M-2 | Localization | Material icon tokens are protected from translation | static | PASS | apps/frontend/src/TranslationService.jsx:43 notranslate class application \| apps/frontend/src/TranslationService.jsx:47 icon token preservation |
| NFR-1 | Security and Reliability | Helmet CSP is enabled | static | PASS | apps/backend/server/create-app.js:57 helmet CSP configuration |
| NFR-2 | Security and Reliability | Request IDs are emitted in API responses and headers | runtime | PASS | /api/session requestId=b835c5c9-1079-484d-9ec2-23d56f6ee1dc header=b835c5c9-1079-484d-9ec2-23d56f6ee1dc |
| NFR-3 | Security and Reliability | Health probes are available | runtime | PASS | /api/health/live=200, /api/health/ready=200 |
| NFR-4 | Security and Reliability | SPA index no-store and assets immutable caching rules exist | static | PASS | apps/backend/server/create-app.js:111 index no-store header \| apps/backend/server/create-app.js:116 immutable asset cache directive |
| NFR-5 | Security and Reliability | API mode rewrites redirects/renders for JSON clients | static | PASS | apps/backend/middleware/api-mode.js:20 redirect rewrite hook \| apps/backend/middleware/api-mode.js:13 render rewrite hook |
| EDGE-1 | Edge Cases | Unknown API route returns structured NOT_FOUND payload | runtime | PASS | /api/no-such-route => 404 code=NOT_FOUND |
| EDGE-2 | Edge Cases | Global rate limit middleware is configured | static | PASS | apps/backend/server/create-app.js:87 global request limiter |
| EDGE-3 | Edge Cases | AI limiter returns explicit AI_RATE_LIMITED code | static | PASS | apps/backend/routes/ai.routes.js:15 AI limiter error code |
