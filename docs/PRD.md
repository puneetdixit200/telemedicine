# Product Requirements Document (PRD)

## 1. Document Control

- Product: Sanctuary Health (also referenced in code/docs as Telemedicine Rural App and The Guided Journey)
- Version: 1.2
- Date: 2026-04-05
- Status: Draft for product alignment and delivery planning
- Platform: Web app (Express backend + React SPA frontend)

## 2. Product Summary

Sanctuary Health is a role-based telemedicine platform designed for rural and mixed-connectivity environments. The product enables patients to discover doctors, book appointments, join consultations, receive prescriptions, manage family health records, share time-bound QR profile links, and interact with AI-assisted draft workflows. Doctors can manage availability, run consultations, issue prescriptions, access complete patient records by patient ID or QR token, and review analytics. Help workers can support delegated patient care through explicit consent controls.

Recent roadmap delivery adds no-show recovery workflows, refill reminder scheduling, doctor availability reason messaging, weekly doctor feedback digest metrics, first-time patient and helper onboarding aids, printable patient health card support, prep checklists near consultation time, and mobile wrapper readiness via Capacitor scaffolding.

The system prioritizes:

- Simple guided flows over dense dashboards
- Mobile-first, low-bandwidth resilience
- Safety-first AI assistance (drafts only)
- Strict role-based access and consent-bound delegation

## 3. Problem Statement

Rural users face barriers to timely care due to distance, low connectivity, and digital literacy differences. Existing telemedicine products are often too complex, assume stable bandwidth, and do not support delegated care workflows (for family members and community helpers) with auditable consent.

This product solves for:

- Fast access to consultation booking and follow-up
- Safe digital consultation and prescription handoff
- Family-centered records and delegated support
- Low-connectivity continuity with retries and reduced data modes

## 4. Goals and Non-Goals

### 4.1 Goals

- Provide end-to-end telemedicine flow from login to consultation to prescription.
- Support four roles with clear permissions: patient, doctor, help_worker, admin.
- Ensure consultations remain usable in weak networks via mode controls and data-saver patterns.
- Enable delegated care support with explicit patient consent and audit history.
- Offer AI draft tooling for clinical and support workflows without autonomous decisioning.

### 4.2 Non-Goals (Current Scope)

- Insurance billing and claims workflows
- Payment processing
- EHR interoperability integrations (FHIR/HL7)
- Native mobile apps (iOS/Android)
- Autonomous diagnosis or treatment recommendation without human review

## 5. Target Users and Personas

- Patient: Books consultations, uploads records, tracks prescriptions, manages family profiles.
- Doctor: Manages availability, handles consultations, writes prescriptions, monitors practice metrics.
- Help Worker: Supports delegated patients based on active consent (appointments, reminders, records as scoped).
- Admin: Oversees operations, impact metrics, readiness and system-level workflows.

## 6. Core User Journeys

### 6.1 Patient Journey

1. Register/login
2. Land on guided dashboard
3. Book using 4-step wizard (person -> symptom -> doctor -> slot/mode)
4. Add pre-consult notes and upload documents
5. Join call (video/audio/text as network allows)
6. Receive prescription and handoff code
7. Track records in medicine cabinet and workspace
8. Receive reminders and care-follow-up guidance as needed
9. Generate and share profile QR/token link with doctor for fast context access

### 6.2 Doctor Journey

1. Login and view doctor dashboard
2. Set online/offline call state
3. Bulk manage future slots
4. Open appointments and consultation details
5. Join call and review patient history
6. Create or update prescription and close appointment
7. Review analytics and trends
8. Open doctor patient-access console and retrieve full records by patient ID or QR token

### 6.3 Help Worker Journey

1. Login with helper account
2. View delegated visibility from active patient consent
3. Track active consents and reminder timelines
4. Support appointment and records follow-through within scope
5. Coordinate updates with patients and clinicians inside consent boundaries

## 7. Functional Requirements

### Epic A: Authentication and Access Control

- FR-A1: Support login, registration, and logout with cookie-based JWT auth.
- FR-A2: Support roles: patient, doctor, admin, help_worker.
- FR-A3: Enforce route and API permissions by role.
- FR-A4: Keep backward-compatible API routes under /api and versioned alias under /api/v1.

Acceptance:

- Unauthenticated protected requests return unauthorized response or redirect behavior per request mode.
- Unauthorized role access returns forbidden.

### Epic B: Guided Dashboard and Navigation

- FR-B1: Provide role-aware dashboard action cards.
- FR-B2: Show mobile-first navigation including patient/doctor/helper role variants.
- FR-B3: Include profile menu with network indicator, data saver toggle, and language control.
- FR-B4: Provide first-time patient tour and dismissible helper onboarding checklist with local persistence.

Acceptance:

- Dashboard actions adapt by role.
- Mobile navigation remains functional across key routes.
- Onboarding/tour cards can be dismissed and do not reappear unless reset.

### Epic C: Doctor Discovery and Booking

- FR-C1: List doctors with specialization/language/online filters.
- FR-C2: Show doctor detail with slots and recent ratings.
- FR-C3: Provide 4-step booking wizard for patients.
- FR-C4: Allow booking for self or family member.
- FR-C5: Allow consultation mode selection: video, audio, text.
- FR-C6: Provide booking mode recommendation based on live connectivity context with manual override.
- FR-C7: Support re-book shortcuts with prefilled doctor and source appointment context.

Acceptance:

- Booking creates appointment only against available slot.
- Family member booking is validated against owner patient.
- Re-book shortcut deep links prefill booking form data and can jump directly to scheduling.

### Epic D: Appointment Lifecycle and Detail

- FR-D1: Show upcoming and past appointments.
- FR-D2: Allow pre-consult notes update by patient.
- FR-D3: Allow cancel and end actions with status transitions.
- FR-D4: Show presence-aware call readiness state.
- FR-D5: Allow patient review submission after completion.
- FR-D6: Allow doctor/admin to mark no-show and auto-draft async follow-up message.
- FR-D7: Expose preparation checklist in a T-30 window and show re-book shortcut for closed/no-show appointments.

Acceptance:

- Appointment state transitions are enforced server-side.
- Detail page reflects role-specific actions and history.
- No-show follow-up drafting is graceful when optional async messaging tables are unavailable.

### Epic E: Real-Time Consultation

- FR-E1: Create/join call sessions for booked appointments only.
- FR-E2: Provide WebRTC signaling via Socket.IO.
- FR-E3: Include in-call chat fallback.
- FR-E4: Include mode controls (video/audio/text), mute, camera, quality preference.
- FR-E5: Support automatic downgrade guidance under weak network conditions.

Acceptance:

- Users not linked to appointment cannot join room/signaling.
- Calls are blocked for closed appointments.

### Epic F: Prescription and Medicine Handoff

- FR-F1: Allow assigned doctor to create/update prescription for booked appointment.
- FR-F2: Auto-complete appointment on prescription save.
- FR-F3: Generate and download PDF prescription.
- FR-F4: Provide handoff code and pharmacy metadata.
- FR-F5: Provide patient medicine cabinet view.
- FR-F6: Embed handoff QR in generated prescription PDF when handoff code is available.
- FR-F7: Schedule refill reminder workflow after prescription save when follow-up date supports a reminder window.

Acceptance:

- Non-assigned users cannot edit prescription.
- Patient and doctor can access prescription by appointment ACL.
- Refill reminders use ReminderJob pipeline and fail gracefully if reminder tables are not available.

### Epic G: Documents and Health Records

- FR-G1: Allow patient uploads for self/family with 10MB limit.
- FR-G2: Bind document access to ownership, appointment ACL, and doctor contextual access rules.
- FR-G3: Support Azure storage mode and local fallback download path.
- FR-G4: Allow patient to generate time-bound profile QR token and share link for doctor access.
- FR-G5: Allow doctor/admin to retrieve full patient details by patient ID or shared token.

Acceptance:

- Unauthorized download attempts are denied.
- Appointment-linked uploads honor appointment family context rules.
- Expired or revoked patient access tokens are denied.
- Patient full-details access endpoints are restricted to doctor/admin roles.

### Epic H: Patient Workspace and Family Profiles

- FR-H1: Allow patient profile and health profile edits.
- FR-H2: Create/update family members.
- FR-H3: Show completed consultation timeline and document actions.
- FR-H4: Provide printable patient health card summary view.

Acceptance:

- Family member operations restricted to owning patient.
- Print output includes core demographic and longitudinal patient context.

### Epic I: Reminders

- FR-I1: Auto-schedule reminder jobs for eligible booked appointments (24h and 30m windows).
- FR-I2: Support doctor/admin dispatch of due reminders.
- FR-I3: Provide role-appropriate reminder timeline views.
- FR-I4: Schedule refill alerts from prescription follow-up dates using prescription_refill_3d template behavior.

Acceptance:

- Reminder status transitions tracked (scheduled, sent, failed, skipped).
- Missing reminder tables fail gracefully with clear unsupported messaging.
- Refill reminder payload includes diagnosis/follow-up guidance and optional handoff code.

### Epic J: Care Support and Consent

- FR-J1: Allow patients to register helpers.
- FR-J2: Allow patients to grant scoped consent (appointment, records, all).
- FR-J3: Maintain consent audit trail with active/revoked state.
- FR-J4: Restrict helper visibility to active delegated scope.

Acceptance:

- Helper access is denied without active linked consent.
- Consent actions are auditable with timestamps and actor IDs.

### Epic K: Medical Store, Lab Tests, and In-App PDF Preview

- FR-K1: Support pharmacy orders linked to prescription/appointment context with status tracking (placed, processing, ready, delivered, cancelled).
- FR-K2: Support lab test catalog and lab order workflow with status tracking (requested, sample collected, processing, report ready, completed, cancelled).
- FR-K3: Allow doctors/admins to link PDF lab reports to lab orders.
- FR-K4: Provide role-aware visibility for pharmacy and lab records across patient, doctor, admin, and consent-scoped helper users.
- FR-K5: Provide in-app PDF preview route so users can view prescription/report PDFs without mandatory download.

Acceptance:

- Pharmacy and lab APIs are auth-protected and enforce ownership/assignment ACL.
- PDF preview works for prescription PDFs and uploaded PDF reports in role-appropriate pages.
- Non-PDF files continue to use download behavior.

### Epic L: AI Copilot

- FR-L1: Provide AI context endpoint with appointments/documents/delegated context.
- FR-L2: Provide draft tools for note drafting, triage assistance, and document assistant in current UI.
- FR-L3: Support additional AI endpoints for summary, medication simplification, reminders, referral drafting, guidance, and translation.
- FR-L4: Persist offline AI drafts locally and allow retry.
- FR-L5: Mark outputs as drafts requiring human review.
- FR-L6: Generate one-paragraph consultation referral summary draft including complaint, history, tried treatment, reason, and urgency.

Acceptance:

- AI endpoints are auth-protected and rate-limited.
- If Ollama is unavailable, fallback behavior and explicit status are shown.

### Epic M: Localization and Rural Support

- FR-M1: Provide language selector integration via inline translation widget.
- FR-M2: Preserve icon tokens and sanitize language options.
- FR-M3: Show connectivity banner and data saver toggle.
- FR-M4: Persist data saver state in local storage.

Acceptance:

- Language controls are available from profile menu.
- Data saver state survives refresh and affects UX class toggles.

### Epic N: Operations and Impact Enhancements

- FR-N1: Allow doctors to publish offline availability reason while call state is disabled.
- FR-N2: Provide doctor weekly feedback digest (average rating, review count, top keywords, re-book rate, completed consults).
- FR-N3: Expand admin impact dashboard with no-show recovery rate, refill alerts next 7 days, review coverage, and active helper links.

Acceptance:

- Offline reason is persisted only for offline state and cleared when doctor returns online.
- Digest and impact KPIs return in analytics responses without breaking legacy payload consumers.

## 8. Non-Functional Requirements

- NFR-1 Security: Helmet CSP, httpOnly auth cookie, role checks, endpoint access control.
- NFR-2 Privacy: Redaction patterns in AI processing and minimized exposure of sensitive data in generated outputs.
- NFR-3 Reliability: Health endpoints for live and ready status with DB dependency checks and timeout policy.
- NFR-4 Performance: SPA asset caching with immutable hashed assets and no-store index behavior.
- NFR-5 Mobile usability: Touch-friendly controls and route-safe bottom navigation patterns.
- NFR-6 Resilience: Offline-friendly API page cache pattern and AI offline draft retry queue.
- NFR-7 Observability: Structured request logging with request IDs.
- NFR-8 Compatibility: Maintain /api and /api/v1 parity for core route groups.

## 9. Data Model Summary

Primary entities:

- User, PatientProfile, DoctorProfile
- FamilyMember, Slot, Appointment, CallSession
- Prescription, Document, DoctorReview
- PharmacyOrder
- LabTestCatalog, LabOrder, LabOrderItem
- ReminderJob
- CareSupportLink, ConsentAudit
- PatientAccessToken
- ConsultationVital, ChronicCarePlan, CarePlanCheckIn
- ExternalConsultThread, ExternalConsultMessage
- ConsultationVoiceNote, SecondOpinionRequest, SecondOpinionAudit

Key domain enums include role, appointment status, consultation mode, reminder channel/status, and delegation scope.

## 10. Integrations and Dependencies

- PostgreSQL + Prisma ORM
- Socket.IO for signaling and in-call chat
- Azure Blob Storage for document storage (with configurable local fallback)
- Ollama local model runtime for AI generation
- GTranslate widget for language selection UI

## 11. Success Metrics (KPIs)

### 11.1 Product KPIs

- Appointment booking conversion rate from dashboard and doctor detail
- Appointment completion rate
- No-show rate
- Re-book rate after completed consultation
- Family profile adoption rate (patients with at least one family member)
- Help-worker delegation adoption rate (patients with active helper consent)

### 11.2 Operational KPIs

- Readiness uptime and DB health latency
- Reminder dispatch success/failure rate
- AI request success rate vs fallback/queued drafts
- No-show recovery rate and refill alert lead-time coverage
- Review coverage rate and active helper-link participation

## 12. Release Plan

### Phase 1: Stabilize Current Scope

- Complete route and role coverage testing
- Validate mobile UX and low-bandwidth behavior on real devices
- Close known UX regressions around profile/language/nav interactions

### Phase 2: Hardening and Scale

- Expand automated E2E tests for critical journeys
- Add more observability dashboards and alert thresholds
- Strengthen AI output evaluation and safety checks per feature

### Phase 3: Product Growth

- Localization depth beyond selector-level translation
- Notification channel expansion and delivery analytics
- Advanced care pathway automation with strict human approval

## 13. Risks and Mitigations

- Risk: Connectivity instability impacts call quality.
  - Mitigation: mode switching, quality controls, chat fallback, reconnect guidance.
- Risk: Delegation misuse or over-broad access.
  - Mitigation: scoped consent model, active toggle, audit history.
- Risk: AI hallucination in clinical context.
  - Mitigation: draft-only policy, safety prompts, explicit human review requirement.
- Risk: Environment misconfiguration (Ollama/Azure/DB).
  - Mitigation: readiness checks, unsupported-state messaging, fallback pathways.

## 14. Open Questions

- Final product naming and branding consistency across surfaces (Sanctuary Health vs Guided Journey vs Telemedicine Rural App).
- Regional compliance baseline and policy requirements for medical data handling.
- SMS/WhatsApp production provider integration strategy for reminder delivery.
- Long-term decision on local file mode vs strict Azure-only in production.

## 15. Definition of Done

A release is done when:

- Core role journeys (patient, doctor, help_worker, admin) pass smoke and regression QA.
- CI gates pass (lint, tests, prisma generate, frontend build).
- Health probes report live/ready in deployed environment.
- Critical flows succeed end-to-end:
  - Login/register/session
  - Doctor discovery and booking
  - Appointment detail and actions
  - No-show mark + async follow-up draft
  - T-30 prep checklist and re-book deep-link flow
  - Call join/end
  - Prescription create/view/pdf
  - Prescription QR rendering and refill reminder scheduling
  - Pharmacy order and lab order workflows
  - In-app PDF preview for prescriptions and reports
  - Document upload/download ACL
  - Doctor patient access by ID and QR token
  - Doctor offline reason + weekly digest analytics
  - Admin impact outcomes KPI surfaces
  - First-time patient tour + helper onboarding persistence
  - Printable patient health card output
  - Reminder listing/dispatch
  - Consent management and helper-scoped visibility
  - AI Copilot context and primary tools including referral summary drafting

## 16. References

- README (system overview and startup)
- docs/openapi.yaml (contract baseline)
- prisma/schema.prisma (domain model)
- apps/frontend/src/App.jsx (route and UX implementation)
- apps/frontend/src/pages/DoctorPatientAccessPage.jsx (doctor patient lookup UX)
- apps/backend/server/create-app.js and apps/backend/routes/* (API wiring and runtime behavior)

## 17. Mobile Readiness

- Capacitor scaffold is included via root-level config and npm scripts.
- Documentation for sync/add/open workflow is provided in docs/CAPACITOR.md.
- Current scope is wrapper readiness for web assets, not full native feature parity.
