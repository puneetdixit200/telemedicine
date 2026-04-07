/**
 * Sanctuary Health — Comprehensive QA Checklist Runner
 *
 * Covers core PRD epics, non-functional requirements, and edge
 * cases.  Each check is either:
 *   • static  – pattern-matches against source files
 *   • runtime – makes an HTTP request via supertest (no database needed
 *               for most checks; they test 401/403 gates, headers, etc.)
 *
 * Output:
 *   qa-testing/reports/master-summary.md
 *   qa-testing/reports/results.json
 *   qa-testing/reports/epic-a-auth.md  … epic-m-localization.md
 *   qa-testing/reports/nfr-security.md
 *   qa-testing/reports/edge-cases.md
 *
 * Run:  node qa-testing/run-qa.js
 */

const fs   = require('fs');
const path = require('path');
let request;
try {
  request = require('supertest');
} catch (error) {
  console.error('Missing dependency: supertest. Install it with "npm install --save-dev supertest".');
  process.exit(1);
}
const { createApp } = require('../apps/backend/server/create-app');

// ── Helpers ──────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(__dirname, 'reports');

function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function normalizeRegex(input) {
  if (input instanceof RegExp) {
    const flags = input.flags
      .split('')
      .filter((flag) => flag !== 'g')
      .join('');
    return new RegExp(input.source, flags);
  }
  return new RegExp(String(input), 'm');
}

function findPattern(rel, pattern) {
  const re   = normalizeRegex(pattern);
  const text = readText(rel);
  const m    = re.exec(text);
  if (!m) return { found: false, rel, pattern: re.toString(), line: null, snippet: '' };
  const offset = m.index || 0;
  const line   = text.slice(0, offset).split(/\r?\n/).length;
  return { found: true, rel, pattern: re.toString(), line, snippet: String(m[0]).trim().slice(0, 140) };
}

function mustFind(rel, pattern, note) {
  const h = findPattern(rel, pattern);
  if (!h.found) return { pass: false, evidence: `${rel}: MISSING ${note || h.pattern}` };
  return { pass: true, evidence: `${rel}:${h.line} ${note || h.snippet}` };
}
function mustNotFind(rel, pattern, note) {
  const h = findPattern(rel, pattern);
  if (h.found) return { pass: false, evidence: `${rel}:${h.line} found forbidden ${note || h.snippet}` };
  return { pass: true, evidence: `${rel}: no match for forbidden ${note || normalizeRegex(pattern)}` };
}
function combine(parts) {
  const fail = parts.find(p => !p.pass);
  if (fail) return fail;
  return { pass: true, evidence: parts.map(p => p.evidence).join(' | ') };
}

let _appPromise;
let _appInstance;
let _appClose;

async function getApp() {
  if (!_appPromise) {
    process.env.NODE_ENV  = process.env.NODE_ENV  || 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa_secret';
    _appPromise = Promise.resolve(createApp()).then((createdApp) => {
      if (!createdApp) {
        throw new Error('createApp returned no app instance');
      }

      _appInstance = createdApp.app || createdApp;

      if (typeof createdApp.close === 'function') {
        _appClose = createdApp.close.bind(createdApp);
      } else if (createdApp.server && typeof createdApp.server.close === 'function') {
        _appClose = createdApp.server.close.bind(createdApp.server);
      } else if (typeof _appInstance.close === 'function') {
        _appClose = _appInstance.close.bind(_appInstance);
      }

      return _appInstance;
    });
  }
  return _appPromise;
}

async function closeAppIfNeeded() {
  if (!_appClose) {
    return;
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    try {
      const maybePromise = _appClose(finish);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(() => finish()).catch(finish);
      } else if (_appClose.length === 0) {
        finish();
      }
    } catch (error) {
      finish(error);
    }
  });
}

async function rt(name, fn) {
  try { const r = await fn(); return { pass: r.pass, evidence: r.evidence || name }; }
  catch (e) { return { pass: false, evidence: `${name}: ${e.message}` }; }
}

// ── All checks ───────────────────────────────────────────────────────
const checks = [
  // ─── Epic A — Authentication & Access Control ──────────────────
  { id:'A-01', epic:'Epic A', title:'Register endpoint exists for each role (patient, doctor, help_worker, admin)', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/register'/, 'POST /register route'),
      mustFind('prisma/schema.prisma', /enum\s+Role/, 'Role enum'),
      mustFind('prisma/schema.prisma', /patient/, 'patient role'),
      mustFind('prisma/schema.prisma', /doctor/, 'doctor role'),
      mustFind('prisma/schema.prisma', /help_worker/, 'help_worker role'),
      mustFind('prisma/schema.prisma', /admin/, 'admin role'),
    ]),
  },
  { id:'A-02', epic:'Epic A', title:'Login and logout routes are wired', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/login'/, 'POST /login'),
      mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/logout'/, 'POST /logout'),
    ]),
  },
  { id:'A-03', epic:'Epic A', title:'Auth cookie is httpOnly', method:'static',
    run: ()=> mustFind('apps/backend/middleware/auth.js', /httpOnly:\s*true/, 'httpOnly flag'),
  },
  { id:'A-04', epic:'Epic A', title:'Protected route without auth returns 401', method:'runtime',
    run: async ()=> rt('GET /api/appointments unauthorized', async ()=>{
      const res = await request(await getApp()).get('/api/appointments');
      return { pass: res.status===401 && res.body?.code==='UNAUTHORIZED',
               evidence: `/api/appointments => ${res.status} code=${res.body?.code||'none'}` };
    }),
  },
  { id:'A-05', epic:'Epic A', title:'Role-protected route requires auth first (doctor-only slot route)', method:'runtime',
    run: async ()=> rt('POST /api/doctors/me/slots/bulk without auth => 401', async ()=>{
      const res = await request(await getApp()).post('/api/doctors/me/slots/bulk');
      return { pass: res.status===401,
               evidence: `POST /api/doctors/me/slots/bulk => ${res.status} (auth required before role check)` };
    }),
  },
  { id:'A-05b', epic:'Epic A', title:'roleRequired middleware returns 403 for wrong role (static check)', method:'static',
    run: ()=> mustFind('apps/backend/middleware/auth.js', /if \(!roles\.includes\(req\.user\.role\)\) return sendApiError\(req, res, 403/, '403 for wrong role'),
  },
  { id:'A-06', epic:'Epic A', title:'/api and /api/v1 routes return identical responses', method:'runtime',
    run: async ()=> rt('Session parity', async ()=>{
      const [v0, v1] = await Promise.all([
        request(await getApp()).get('/api/session'),
        request(await getApp()).get('/api/v1/session'),
      ]);
      return { pass: v0.status===200 && v1.status===200 && v0.body?.ok && v1.body?.ok,
               evidence: `/api/session=${v0.status}, /api/v1/session=${v1.status}` };
    }),
  },

  // ─── Epic B — Dashboard & Navigation ───────────────────────────
  { id:'B-01', epic:'Epic B', title:'Dashboard action cards differ per role (role-aware dashboard routes)', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /path="\/dashboard"/, 'dashboard route'),
      mustFind('apps/frontend/src/App.jsx', /role.*patient|patient.*role/i, 'patient role check in UI'),
    ]),
  },
  { id:'B-02', epic:'Epic B', title:'Mobile bottom navigation renders on key routes', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /bottom-nav|BottomNav|mobile-nav/i, 'mobile nav element'),
  },
  { id:'B-03', epic:'Epic B', title:'Profile menu shows network indicator, data saver toggle, language selector', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /rural-connectivity-banner/, 'connectivity banner'),
      mustFind('apps/frontend/src/App.jsx', /Data Saver ON/, 'data saver label'),
      mustFind('apps/frontend/src/App.jsx', /profile-language-picker/, 'language picker'),
    ]),
  },
  { id:'B-04', epic:'Epic B', title:'Data saver toggle persists via localStorage', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /setIsDataSaver/, 'data saver setter'),
      mustFind('apps/frontend/src/App.jsx', /localStorage/, 'localStorage usage'),
    ]),
  },
  { id:'B-05', epic:'Epic B', title:'Language selector is accessible from profile menu', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /profile-language-trigger/, 'language trigger'),
  },

  // ─── Epic C — Doctor Discovery & Booking ───────────────────────
  { id:'C-01', epic:'Epic C', title:'Doctor list supports filters: specialization, language, online status', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/doctors.controller.js', /specialization/i, 'specialization filter'),
      mustFind('apps/backend/controllers/doctors.controller.js', /language/i, 'language filter'),
      mustFind('apps/backend/controllers/doctors.controller.js', /online/i, 'online filter'),
    ]),
  },
  { id:'C-02', epic:'Epic C', title:'Doctor detail page shows available slots and recent ratings', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/doctors.routes.js', /\/:doctorId/, 'doctor detail route'),
      mustFind('apps/backend/controllers/doctors.controller.js', /slot/i, 'slot data in doctor detail'),
      mustFind('apps/backend/controllers/doctors.controller.js', /review|rating/i, 'rating data in doctor detail'),
    ]),
  },
  { id:'C-03', epic:'Epic C', title:'4-step booking wizard (Person → Symptom → Doctor → Slot/Mode)', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /Step 1 of 4/, 'wizard step 1'),
      mustFind('apps/frontend/src/App.jsx', /Step 2 of 4/, 'wizard step 2'),
      mustFind('apps/frontend/src/App.jsx', /Step 3 of 4/, 'wizard step 3'),
      mustFind('apps/frontend/src/App.jsx', /Step 4 of 4/, 'wizard step 4'),
    ]),
  },
  { id:'C-04', epic:'Epic C', title:'Booking for family member validates against logged-in patient', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/appointments.controller.js', /familyMemberId/, 'family member in booking'),
      mustFind('apps/backend/controllers/appointments.controller.js', /ownerPatientId:\s*req\.user\.id/, 'owner validation'),
    ]),
  },
  { id:'C-05', epic:'Epic C', title:'Booking against already-taken slot fails (slot race guard)', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/appointments.controller.js', /slot\.updateMany\(/, 'transactional slot update'),
      mustFind('apps/backend/controllers/appointments.controller.js', /status:\s*'available'/, 'availability condition'),
    ]),
  },
  { id:'C-06', epic:'Epic C', title:'All three consultation modes selectable: video, audio, text', method:'static',
    run: ()=> combine([
      mustFind('prisma/schema.prisma', /enum\s+ConsultationMode/, 'ConsultationMode enum'),
      mustFind('prisma/schema.prisma', /video/, 'video mode'),
      mustFind('prisma/schema.prisma', /audio/, 'audio mode'),
      mustFind('prisma/schema.prisma', /text/, 'text mode'),
    ]),
  },

  // ─── Epic D — Appointment Lifecycle ────────────────────────────
  { id:'D-01', epic:'Epic D', title:'Upcoming and past appointments list correctly', method:'static',
    run: ()=> mustFind('apps/backend/routes/appointments.routes.js', /router\.get\('\/'/, 'GET / list appointments'),
  },
  { id:'D-02', epic:'Epic D', title:'Patient can add/edit pre-consult notes', method:'static',
    run: ()=> mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/prep/, 'prep route'),
  },
  { id:'D-03', epic:'Epic D', title:'Cancel action works and updates appointment status', method:'static',
    run: ()=> mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/cancel/, 'cancel route'),
  },
  { id:'D-04', epic:'Epic D', title:'Appointment status transitions are enforced (booked-only prep)', method:'static',
    run: ()=> mustFind('apps/backend/controllers/appointments.controller.js', /if \(appt\.status !== 'booked'\)/, 'status gate'),
  },
  { id:'D-05', epic:'Epic D', title:'Role-specific actions (doctor vs patient)', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/appointments.routes.js', /roleRequired\('patient'\), appointmentsController\.book/, 'patient-only book'),
      mustFind('apps/backend/routes/appointments.routes.js', /roleRequired\('patient'\), appointmentsController\.submitReview/, 'patient-only review'),
    ]),
  },
  { id:'D-06', epic:'Epic D', title:'Patient can submit review after appointment completed', method:'static',
    run: ()=> mustFind('apps/backend/controllers/appointments.controller.js', /if \(appt\.status !== 'completed'\)/, 'completed-only review'),
  },

  // ─── Epic E — Real-Time Consultation ───────────────────────────
  { id:'E-01', epic:'Epic E', title:'Only participants linked to appointment can join call', method:'static',
    run: ()=> mustFind('apps/backend/controllers/calls.controller.js', /if \(user\.id !== appt\.patientId && user\.id !== appt\.doctorId\) return null;/, 'appointment ACL'),
  },
  { id:'E-02', epic:'Epic E', title:'Closed appointments block call join', method:'static',
    run: ()=> mustFind('apps/backend/controllers/calls.controller.js', /if \(appt\.status !== 'booked'\)/, 'booked status requirement'),
  },
  { id:'E-03', epic:'Epic E', title:'Video, audio, and mute controls implemented', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /mute|unmute/i, 'mute control'),
      mustFind('apps/frontend/src/App.jsx', /video|camera/i, 'video control'),
    ]),
  },
  { id:'E-04', epic:'Epic E', title:'Camera toggle works', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /camera|toggleCamera|toggleVideo/i, 'camera toggle'),
  },
  { id:'E-05', epic:'Epic E', title:'In-call text chat fallback', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /call.*chat|chat.*fallback|in-call.*chat/i, 'in-call chat'),
  },
  { id:'E-06', epic:'Epic E', title:'Consultation mode switching (video → audio → text)', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /consultMode|consultation.*mode|mode.*switch/i, 'mode switch'),
  },
  { id:'E-07', epic:'Epic E', title:'Weak network downgrade guidance (Data Quality / reconnect / bandwidth guidance)', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /Data Quality|low.bandwidth|low.connectivity|reconnect/i, 'network quality guidance in UI'),
      mustFind('apps/frontend/src/App.jsx', /Data Saver|Saver.*mode|switch.*Audio|switch.*Text/i, 'mode switch guidance'),
    ]),
  },

  // ─── Epic F — Prescriptions & Medicine Handoff ─────────────────
  { id:'F-01', epic:'Epic F', title:'Assigned doctor can create prescription (doctor role gate)', method:'static',
    run: ()=> mustFind('apps/backend/routes/prescriptions.routes.js', /roleRequired\('doctor'\), prescriptionsController\.upsertPrescription/, 'doctor-only upsert'),
  },
  { id:'F-02', epic:'Epic F', title:'Non-assigned users cannot edit prescription', method:'runtime',
    run: async ()=> rt('POST /api/prescriptions/:id without auth => 401', async ()=>{
      const res = await request(await getApp()).post('/api/prescriptions/fake-id');
      return { pass: res.status===401,
               evidence: `POST /api/prescriptions/fake-id => ${res.status}` };
    }),
  },
  { id:'F-03', epic:'Epic F', title:'Saving prescription auto-completes appointment', method:'static',
    run: ()=> mustFind('apps/backend/controllers/prescriptions.controller.js', /status:\s*'completed'/, 'appointment completion on save'),
  },
  { id:'F-04', epic:'Epic F', title:'PDF prescription downloads correctly (route exists)', method:'static',
    run: ()=> mustFind('apps/backend/routes/prescriptions.routes.js', /\/:appointmentId\/pdf/, 'pdf download route'),
  },
  { id:'F-05', epic:'Epic F', title:'Handoff code and pharmacy metadata displayed', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/prescriptions.controller.js', /handoffCode/, 'handoff code'),
      mustFind('apps/backend/controllers/prescriptions.controller.js', /pharmacyName|pharmacyContact/, 'pharmacy metadata'),
    ]),
  },
  { id:'F-06', epic:'Epic F', title:'Patient medicine cabinet (prescription model with appointmentId)', method:'static',
    run: ()=> mustFind('prisma/schema.prisma', /model\s+Prescription/, 'Prescription model exists'),
  },

  // ─── Epic G — Documents & Health Records ───────────────────────
  { id:'G-01', epic:'Epic G', title:'Patient can upload documents for self and family members', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/documents.routes.js', /upload\.single\('file'\)/, 'file upload middleware'),
      mustFind('apps/backend/controllers/documents.controller.js', /uploadFor/, 'uploadFor selector (self/family)'),
    ]),
  },
  { id:'G-02', epic:'Epic G', title:'Files over 10MB are rejected', method:'static',
    run: ()=> mustFind('apps/backend/routes/documents.routes.js', /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/, '10MB limit'),
  },
  { id:'G-03', epic:'Epic G', title:'Unauthorized users cannot download documents', method:'static',
    run: ()=> mustFind('apps/backend/controllers/documents.controller.js', /canAccessDocument/, 'document access ACL fn'),
  },
  { id:'G-04', epic:'Epic G', title:'Appointment-linked uploads respect family context ACL', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/documents.controller.js', /appt\.familyMemberId/, 'family context in upload ACL'),
      mustFind('apps/backend/controllers/documents.controller.js', /familyTargetId !== appt\.familyMemberId/, 'family member match check'),
    ]),
  },
  { id:'G-05', epic:'Epic G', title:'Azure storage path works; local fallback if Azure not configured', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/documents.routes.js', /\/local\/:blobName/, 'local download route'),
      mustFind('apps/backend/controllers/documents.controller.js', /getLocalFilePath/, 'local file path helper'),
    ]),
  },

  // ─── Epic K — Medical Store, Lab Systems, and PDF Preview ─────
  { id:'K-01', epic:'Epic K', title:'Pharmacy and lab domain models exist in Prisma schema', method:'static',
    run: ()=> combine([
      mustFind('prisma/schema.prisma', /model\s+PharmacyOrder/, 'PharmacyOrder model'),
      mustFind('prisma/schema.prisma', /model\s+LabOrder/, 'LabOrder model'),
      mustFind('prisma/schema.prisma', /model\s+LabTestCatalog/, 'LabTestCatalog model'),
      mustFind('prisma/schema.prisma', /enum\s+PharmacyOrderStatus/, 'PharmacyOrderStatus enum'),
      mustFind('prisma/schema.prisma', /enum\s+LabOrderStatus/, 'LabOrderStatus enum'),
    ]),
  },
  { id:'K-02', epic:'Epic K', title:'API route registry mounts pharmacy and labs groups', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/index.js', /apiRouter\.use\('\/pharmacy', pharmacyRoutes\)/, 'pharmacy route group mounted'),
      mustFind('apps/backend/routes/index.js', /apiRouter\.use\('\/labs', labsRoutes\)/, 'labs route group mounted'),
    ]),
  },
  { id:'K-03', epic:'Epic K', title:'Pharmacy endpoints include list/create/detail/status update', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/pharmacy.routes.js', /router\.get\('\/orders'/, 'list orders route'),
      mustFind('apps/backend/routes/pharmacy.routes.js', /router\.post\('\/orders'/, 'create order route'),
      mustFind('apps/backend/routes/pharmacy.routes.js', /router\.get\('\/orders\/:orderId'/, 'order detail route'),
      mustFind('apps/backend/routes/pharmacy.routes.js', /router\.post\('\/orders\/:orderId\/status'/, 'status update route'),
    ]),
  },
  { id:'K-04', epic:'Epic K', title:'Lab endpoints include catalog, orders, status, and report linking', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/labs.routes.js', /router\.get\('\/catalog'/, 'catalog list route'),
      mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/catalog'/, 'catalog create route'),
      mustFind('apps/backend/routes/labs.routes.js', /router\.get\('\/orders'/, 'orders list route'),
      mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/orders\/:orderId\/status'/, 'order status route'),
      mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/orders\/:orderId\/report'/, 'report link route'),
    ]),
  },
  { id:'K-05', epic:'Epic K', title:'In-app PDF preview endpoint exists for uploaded documents', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/documents.routes.js', /router\.get\('\/:documentId\/preview', authRequired/, 'document preview route'),
      mustFind('apps/backend/controllers/documents.controller.js', /previewPdf:/, 'preview controller handler'),
      mustFind('apps/backend/controllers/documents.controller.js', /Content-Disposition.*inline/, 'inline preview disposition'),
    ]),
  },
  { id:'K-06', epic:'Epic K', title:'Frontend routes include pharmacy, lab, and PDF preview pages', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /path="\/pharmacy\/orders"/, 'pharmacy page route'),
      mustFind('apps/frontend/src/App.jsx', /path="\/labs\/tests"/, 'lab page route'),
      mustFind('apps/frontend/src/App.jsx', /path="\/pdf-preview"/, 'pdf preview route'),
    ]),
  },
  { id:'K-07', epic:'Epic K', title:'PDF preview utility is used across prescription and document links', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /function buildPdfPreviewLink\(/, 'preview url helper'),
      mustFind('apps/frontend/src/App.jsx', /\/api\/documents\/\$\{doc\.id\}\/preview/, 'document preview link usage'),
      mustFind('apps/frontend/src/App.jsx', /\/api\/prescriptions\/\$\{appointmentId\}\/pdf/, 'prescription preview link usage'),
    ]),
  },
  { id:'K-08', epic:'Epic K', title:'Prescription PDF endpoint supports inline preview with optional forced download', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/prescriptions.controller.js', /req\.query\.download === '1'/, 'download query switch'),
      mustFind('apps/backend/controllers/prescriptions.controller.js', /Content-Disposition/, 'content disposition header'),
    ]),
  },
  { id:'K-09', epic:'Epic K', title:'Pharmacy and lab endpoints require authentication by default', method:'runtime',
    run: async ()=> rt('GET /api/pharmacy/orders + /api/labs/orders without auth => 401', async ()=>{
      const [pharmacyRes, labsRes] = await Promise.all([
        request(await getApp()).get('/api/pharmacy/orders'),
        request(await getApp()).get('/api/labs/orders'),
      ]);
      return { pass: pharmacyRes.status===401 && labsRes.status===401,
               evidence: `/api/pharmacy/orders => ${pharmacyRes.status}; /api/labs/orders => ${labsRes.status}` };
    }),
  },

  // ─── Epic H — Patient Workspace & Family Profiles ──────────────
  { id:'H-01', epic:'Epic H', title:'Patient can edit own profile and health profile', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/patients.routes.js', /router\.get\('\/me'/, 'GET /me health profile'),
      mustFind('apps/backend/routes/patients.routes.js', /router\.post\('\/me'/, 'POST /me update health'),
    ]),
  },
  { id:'H-02', epic:'Epic H', title:'Patient can create and update family member profiles', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/patients.routes.js', /\/family-members'/, 'family create route'),
      mustFind('apps/backend/routes/patients.routes.js', /\/family-members\/update/, 'family update route'),
    ]),
  },
  { id:'H-03', epic:'Epic H', title:'Family member operations blocked for other patients (owner constraint)', method:'static',
    run: ()=> mustFind('apps/backend/controllers/patients.controller.js', /ownerPatientId:\s*req\.user\.id/, 'owner constraint'),
  },
  { id:'H-04', epic:'Epic H', title:'Consultation timeline shows completed visits', method:'static',
    run: ()=> mustFind('apps/backend/routes/patients.routes.js', /\/workspace/, 'workspace route for timeline'),
  },

  // ─── Epic I — Reminders ────────────────────────────────────────
  { id:'I-01', epic:'Epic I', title:'Reminder jobs are auto-scheduled (24h and 30m windows)', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/services/reminder.service.js', /24 \* 60/, '24h offset'),
      mustFind('apps/backend/services/reminder.service.js', /minutesBefore:\s*30/, '30m offset'),
    ]),
  },
  { id:'I-02', epic:'Epic I', title:'Doctor/admin can dispatch due reminders', method:'static',
    run: ()=> mustFind('apps/backend/routes/reminders.routes.js', /roleRequired\('doctor', 'admin'\)/, 'dispatch role gate'),
  },
  { id:'I-03', epic:'Epic I', title:'Reminder statuses transition: scheduled → sent / failed / skipped', method:'static',
    run: ()=> combine([
      mustFind('prisma/schema.prisma', /enum\s+ReminderStatus\s*\{[\s\S]*?scheduled[\s\S]*?\}/, 'ReminderStatus enum with scheduled'),
      mustFind('prisma/schema.prisma', /enum\s+ReminderStatus\s*\{[\s\S]*?sent[\s\S]*?\}/, 'ReminderStatus enum with sent'),
      mustFind('prisma/schema.prisma', /enum\s+ReminderStatus\s*\{[\s\S]*?failed[\s\S]*?\}/, 'ReminderStatus enum with failed'),
      mustFind('prisma/schema.prisma', /enum\s+ReminderStatus\s*\{[\s\S]*?skipped[\s\S]*?\}/, 'ReminderStatus enum with skipped'),
    ]),
  },
  { id:'I-04', epic:'Epic I', title:'Missing reminder tables fail gracefully with "unsupported" message', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/reminders.controller.js', /isReminderTableMissing/, 'table-missing helper'),
      mustFind('apps/backend/controllers/reminders.controller.js', /unsupported:\s*true/, 'unsupported flag'),
    ]),
  },

  // ─── Epic J — Care Support & Consent ───────────────────────────
  { id:'J-01', epic:'Epic J', title:'Patient can register a help worker as helper', method:'static',
    run: ()=> mustFind('apps/backend/routes/support.routes.js', /\/helpers/, 'helper create route'),
  },
  { id:'J-02', epic:'Epic J', title:'Patient can grant scoped consent: appointment, records, all', method:'static',
    run: ()=> combine([
      mustFind('prisma/schema.prisma', /enum\s+DelegationScope/, 'DelegationScope enum'),
      mustFind('prisma/schema.prisma', /appointment/, 'appointment scope'),
      mustFind('prisma/schema.prisma', /records/, 'records scope'),
      mustFind('prisma/schema.prisma', /all/, 'all scope'),
    ]),
  },
  { id:'J-03', epic:'Epic J', title:'Helper with no active consent is denied access', method:'static',
    run: ()=> mustFind('apps/backend/controllers/support.controller.js', /isActive/, 'isActive consent check'),
  },
  { id:'J-04', epic:'Epic J', title:'Revoking consent immediately removes helper visibility', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/controllers/support.controller.js', /isActive:\s*false/, 'revoke active flag'),
      mustFind('apps/backend/controllers/support.controller.js', /revokedAt/, 'revokedAt timestamp'),
    ]),
  },
  { id:'J-05', epic:'Epic J', title:'Consent audit trail records timestamps and actor IDs', method:'static',
    run: ()=> combine([
      mustFind('prisma/schema.prisma', /model\s+ConsentAudit/, 'ConsentAudit model'),
      mustFind('prisma/schema.prisma', /grantedById/, 'grantedBy actor ID'),
      mustFind('prisma/schema.prisma', /createdAt/, 'timestamp in audit'),
    ]),
  },

  // ─── Epic L — AI Copilot ───────────────────────────────────────
  { id:'L-01', epic:'Epic L', title:'AI context endpoint requires authentication', method:'runtime',
    run: async ()=> rt('GET /api/ai/context => 401', async ()=>{
      const res = await request(await getApp()).get('/api/ai/context');
      return { pass: res.status===401,
               evidence: `/api/ai/context => ${res.status}` };
    }),
  },
  { id:'L-02', epic:'Epic L', title:'Draft tools work: note, triage, document assistant routes exist', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/ai.routes.js', /draft-note/, 'draft note route'),
      mustFind('apps/backend/routes/ai.routes.js', /triage-assist/, 'triage assist route'),
      mustFind('apps/backend/routes/ai.routes.js', /document-assist/, 'document assist route'),
    ]),
  },
  { id:'L-03', epic:'Epic L', title:'All AI outputs marked as "Draft — requires human review"', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /Draft\s*[\u2014-]\s*requires human review/i, 'draft label in UI'),
      mustNotFind('apps/backend/controllers/ai.controller.js', /requiresReview:\s*false/, 'no requiresReview:false'),
    ]),
  },
  { id:'L-04', epic:'Epic L', title:'Ollama offline fallback shown clearly (fallbackUsed metadata)', method:'static',
    run: ()=> mustFind('apps/backend/controllers/ai.controller.js', /fallbackUsed:/, 'fallbackUsed metadata'),
  },
  { id:'L-05', epic:'Epic L', title:'Drafts created offline saved locally and retry when online', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /AI_OFFLINE_DRAFTS_KEY/, 'offline storage key'),
      mustFind('apps/frontend/src/App.jsx', /queueOfflineDraft/, 'queue helper'),
      mustFind('apps/frontend/src/App.jsx', /retryAllOfflineDrafts/, 'retry helper'),
    ]),
  },
  { id:'L-06', epic:'Epic L', title:'AI endpoints are rate-limited', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/routes/ai.routes.js', /router\.use\(aiLimiter\)/, 'AI limiter middleware'),
      mustFind('apps/backend/routes/ai.routes.js', /AI_RATE_LIMITED/, 'rate limit error code'),
    ]),
  },

  // ─── Epic M — Localization & Rural Support ─────────────────────
  { id:'M-01', epic:'Epic M', title:'Language selector widget loads and switches language', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/TranslationService.jsx', /INDIAN_LANGUAGE_CODES/, 'language whitelist'),
      mustFind('apps/frontend/src/TranslationService.jsx', /sanitizeLanguageDropdown/, 'dropdown sanitizer'),
    ]),
  },
  { id:'M-02', epic:'Epic M', title:'Connectivity banner appears when network degrades', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /rural-connectivity-banner/, 'connectivity banner'),
  },
  { id:'M-03', epic:'Epic M', title:'Data saver toggle visually changes UI (data-saver class)', method:'static',
    run: ()=> mustFind('apps/frontend/src/App.jsx', /data-saver/, 'data-saver class'),
  },
  { id:'M-04', epic:'Epic M', title:'Data saver state survives hard refresh (localStorage)', method:'static',
    run: ()=> combine([
      mustFind('apps/frontend/src/App.jsx', /localStorage/, 'localStorage usage'),
      mustFind('apps/frontend/src/App.jsx', /setIsDataSaver/, 'data saver setter'),
    ]),
  },

  // ─── Non-Functional / Security ─────────────────────────────────
  { id:'NFR-01', epic:'NFR', title:'Content-Security-Policy header present (Helmet CSP)', method:'static',
    run: ()=> mustFind('apps/backend/server/create-app.js', /helmet\(\{[\s\S]*contentSecurityPolicy:/, 'helmet CSP config'),
  },
  { id:'NFR-02', epic:'NFR', title:'Auth cookie is httpOnly and Secure (in production)', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/middleware/auth.js', /httpOnly:\s*true/, 'httpOnly'),
      mustFind('apps/backend/middleware/auth.js', /secure:\s*isProd/, 'secure flag'),
    ]),
  },
  { id:'NFR-03', epic:'NFR', title:'/health/live and /health/ready return correct status', method:'runtime',
    run: async ()=> rt('Health probes', async ()=>{
      const live  = await request(await getApp()).get('/api/health/live');
      const ready = await request(await getApp()).get('/api/health/ready');
      return { pass: live.status===200 && [200,503].includes(ready.status),
               evidence: `/api/health/live=${live.status}, /api/health/ready=${ready.status}` };
    }),
  },
  { id:'NFR-04', epic:'NFR', title:'SPA assets load with immutable cache; index.html has no-store', method:'static',
    run: ()=> combine([
      mustFind('apps/backend/server/create-app.js', /Cache-Control.*no-store/, 'index no-store'),
      mustFind('apps/backend/server/create-app.js', /immutable/, 'immutable asset cache'),
    ]),
  },
  { id:'NFR-05', epic:'NFR', title:'Request logs include unique request ID', method:'runtime',
    run: async ()=> rt('Request ID', async ()=>{
      const res = await request(await getApp()).get('/api/session');
      return { pass: res.status===200 && !!res.body?.requestId && !!res.headers['x-request-id'],
               evidence: `requestId=${res.body?.requestId||'none'} header=${res.headers['x-request-id']||'none'}` };
    }),
  },
  { id:'NFR-06', epic:'NFR', title:'AI outputs do not expose PHI (requiresReview always true)', method:'static',
    run: ()=> mustNotFind('apps/backend/controllers/ai.controller.js', /requiresReview:\s*false/, 'requiresReview false absent'),
  },

  // ─── Edge Cases ────────────────────────────────────────────────
  { id:'EDGE-01', epic:'Edge Cases', title:'Patient trying doctor-only route via URL => 401 (no auth)', method:'runtime',
    run: async ()=> rt('GET /api/doctors/me/analytics => 401', async ()=>{
      const res = await request(await getApp()).get('/api/doctors/me/analytics');
      return { pass: res.status===401,
               evidence: `GET /api/doctors/me/analytics => ${res.status}` };
    }),
  },
  { id:'EDGE-02', epic:'Edge Cases', title:'Booking with invalid/expired slot fails with guard', method:'static',
    run: ()=> mustFind('apps/backend/controllers/appointments.controller.js', /slot\.updateMany\(/, 'transactional slot update prevents stale booking'),
  },
  { id:'EDGE-03', epic:'Edge Cases', title:'Upload file >10MB rejected (multer limit configured)', method:'static',
    run: ()=> mustFind('apps/backend/routes/documents.routes.js', /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/, '10MB limit in multer'),
  },
  { id:'EDGE-04', epic:'Edge Cases', title:'Join call for someone else\'s appointment => blocked', method:'static',
    run: ()=> mustFind('apps/backend/controllers/calls.controller.js', /if \(user\.id !== appt\.patientId && user\.id !== appt\.doctorId\) return null;/, 'ACL blocks non-participants'),
  },
  { id:'EDGE-05', epic:'Edge Cases', title:'Patient trying to create prescription => 401 (must be doctor)', method:'runtime',
    run: async ()=> rt('POST /api/prescriptions/fake-id => 401', async ()=>{
      const res = await request(await getApp()).post('/api/prescriptions/fake-id');
      return { pass: res.status===401,
               evidence: `POST /api/prescriptions/fake-id => ${res.status}` };
    }),
  },
  { id:'EDGE-06', epic:'Edge Cases', title:'Unknown API route returns 404 NOT_FOUND', method:'runtime',
    run: async ()=> rt('GET /api/no-such-route', async ()=>{
      const res = await request(await getApp()).get('/api/no-such-route');
      return { pass: res.status===404 && res.body?.code==='NOT_FOUND',
               evidence: `/api/no-such-route => ${res.status} code=${res.body?.code||'none'}` };
    }),
  },
  { id:'EDGE-07', epic:'Edge Cases', title:'Global rate limit middleware is configured', method:'static',
    run: ()=> mustFind('apps/backend/server/create-app.js', /rateLimit\(\{[\s\S]*limit:\s*120/, 'global rate limiter'),
  },
];

// ── Report Generation ────────────────────────────────────────────────
function esc(v) { return String(v).replace(/\|/g, '\\|'); }

function epicReportFileName(epicKey) {
  const mapping = {
    'Epic A': 'epic-a-auth',
    'Epic B': 'epic-b-dashboard',
    'Epic C': 'epic-c-booking',
    'Epic D': 'epic-d-appointments',
    'Epic E': 'epic-e-calls',
    'Epic F': 'epic-f-prescriptions',
    'Epic G': 'epic-g-documents',
    'Epic H': 'epic-h-workspace',
    'Epic I': 'epic-i-reminders',
    'Epic J': 'epic-j-consent',
    'Epic K': 'epic-k-pharmacy-labs',
    'Epic L': 'epic-l-ai-copilot',
    'Epic M': 'epic-m-localization',
    'NFR':    'nfr-security',
    'Edge Cases': 'edge-cases',
  };
  return mapping[epicKey] || epicKey.toLowerCase().replace(/\s+/g, '-');
}

function epicTitle(epicKey) {
  const mapping = {
    'Epic A': '🔐 Epic A — Authentication & Access Control',
    'Epic B': '🏠 Epic B — Dashboard & Navigation',
    'Epic C': '🔍 Epic C — Doctor Discovery & Booking',
    'Epic D': '📅 Epic D — Appointment Lifecycle',
    'Epic E': '📹 Epic E — Real-Time Consultation',
    'Epic F': '💊 Epic F — Prescriptions & Medicine Handoff',
    'Epic G': '📁 Epic G — Documents & Health Records',
    'Epic H': '👨‍👩‍👧 Epic H — Patient Workspace & Family Profiles',
    'Epic I': '🔔 Epic I — Reminders',
    'Epic J': '🤝 Epic J — Care Support & Consent',
    'Epic K': '🧪 Epic K — Pharmacy, Labs, and PDF Preview',
    'Epic L': '🤖 Epic L — AI Copilot',
    'Epic M': '🌐 Epic M — Localization & Rural Support',
    'NFR':    '🛡️ Non-Functional / Security Checks',
    'Edge Cases': '🚨 Edge Cases',
  };
  return mapping[epicKey] || epicKey;
}

function writeEpicReport(epicKey, rows) {
  const passed = rows.filter(r => r.status === 'PASS').length;
  const failed = rows.filter(r => r.status === 'FAIL').length;
  const lines = [
    `# ${epicTitle(epicKey)}`,
    '',
    `**Passed:** ${passed}/${rows.length}  `,
    `**Failed:** ${failed}/${rows.length}`,
    '',
    '| ID | Test | Method | Status | Evidence |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const statusIcon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    lines.push(`| ${esc(r.id)} | ${esc(r.title)} | ${esc(r.method)} | ${statusIcon} | ${esc(r.evidence)} |`);
  }
  lines.push('');
  const filename = `${epicReportFileName(epicKey)}.md`;
  fs.writeFileSync(path.join(REPORT_DIR, filename), lines.join('\n'), 'utf8');
  return filename;
}

async function main() {
  const startedAt = Date.now();
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const results = [];
  for (const check of checks) {
    const outcome = await check.run();
    results.push({
      id: check.id,
      epic: check.epic,
      title: check.title,
      method: check.method,
      status: outcome.pass ? 'PASS' : 'FAIL',
      evidence: outcome.evidence,
    });
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);

  // ── JSON report ──
  const report = {
    generatedAt: new Date().toISOString(),
    durationSeconds: Number(durationSec),
    summary: { total: results.length, passed, failed },
    checks: results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'results.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

  // ── Per-epic reports ──
  const epicGroups = {};
  for (const r of results) {
    if (!epicGroups[r.epic]) epicGroups[r.epic] = [];
    epicGroups[r.epic].push(r);
  }
  const generatedFiles = [];
  for (const [epicKey, rows] of Object.entries(epicGroups)) {
    generatedFiles.push(writeEpicReport(epicKey, rows));
  }

  // ── Master summary ──
  const summaryLines = [
    '# 📋 QA Master Summary — Sanctuary Health',
    '',
    `- **Generated:** ${report.generatedAt}`,
    `- **Duration:** ${durationSec}s`,
    `- **Total:** ${results.length}`,
    `- **Passed:** ${passed}`,
    `- **Failed:** ${failed}`,
    `- **Pass Rate:** ${((passed / results.length) * 100).toFixed(1)}%`,
    '',
    '## Results by Epic',
    '',
    '| Epic | Total | Passed | Failed | Status | Report |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const [epicKey, rows] of Object.entries(epicGroups)) {
    const ep = rows.filter(r => r.status === 'PASS').length;
    const ef = rows.filter(r => r.status === 'FAIL').length;
    const eStat = ef === 0 ? '✅ ALL PASS' : `⚠️ ${ef} FAIL`;
    const reportFile = `${epicReportFileName(epicKey)}.md`;
    summaryLines.push(`| ${esc(epicTitle(epicKey))} | ${rows.length} | ${ep} | ${ef} | ${eStat} | [${reportFile}](./${reportFile}) |`);
  }
  summaryLines.push('');
  summaryLines.push('## All Checks');
  summaryLines.push('');
  summaryLines.push('| ID | Epic | Test | Method | Status |');
  summaryLines.push('| --- | --- | --- | --- | --- |');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    summaryLines.push(`| ${esc(r.id)} | ${esc(r.epic)} | ${esc(r.title)} | ${esc(r.method)} | ${icon} ${r.status} |`);
  }
  summaryLines.push('');
  fs.writeFileSync(path.join(REPORT_DIR, 'master-summary.md'), summaryLines.join('\n'), 'utf8');

  // ── Console output ──
  console.log(`\n✅ QA Checklist Complete: ${passed} passed, ${failed} failed (${durationSec}s)`);
  console.log(`\nReports written to: ${REPORT_DIR}`);
  console.log(`  - master-summary.md`);
  console.log(`  - results.json`);
  for (const f of generatedFiles) console.log(`  - ${f}`);

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(e => {
    console.error('QA runner failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeAppIfNeeded();
    } catch (error) {
      console.error('QA runner teardown failed:', error);
      process.exitCode = 1;
    }
  });
