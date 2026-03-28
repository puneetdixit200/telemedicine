# Design Specification: The Guided Journey Telemedicine App

## 1. Vision and Strategy

Core goal:

- Provide a simple, trustworthy, and non-intimidating telemedicine experience for rural users with mixed digital literacy.

Design principle:

- One task at a time. The interface guides users through clear actions instead of exposing a dense dashboard.

Implementation status:

- Implemented in the React app at `frontend/src/App.jsx` and `frontend/src/styles.css`.
- Experience includes a guided landing, guided dashboard, booking wizard, simplified consultation room, and medicine cabinet.

## 2. Visual Identity and Theme

Theme:

- The Guided Journey (icon-driven and minimalist).

Color system:

- Primary: Soft Teal (`#0D9488`)
- Secondary: Gentle Amber (`#F59E0B`)
- Background: Warm Off-White (`#F9FAFB`)
- Text: Deep Slate (`#1F2937`)

Typography:

- Primary font: Nunito
- Base size: 18px for readability on smaller screens

Component style:

- Rounded cards (`16px`) with subtle shadows
- Large CTA buttons with high contrast
- Literal icon cues on guided action cards

## 3. Information Architecture and Routes

Public routes:

- `/` -> `WelcomePage`
- `/auth/login` -> `LoginPage`
- `/auth/register` -> `RegisterPage`

Protected guided routes:

- `/dashboard` -> Guided dashboard hub
- `/book` -> Booking wizard
- `/medicines` -> Medicine cabinet

Protected supporting routes:

- `/appointments`
- `/appointments/impact`
- `/appointments/:appointmentId`
- `/calls/:appointmentId`
- `/prescriptions/:appointmentId`
- `/doctors`
- `/doctors/:doctorId`
- `/doctors/me/slots`
- `/doctors/me/analytics`
- `/profile`
- `/users/me`
- `/patients/me`
- `/patients/workspace`

Fallback behavior:

- Unknown route redirects to `/`.

## 4. Shared Authenticated Layout

Authenticated shell (`ProtectedLayout`) includes:

- Header with product identity
- User chip with role
- Simplified navigation actions

Navigation labels:

- Home
- Book Visit
- My Medicines
- Appointments
- Doctors
- Profile
- Role-specific links (doctor and patient)
- Logout

Layout rules:

- Mobile-first single column
- Maximum two-column content sections on desktop

## 5. Core Guided Flows

### A. Welcome and Trust Entry

Route:

- `/`

Purpose:

- High-trust entry point before authentication.

Main UI:

- Trust headline
- Three reassurance blocks
- Primary actions for login and account creation

Primary flow:

- Anonymous user chooses login/register.
- Authenticated user auto-redirects to `/dashboard`.

### B. Guided Dashboard Hub

Route:

- `/dashboard`

Purpose:

- Present four explicit next actions.

Action cards:

- See a Doctor Now
- Book a Visit
- My Medicines
- Talk to Someone

Behavior:

- "See a Doctor Now" attempts online doctors first, then falls back to any doctor.
- "Talk to Someone" opens support options.

### C. Booking Wizard

Route:

- `/book`

Audience:

- Patient-first guided booking flow.

Steps:

- Step 1: Who is this for (self or family member)
- Step 2: What is the problem (icon-based symptom pick)
- Step 3: Choose your doctor
- Step 4: Pick a time and consultation mode

Flow output:

- Final booking call submits to appointment booking API.
- User is redirected to the booked appointment route or appointments list.

Guidance feedback:

- Friendly status text (for example, "Finding caring doctors near you...")
- Progress chips and validated next-step progression

### D. Simplified Consultation Room

Route:

- `/calls/:appointmentId`

Purpose:

- Minimize accidental errors during live consultation.

Main UI:

- Large remote video stage
- Small local preview overlay
- Compact mode controls
- Mute and camera toggles
- Separated high-visibility End Call button
- Chat panel for low-network fallback communication

Safety note:

- Reconnection guidance is displayed to reduce user anxiety.

### E. Prescription Handoff Experience

Routes:

- `/medicines`
- `/prescriptions/:appointmentId`

Purpose:

- Make medicine retrieval and pharmacy handoff clear and fast.

Medicine cabinet:

- Prescription cards with doctor and diagnosis
- Large handoff code block
- Quick actions for view and PDF download

Prescription page:

- Readable prescription details
- Doctor-owner edit controls
- Prominent handoff code

## 6. Screen Inventory

1. Welcome/Landing

- Route: `/`
- Component: `WelcomePage`
- Status: Implemented

1. Guided Dashboard

- Route: `/dashboard`
- Component: `DashboardPage`
- Status: Implemented

1. Booking Wizard (4 steps)

- Route: `/book`
- Component: `BookingWizardPage`
- Status: Implemented

1. Simplified Call Interface

- Route: `/calls/:appointmentId`
- Component: `CallPage`
- Status: Implemented

1. Medicine Cabinet

- Route: `/medicines`
- Component: `MedicineCabinetPage`
- Status: Implemented

Additional active screens:

- Auth pages (`/auth/login`, `/auth/register`)
- Appointments module
- Doctors module
- Profile and health/workspace pages
- Prescription detail and PDF handoff

## 7. API Integration by Guided Screen

Welcome:

- Session check through `GET /api/session` at app bootstrap.

Guided dashboard:

- `GET /api/doctors?online=online`
- `GET /api/doctors` (fallback)

Booking wizard:

- `GET /api/doctors`
- `GET /api/doctors/:doctorId`
- `GET /api/patients/workspace`
- `POST /api/appointments/book`

Consultation room:

- `GET /api/calls/:appointmentId`
- `POST /api/calls/:appointmentId/end`
- Runtime dependencies: `/socket.io/socket.io.js`, `/public/js/call.js`

Medicine cabinet:

- Patient path: `GET /api/patients/workspace`, `GET /api/prescriptions/:appointmentId`
- Non-patient path: `GET /api/appointments`

Prescription detail:

- `GET /api/prescriptions/:appointmentId`
- `POST /api/prescriptions/:appointmentId`
- `GET /api/prescriptions/:appointmentId/pdf`

## 8. Interaction and Feedback Guidelines

Implemented interaction rules:

- Every major action has visible feedback states.
- Buttons provide hover and active press effects.
- Errors are inline and short.
- Success states are explicit.

Loading messaging:

- Uses helper text in key flows, not spinner-only behavior.

Examples:

- "Preparing your guided booking journey..."
- "Finding caring doctors near you..."
- "Organizing your medicine records..."

## 9. Rural and Low-Bandwidth UX Notes

Bandwidth strategy:

- Text-first and icon-first UI to avoid heavy assets in critical flows.
- Call runtime scripts loaded only on consultation route.

Readability strategy:

- Large base font size
- High-contrast controls
- Spacious touch targets

## 10. Journey Snapshots

Patient journey:

- `/` -> `/auth/login` -> `/dashboard` -> `/book` -> `/appointments/:appointmentId` -> `/calls/:appointmentId` -> `/medicines`

Doctor journey:

- `/` -> `/auth/login` -> `/dashboard` -> `/appointments` -> `/calls/:appointmentId` -> `/prescriptions/:appointmentId` -> `/doctors/me/analytics`

Admin journey:

- `/` -> `/auth/login` -> `/dashboard` -> `/profile`

## 11. Implementation References

Core files:

- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `frontend/src/lib/api.js`

Server integration notes:

- `app.js` serves SPA build and API routes.
- API-mode middleware normalizes redirect payloads for JSON-driven frontend navigation.
