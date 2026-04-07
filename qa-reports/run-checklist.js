const fs = require('fs');
const path = require('path');
let request;
try {
  request = require('supertest');
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Missing dependency: supertest. Install it with "npm install --save-dev supertest".');
  process.exit(1);
}
const { createApp } = require('../apps/backend/server/create-app');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = __dirname;

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

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

function findPattern(relPath, pattern) {
  const regex = normalizeRegex(pattern);
  const text = readText(relPath);
  const match = regex.exec(text);

  if (!match) {
    return {
      found: false,
      relPath,
      pattern: regex.toString(),
      line: null,
      snippet: ''
    };
  }

  const offset = match.index || 0;
  const line = text.slice(0, offset).split(/\r?\n/).length;

  return {
    found: true,
    relPath,
    pattern: regex.toString(),
    line,
    snippet: String(match[0] || '').trim().slice(0, 140)
  };
}

function mustFind(relPath, pattern, note) {
  const hit = findPattern(relPath, pattern);
  if (!hit.found) {
    return {
      pass: false,
      evidence: `${relPath}: missing ${note || hit.pattern}`
    };
  }

  return {
    pass: true,
    evidence: `${relPath}:${hit.line} ${note || hit.snippet}`
  };
}

function mustNotFind(relPath, pattern, note) {
  const hit = findPattern(relPath, pattern);
  if (hit.found) {
    return {
      pass: false,
      evidence: `${relPath}:${hit.line} found forbidden ${note || hit.snippet}`
    };
  }

  return {
    pass: true,
    evidence: `${relPath}: no match for forbidden ${note || String(normalizeRegex(pattern))}`
  };
}

function combineChecks(parts) {
  const failed = parts.find((part) => !part.pass);
  if (failed) return failed;
  return {
    pass: true,
    evidence: parts.map((part) => part.evidence).join(' | ')
  };
}

let appPromise;
let appInstance;
let appCloser;

async function getApp() {
  if (!appPromise) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa_check_secret';
    appPromise = Promise.resolve(createApp()).then((createdApp) => {
      if (!createdApp) {
        throw new Error('createApp returned no app instance');
      }

      appInstance = createdApp.app || createdApp;

      if (typeof createdApp.close === 'function') {
        appCloser = createdApp.close.bind(createdApp);
      } else if (createdApp.server && typeof createdApp.server.close === 'function') {
        appCloser = createdApp.server.close.bind(createdApp.server);
      } else if (typeof appInstance.close === 'function') {
        appCloser = appInstance.close.bind(appInstance);
      }

      return appInstance;
    });
  }
  return appPromise;
}

async function closeAppIfNeeded() {
  if (!appCloser) {
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
      const maybePromise = appCloser(finish);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(() => finish()).catch(finish);
      } else if (appCloser.length === 0) {
        finish();
      }
    } catch (error) {
      finish(error);
    }
  });
}

async function runtimeCheck(name, handler) {
  try {
    const result = await handler();
    return {
      pass: result.pass,
      evidence: result.evidence || name
    };
  } catch (error) {
    return {
      pass: false,
      evidence: `${name}: ${error.message}`
    };
  }
}

const checks = [
  {
    id: 'A-1',
    area: 'Authentication',
    title: 'Login/register/logout routes are defined',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/login'/, 'POST /login route'),
        mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/register'/, 'POST /register route'),
        mustFind('apps/backend/routes/auth.routes.js', /router\.post\('\/logout'/, 'POST /logout route')
      ])
  },
  {
    id: 'A-2',
    area: 'Authentication',
    title: 'Role model includes patient/doctor/admin/help_worker',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('prisma/schema.prisma', /enum\s+Role/, 'Role enum'),
        mustFind('prisma/schema.prisma', /patient/, 'patient role'),
        mustFind('prisma/schema.prisma', /doctor/, 'doctor role'),
        mustFind('prisma/schema.prisma', /admin/, 'admin role'),
        mustFind('prisma/schema.prisma', /help_worker/, 'help_worker role')
      ])
  },
  {
    id: 'A-3',
    area: 'Authentication',
    title: 'Unauthorized API request is blocked',
    method: 'runtime',
    run: async () =>
      runtimeCheck('GET /api/appointments unauthorized', async () => {
        const res = await request(await getApp()).get('/api/appointments');
        const pass = res.status === 401 && res.body?.code === 'UNAUTHORIZED';
        return {
          pass,
          evidence: `/api/appointments => ${res.status} code=${res.body?.code || 'none'}`
        };
      })
  },
  {
    id: 'A-4',
    area: 'Authentication',
    title: '/api and /api/v1 compatibility exists for session',
    method: 'runtime',
    run: async () =>
      runtimeCheck('Session parity', async () => {
        const [v0, v1] = await Promise.all([
          request(await getApp()).get('/api/session'),
          request(await getApp()).get('/api/v1/session')
        ]);

        const pass =
          v0.status === 200 &&
          v1.status === 200 &&
          v0.body?.ok === true &&
          v1.body?.ok === true;

        return {
          pass,
          evidence: `/api/session=${v0.status}, /api/v1/session=${v1.status}`
        };
      })
  },
  {
    id: 'B-1',
    area: 'Dashboard',
    title: 'Protected shell routes include dashboard/book/appointments/ai-copilot',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /path="\/dashboard"/, 'dashboard route'),
        mustFind('apps/frontend/src/App.jsx', /path="\/book"/, 'book route'),
        mustFind('apps/frontend/src/App.jsx', /path="\/appointments"/, 'appointments route'),
        mustFind('apps/frontend/src/App.jsx', /path="\/ai-copilot"/, 'ai-copilot route')
      ])
  },
  {
    id: 'B-2',
    area: 'Dashboard',
    title: 'Connectivity banner and data saver toggle are present',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /rural-connectivity-banner/, 'connectivity banner class'),
        mustFind('apps/frontend/src/App.jsx', /Data Saver ON/, 'data saver label'),
        mustFind('apps/frontend/src/App.jsx', /setIsDataSaver/, 'data saver toggle handler')
      ])
  },
  {
    id: 'B-3',
    area: 'Dashboard',
    title: 'Profile language picker is available',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /profile-language-picker/, 'language picker id'),
        mustFind('apps/frontend/src/App.jsx', /profile-language-trigger/, 'language trigger class')
      ])
  },
  {
    id: 'C-1',
    area: 'Booking',
    title: 'Doctor directory supports specialization/language/online filters',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/doctors.controller.js', /specialization/i, 'specialization filter logic'),
        mustFind('apps/backend/controllers/doctors.controller.js', /language/i, 'language filter logic'),
        mustFind('apps/backend/controllers/doctors.controller.js', /online/i, 'online filter logic')
      ])
  },
  {
    id: 'C-2',
    area: 'Booking',
    title: 'Booking wizard exposes 4 guided steps',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /Step 1 of 4/, 'wizard step 1'),
        mustFind('apps/frontend/src/App.jsx', /Step 2 of 4/, 'wizard step 2'),
        mustFind('apps/frontend/src/App.jsx', /Step 3 of 4/, 'wizard step 3'),
        mustFind('apps/frontend/src/App.jsx', /Step 4 of 4/, 'wizard step 4')
      ])
  },
  {
    id: 'C-3',
    area: 'Booking',
    title: 'Booking API requires patient role',
    method: 'static',
    run: () => mustFind('apps/backend/routes/appointments.routes.js', /roleRequired\('patient'\), appointmentsController\.book/, 'patient role gate on book')
  },
  {
    id: 'C-4',
    area: 'Booking',
    title: 'Slot race guard prevents booking unavailable slot',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/appointments.controller.js', /slot\.updateMany\(/, 'transactional slot update'),
        mustFind('apps/backend/controllers/appointments.controller.js', /where:\s*\{\s*id:\s*slotId,\s*status:\s*'available'\s*\}/, 'availability condition in updateMany'),
        mustFind('apps/backend/controllers/appointments.controller.js', /updated\.count\s*!==\s*1/, 'stale slot conflict guard')
      ])
  },
  {
    id: 'C-5',
    area: 'Booking',
    title: 'Family-member booking validates ownership',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/appointments.controller.js', /familyMemberId/, 'family member payload usage'),
        mustFind('apps/backend/controllers/appointments.controller.js', /ownerPatientId:\s*req\.user\.id/, 'owner check')
      ])
  },
  {
    id: 'D-1',
    area: 'Appointments',
    title: 'Lifecycle routes include prep/review/cancel/end',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/prep/, 'prep route'),
        mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/review/, 'review route'),
        mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/cancel/, 'cancel route'),
        mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/end/, 'end route')
      ])
  },
  {
    id: 'D-2',
    area: 'Appointments',
    title: 'Pre-consult updates blocked for closed appointments',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/appointments.controller.js', /if \(appt\.status !== 'booked'\)/, 'status gate in pre-consult update')
  },
  {
    id: 'D-3',
    area: 'Appointments',
    title: 'Review submission only allowed after completion',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/appointments.controller.js', /if \(appt\.status !== 'completed'\)/, 'completed-only review check')
  },
  {
    id: 'D-4',
    area: 'Appointments',
    title: 'Presence endpoint exists for call readiness',
    method: 'static',
    run: () => mustFind('apps/backend/routes/appointments.routes.js', /\/:appointmentId\/presence/, 'presence route')
  },
  {
    id: 'E-1',
    area: 'Calls',
    title: 'Call join/end routes are auth protected',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/calls.routes.js', /router\.get\('\/:appointmentId', authRequired/, 'auth on call join'),
        mustFind('apps/backend/routes/calls.routes.js', /router\.post\('\/:appointmentId\/end', authRequired/, 'auth on call end')
      ])
  },
  {
    id: 'E-2',
    area: 'Calls',
    title: 'Call access check binds user to appointment',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/calls.controller.js', /if \(user\.id !== appt\.patientId && user\.id !== appt\.doctorId\) return null;/, 'appointment ACL check')
  },
  {
    id: 'E-3',
    area: 'Calls',
    title: 'Closed appointments cannot start calls',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/calls.controller.js', /if \(appt\.status !== 'booked'\)/, 'booked status requirement')
  },
  {
    id: 'F-1',
    area: 'Prescription',
    title: 'Prescription routes include view/upsert/pdf',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/prescriptions.routes.js', /router\.get\('\/:appointmentId', authRequired/, 'view route'),
        mustFind('apps/backend/routes/prescriptions.routes.js', /router\.post\('\/:appointmentId', authRequired, roleRequired\('doctor'\)/, 'doctor-only upsert route'),
        mustFind('apps/backend/routes/prescriptions.routes.js', /router\.get\('\/:appointmentId\/pdf', authRequired/, 'pdf route')
      ])
  },
  {
    id: 'F-2',
    area: 'Prescription',
    title: 'Saving prescription auto-completes appointment',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/prescriptions.controller.js', /appointment\.update\(\{ where: \{ id: appointmentId \}, data: \{ status: 'completed' \} \}\)/, 'appointment completion write')
  },
  {
    id: 'F-3',
    area: 'Prescription',
    title: 'Handoff code generation exists',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/prescriptions.controller.js', /function buildHandoffCode\(/, 'handoff code helper'),
        mustFind('apps/backend/controllers/prescriptions.controller.js', /handoffCode/, 'handoff code persistence')
      ])
  },
  {
    id: 'G-1',
    area: 'Documents',
    title: 'Upload size capped at 10MB',
    method: 'static',
    run: () => mustFind('apps/backend/routes/documents.routes.js', /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/, 'multer 10MB limit')
  },
  {
    id: 'G-2',
    area: 'Documents',
    title: 'Document access ACL checks owner and appointment scope',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/documents.controller.js', /if \(doc\.ownerId === user\.id\) return true;/, 'owner ACL shortcut'),
        mustFind('apps/backend/controllers/documents.controller.js', /ensureAppointmentAccess\(doc\.appointmentId, user\)/, 'appointment ACL'),
        mustFind('apps/backend/controllers/documents.controller.js', /if \(req\.user\.role !== 'patient'\) return res\.status\(403\)/, 'upload role gate')
      ])
  },
  {
    id: 'G-3',
    area: 'Documents',
    title: 'Local download fallback route is available',
    method: 'static',
    run: () => mustFind('apps/backend/routes/documents.routes.js', /\/local\/:blobName/, 'local blob route')
  },
  {
    id: 'K-1',
    area: 'Pharmacy and Labs',
    title: 'Prisma schema includes pharmacy and lab order models',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('prisma/schema.prisma', /model\s+PharmacyOrder/, 'PharmacyOrder model'),
        mustFind('prisma/schema.prisma', /model\s+LabOrder/, 'LabOrder model'),
        mustFind('prisma/schema.prisma', /model\s+LabTestCatalog/, 'LabTestCatalog model')
      ])
  },
  {
    id: 'K-2',
    area: 'Pharmacy and Labs',
    title: 'API route registry mounts pharmacy and labs route groups',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/index.js', /apiRouter\.use\('\/pharmacy', pharmacyRoutes\)/, 'pharmacy routes mounted'),
        mustFind('apps/backend/routes/index.js', /apiRouter\.use\('\/labs', labsRoutes\)/, 'labs routes mounted')
      ])
  },
  {
    id: 'K-3',
    area: 'Pharmacy and Labs',
    title: 'Pharmacy routes include list/create/detail/status update',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/pharmacy.routes.js', /router\.get\('\/orders'/, 'list route'),
        mustFind('apps/backend/routes/pharmacy.routes.js', /router\.post\('\/orders'/, 'create route'),
        mustFind('apps/backend/routes/pharmacy.routes.js', /router\.get\('\/orders\/:orderId'/, 'detail route'),
        mustFind('apps/backend/routes/pharmacy.routes.js', /router\.post\('\/orders\/:orderId\/status'/, 'status route')
      ])
  },
  {
    id: 'K-4',
    area: 'Pharmacy and Labs',
    title: 'Lab routes include catalog/orders/status/report endpoints',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/labs.routes.js', /router\.get\('\/catalog'/, 'catalog list route'),
        mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/catalog'/, 'catalog create route'),
        mustFind('apps/backend/routes/labs.routes.js', /router\.get\('\/orders'/, 'orders list route'),
        mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/orders\/:orderId\/status'/, 'status route'),
        mustFind('apps/backend/routes/labs.routes.js', /router\.post\('\/orders\/:orderId\/report'/, 'report route')
      ])
  },
  {
    id: 'K-5',
    area: 'Pharmacy and Labs',
    title: 'Document PDF preview route is available',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/documents.routes.js', /router\.get\('\/:documentId\/preview', authRequired/, 'preview route'),
        mustFind('apps/backend/controllers/documents.controller.js', /previewPdf:/, 'preview handler')
      ])
  },
  {
    id: 'K-6',
    area: 'Pharmacy and Labs',
    title: 'Frontend includes pharmacy, lab, and PDF preview pages',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /path="\/pharmacy\/orders"/, 'pharmacy page route'),
        mustFind('apps/frontend/src/App.jsx', /path="\/labs\/tests"/, 'labs page route'),
        mustFind('apps/frontend/src/App.jsx', /path="\/pdf-preview"/, 'pdf preview route')
      ])
  },
  {
    id: 'K-7',
    area: 'Pharmacy and Labs',
    title: 'Prescription and document links use preview-first behavior',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /function buildPdfPreviewLink\(/, 'preview helper'),
        mustFind('apps/frontend/src/App.jsx', /\/api\/documents\/\$\{doc\.id\}\/preview/, 'document preview link'),
        mustFind('apps/backend/controllers/prescriptions.controller.js', /req\.query\.download === '1'/, 'download toggle support')
      ])
  },
  {
    id: 'K-8',
    area: 'Pharmacy and Labs',
    title: 'Pharmacy and lab order APIs are auth-protected',
    method: 'runtime',
    run: async () =>
      runtimeCheck('Pharmacy/lab auth gate', async () => {
        const [pharmacyRes, labRes] = await Promise.all([
          request(await getApp()).get('/api/pharmacy/orders'),
          request(await getApp()).get('/api/labs/orders')
        ]);
        const pass = pharmacyRes.status === 401 && labRes.status === 401;
        return {
          pass,
          evidence: `/api/pharmacy/orders=${pharmacyRes.status}, /api/labs/orders=${labRes.status}`
        };
      })
  },
  {
    id: 'H-1',
    area: 'Workspace',
    title: 'Patient workspace and family APIs exist',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/patients.routes.js', /\/workspace/, 'workspace route'),
        mustFind('apps/backend/routes/patients.routes.js', /\/family-members/, 'family create route'),
        mustFind('apps/backend/routes/patients.routes.js', /\/family-members\/update/, 'family update route')
      ])
  },
  {
    id: 'H-2',
    area: 'Workspace',
    title: 'Family member updates enforce owner constraint',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/patients.controller.js', /where: \{ id: parsed\.data\.familyMemberId, ownerPatientId: req\.user\.id \}/, 'owner check in family update')
  },
  {
    id: 'I-1',
    area: 'Reminders',
    title: 'Reminder scheduler creates 24h and 30m jobs',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/services/reminder.service.js', /24 \* 60/, '24h reminder offset'),
        mustFind('apps/backend/services/reminder.service.js', /minutesBefore:\s*30/, '30m reminder offset'),
        mustFind('apps/backend/services/reminder.service.js', /status:\s*'scheduled'/, 'scheduled status writes')
      ])
  },
  {
    id: 'I-2',
    area: 'Reminders',
    title: 'Reminder dispatch route is doctor/admin only',
    method: 'static',
    run: () => mustFind('apps/backend/routes/reminders.routes.js', /roleRequired\('doctor', 'admin'\)/, 'dispatch role gate')
  },
  {
    id: 'J-1',
    area: 'Support and Consent',
    title: 'Helper link, consent grant, and toggle routes exist',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/support.routes.js', /\/helpers/, 'helper create route'),
        mustFind('apps/backend/routes/support.routes.js', /\/helpers\/:helperId\/toggle/, 'helper toggle route'),
        mustFind('apps/backend/routes/support.routes.js', /\/consents/, 'consent route')
      ])
  },
  {
    id: 'J-2',
    area: 'Support and Consent',
    title: 'Revocation trail updates active consents and revokedAt',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/controllers/support.controller.js', /updateMany\(\{[\s\S]*isActive:\s*false,[\s\S]*revokedAt:\s*new Date\(\)/, 'bulk revoke existing consents'),
        mustFind('apps/backend/controllers/support.controller.js', /action:\s*nextActive \? 'helper_activated' : 'helper_deactivated'/, 'audit action for toggle')
      ])
  },
  {
    id: 'L-1',
    area: 'AI',
    title: 'AI routes are auth-protected and rate-limited',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/routes/ai.routes.js', /router\.use\(authRequired\)/, 'auth middleware on AI routes'),
        mustFind('apps/backend/routes/ai.routes.js', /router\.use\(aiLimiter\)/, 'rate limiter middleware')
      ])
  },
  {
    id: 'L-2',
    area: 'AI',
    title: 'AI context endpoint blocks unauthenticated access',
    method: 'runtime',
    run: async () =>
      runtimeCheck('GET /api/ai/context unauthorized', async () => {
        const res = await request(await getApp()).get('/api/ai/context');
        const pass = res.status === 401 && res.body?.code === 'UNAUTHORIZED';
        return {
          pass,
          evidence: `/api/ai/context => ${res.status} code=${res.body?.code || 'none'}`
        };
      })
  },
  {
    id: 'L-3',
    area: 'AI',
    title: 'AI responses expose fallbackUsed metadata',
    method: 'static',
    run: () => mustFind('apps/backend/controllers/ai.controller.js', /fallbackUsed:/, 'fallbackUsed metadata set')
  },
  {
    id: 'L-4',
    area: 'AI',
    title: 'All AI endpoints mark outputs as requiresReview=true',
    method: 'static',
    run: () => mustNotFind('apps/backend/controllers/ai.controller.js', /requiresReview:\s*false/, 'requiresReview false')
  },
  {
    id: 'L-5',
    area: 'AI',
    title: 'UI labels outputs as Draft - requires human review',
    method: 'static',
    run: () => mustFind('apps/frontend/src/App.jsx', /Draft\s*[\u2014-]\s*requires human review/i, 'explicit draft label')
  },
  {
    id: 'L-6',
    area: 'AI',
    title: 'Offline AI draft queue persists and retries',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/App.jsx', /AI_OFFLINE_DRAFTS_KEY/, 'offline storage key'),
        mustFind('apps/frontend/src/App.jsx', /queueOfflineDraft/, 'queue helper'),
        mustFind('apps/frontend/src/App.jsx', /retryAllOfflineDrafts/, 'retry helper')
      ])
  },
  {
    id: 'M-1',
    area: 'Localization',
    title: 'Language widget limits options to approved language codes',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/TranslationService.jsx', /INDIAN_LANGUAGE_CODES/, 'language whitelist'),
        mustFind('apps/frontend/src/TranslationService.jsx', /sanitizeLanguageDropdown/, 'dropdown sanitizer'),
        mustFind('apps/frontend/src/TranslationService.jsx', /option\.remove\(\)/, 'unknown option removal')
      ])
  },
  {
    id: 'M-2',
    area: 'Localization',
    title: 'Material icon tokens are protected from translation',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/frontend/src/TranslationService.jsx', /notranslate/, 'notranslate class application'),
        mustFind('apps/frontend/src/TranslationService.jsx', /data-icon-token/, 'icon token preservation')
      ])
  },
  {
    id: 'NFR-1',
    area: 'Security and Reliability',
    title: 'Helmet CSP is enabled',
    method: 'static',
    run: () => mustFind('apps/backend/server/create-app.js', /helmet\(\{[\s\S]*contentSecurityPolicy:/, 'helmet CSP configuration')
  },
  {
    id: 'NFR-2',
    area: 'Security and Reliability',
    title: 'Request IDs are emitted in API responses and headers',
    method: 'runtime',
    run: async () =>
      runtimeCheck('Request ID exposure', async () => {
        const res = await request(await getApp()).get('/api/session');
        const pass = res.status === 200 && Boolean(res.body?.requestId) && Boolean(res.headers['x-request-id']);
        return {
          pass,
          evidence: `/api/session requestId=${res.body?.requestId || 'none'} header=${res.headers['x-request-id'] || 'none'}`
        };
      })
  },
  {
    id: 'NFR-3',
    area: 'Security and Reliability',
    title: 'Health probes are available',
    method: 'runtime',
    run: async () =>
      runtimeCheck('Health probe endpoints', async () => {
        const live = await request(await getApp()).get('/api/health/live');
        const ready = await request(await getApp()).get('/api/health/ready');
        const pass = live.status === 200 && [200, 503].includes(ready.status);
        return {
          pass,
          evidence: `/api/health/live=${live.status}, /api/health/ready=${ready.status}`
        };
      })
  },
  {
    id: 'NFR-4',
    area: 'Security and Reliability',
    title: 'SPA index no-store and assets immutable caching rules exist',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/server/create-app.js', /Cache-Control.*no-store/, 'index no-store header'),
        mustFind('apps/backend/server/create-app.js', /immutable/, 'immutable asset cache directive')
      ])
  },
  {
    id: 'NFR-5',
    area: 'Security and Reliability',
    title: 'API mode rewrites redirects/renders for JSON clients',
    method: 'static',
    run: () =>
      combineChecks([
        mustFind('apps/backend/middleware/api-mode.js', /res\.redirect = \(statusOrUrl, maybeUrl\) =>/, 'redirect rewrite hook'),
        mustFind('apps/backend/middleware/api-mode.js', /res\.render = \(view, locals = \{\}\) =>/, 'render rewrite hook')
      ])
  },
  {
    id: 'EDGE-1',
    area: 'Edge Cases',
    title: 'Unknown API route returns structured NOT_FOUND payload',
    method: 'runtime',
    run: async () =>
      runtimeCheck('Unknown API route', async () => {
        const res = await request(await getApp()).get('/api/no-such-route');
        const pass = res.status === 404 && res.body?.code === 'NOT_FOUND' && Boolean(res.body?.requestId);
        return {
          pass,
          evidence: `/api/no-such-route => ${res.status} code=${res.body?.code || 'none'}`
        };
      })
  },
  {
    id: 'EDGE-2',
    area: 'Edge Cases',
    title: 'Global rate limit middleware is configured',
    method: 'static',
    run: () => mustFind('apps/backend/server/create-app.js', /rateLimit\(\{[\s\S]*limit:\s*120/, 'global request limiter')
  },
  {
    id: 'EDGE-3',
    area: 'Edge Cases',
    title: 'AI limiter returns explicit AI_RATE_LIMITED code',
    method: 'static',
    run: () => mustFind('apps/backend/routes/ai.routes.js', /AI_RATE_LIMITED/, 'AI limiter error code')
  }
];

function markdownEscape(value) {
  return String(value).replace(/\|/g, '\\|');
}

async function runAllChecks() {
  const startedAt = new Date();
  const results = [];

  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await check.run();
    results.push({
      id: check.id,
      area: check.area,
      title: check.title,
      method: check.method,
      status: outcome.pass ? 'PASS' : 'FAIL',
      evidence: outcome.evidence
    });
  }

  const passed = results.filter((row) => row.status === 'PASS').length;
  const failed = results.filter((row) => row.status === 'FAIL').length;
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed
    },
    checks: results
  };

  const jsonPath = path.join(REPORT_DIR, 'checklist-results.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# QA Checklist Results');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- Duration: ${((Date.now() - startedAt.getTime()) / 1000).toFixed(2)}s`);
  lines.push('');
  lines.push('| ID | Area | Test | Method | Status | Evidence |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (const row of results) {
    lines.push(
      `| ${markdownEscape(row.id)} | ${markdownEscape(row.area)} | ${markdownEscape(row.title)} | ${markdownEscape(
        row.method
      )} | ${markdownEscape(row.status)} | ${markdownEscape(row.evidence)} |`
    );
  }

  const mdPath = path.join(REPORT_DIR, 'checklist-results.md');
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`QA checklist complete: ${passed} passed, ${failed} failed.`);
  // eslint-disable-next-line no-console
  console.log(`Reports written:\n- ${jsonPath}\n- ${mdPath}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runAllChecks()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('QA checklist runner failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeAppIfNeeded();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('QA checklist runner teardown failed:', error);
      process.exitCode = 1;
    }
  });
