const { prisma } = require('../models/db');
const {
  createCatalogTestSchema,
  createLabOrderSchema,
  updateLabOrderStatusSchema,
  attachLabReportSchema
} = require('../models/schemas/labs.schemas');

const DEFAULT_LAB_TESTS = [
  {
    code: 'CBC',
    name: 'Complete Blood Count',
    category: 'Hematology',
    sampleType: 'Blood',
    fastingRequired: false,
    turnaroundHours: 24,
    priceCents: 60000
  },
  {
    code: 'LFT',
    name: 'Liver Function Test',
    category: 'Biochemistry',
    sampleType: 'Blood',
    fastingRequired: true,
    turnaroundHours: 36,
    priceCents: 90000
  },
  {
    code: 'KFT',
    name: 'Kidney Function Test',
    category: 'Biochemistry',
    sampleType: 'Blood',
    fastingRequired: true,
    turnaroundHours: 36,
    priceCents: 90000
  },
  {
    code: 'HBA1C',
    name: 'HbA1c',
    category: 'Diabetes',
    sampleType: 'Blood',
    fastingRequired: false,
    turnaroundHours: 48,
    priceCents: 75000
  },
  {
    code: 'TSH',
    name: 'Thyroid Stimulating Hormone',
    category: 'Hormones',
    sampleType: 'Blood',
    fastingRequired: false,
    turnaroundHours: 48,
    priceCents: 70000
  }
];

function normalizePhone(value) {
  return String(value || '')
    .replace(/[^0-9]/g, '')
    .trim();
}

function buildHelperPhoneWhere(phone) {
  const raw = String(phone || '').trim();
  const normalized = normalizePhone(phone);
  const tail10 = normalized.length >= 10 ? normalized.slice(-10) : '';

  const where = [];
  if (raw) where.push({ helperPhone: raw });
  if (normalized) where.push({ helperPhone: normalized });
  if (tail10) where.push({ helperPhone: { endsWith: tail10 } });
  return where;
}

async function getHelperLabScope(user) {
  const phoneWhere = buildHelperPhoneWhere(user.phone);
  if (!phoneWhere.length) {
    return { patientIds: [], appointmentIds: [] };
  }

  const helperLinks = await prisma.careSupportLink.findMany({
    where: {
      isActive: true,
      OR: phoneWhere
    },
    select: { id: true }
  });

  if (!helperLinks.length) {
    return { patientIds: [], appointmentIds: [] };
  }

  const helperIds = helperLinks.map((row) => row.id);
  const consentRows = await prisma.consentAudit.findMany({
    where: {
      helperId: { in: helperIds },
      isActive: true,
      scope: { in: ['all', 'appointment', 'records'] }
    },
    select: {
      patientId: true,
      appointmentId: true,
      scope: true
    }
  });

  const patientIds = new Set();
  const appointmentIds = new Set();

  consentRows.forEach((row) => {
    if (row.scope === 'all' || row.scope === 'records' || (row.scope === 'appointment' && !row.appointmentId)) {
      if (row.patientId) patientIds.add(row.patientId);
    }
    if (row.scope === 'appointment' && row.appointmentId) {
      appointmentIds.add(row.appointmentId);
    }
  });

  return {
    patientIds: [...patientIds],
    appointmentIds: [...appointmentIds]
  };
}

const LAB_ORDER_INCLUDE = {
  patient: { select: { id: true, fullName: true } },
  orderedByDoctor: { select: { id: true, fullName: true } },
  appointment: {
    select: {
      id: true,
      startAt: true,
      doctorId: true,
      doctor: { select: { id: true, fullName: true } }
    }
  },
  familyMember: { select: { id: true, fullName: true } },
  reportDocument: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
  items: {
    include: {
      catalogTest: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          sampleType: true,
          fastingRequired: true,
          turnaroundHours: true,
          priceCents: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  }
};

async function ensureDefaultCatalog() {
  const count = await prisma.labTestCatalog.count();
  if (count > 0) return;

  await prisma.labTestCatalog.createMany({
    data: DEFAULT_LAB_TESTS,
    skipDuplicates: true
  });
}

function summarizeOrders(orders) {
  const summary = {
    requested: 0,
    sample_collected: 0,
    processing: 0,
    report_ready: 0,
    completed: 0,
    cancelled: 0
  };

  orders.forEach((order) => {
    if (summary[order.status] !== undefined) {
      summary[order.status] += 1;
    }
  });

  return summary;
}

function canAccessLabOrder(user, order, helperScope) {
  if (user.role === 'admin') return true;
  if (user.role === 'patient') return order.patientId === user.id;
  if (user.role === 'doctor') {
    return order.orderedByDoctorId === user.id || order.appointment?.doctorId === user.id;
  }
  if (user.role === 'help_worker') {
    const scope = helperScope || { patientIds: [], appointmentIds: [] };
    return scope.patientIds.includes(order.patientId) || scope.appointmentIds.includes(order.appointmentId);
  }
  return false;
}

async function findOrderAppointment(appointmentId) {
  if (!appointmentId) return null;
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { select: { id: true, fullName: true } },
      patient: { select: { id: true, fullName: true } },
      familyMember: { select: { id: true, fullName: true } }
    }
  });
}

const labsController = {
  listCatalog: async (req, res, next) => {
    try {
      await ensureDefaultCatalog();

      const category = String(req.query.category || '').trim();
      const includeInactive = req.user.role === 'admin' && req.query.includeInactive === '1';

      const tests = await prisma.labTestCatalog.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(category ? { category: { contains: category, mode: 'insensitive' } } : {})
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: 300
      });

      return res.render('lab-catalog', {
        user: req.user,
        tests,
        category,
        includeInactive,
        error: null,
        message: null
      });
    } catch (error) {
      return next(error);
    }
  },

  createCatalogTest: async (req, res, next) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only doctors or admins can add catalog tests.' });
      }

      const parsed = createCatalogTestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid catalog test payload.' });
      }

      const created = await prisma.labTestCatalog.upsert({
        where: { code: parsed.data.code.trim().toUpperCase() },
        update: {
          name: parsed.data.name,
          category: parsed.data.category || null,
          sampleType: parsed.data.sampleType || null,
          fastingRequired: Boolean(parsed.data.fastingRequired),
          turnaroundHours: parsed.data.turnaroundHours ?? null,
          priceCents: parsed.data.priceCents ?? null,
          isActive: parsed.data.isActive ?? true
        },
        create: {
          code: parsed.data.code.trim().toUpperCase(),
          name: parsed.data.name,
          category: parsed.data.category || null,
          sampleType: parsed.data.sampleType || null,
          fastingRequired: Boolean(parsed.data.fastingRequired),
          turnaroundHours: parsed.data.turnaroundHours ?? null,
          priceCents: parsed.data.priceCents ?? null,
          isActive: parsed.data.isActive ?? true
        }
      });

      return res.status(201).json({ ok: true, test: created });
    } catch (error) {
      return next(error);
    }
  },

  listOrders: async (req, res, next) => {
    try {
      let where;

      if (req.user.role === 'patient') {
        where = { patientId: req.user.id };
      } else if (req.user.role === 'doctor') {
        where = {
          OR: [{ orderedByDoctorId: req.user.id }, { appointment: { doctorId: req.user.id } }]
        };
      } else if (req.user.role === 'help_worker') {
        const scope = await getHelperLabScope(req.user);
        const clauses = [];
        if (scope.patientIds.length) clauses.push({ patientId: { in: scope.patientIds } });
        if (scope.appointmentIds.length) clauses.push({ appointmentId: { in: scope.appointmentIds } });
        where = clauses.length ? { OR: clauses } : { id: '__no_access__' };
      } else if (req.user.role === 'admin') {
        where = {};
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const orders = await prisma.labOrder.findMany({
        where,
        include: LAB_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 240
      });

      return res.render('lab-orders', {
        user: req.user,
        orders,
        summary: summarizeOrders(orders),
        error: null,
        message: null
      });
    } catch (error) {
      return next(error);
    }
  },

  viewOrder: async (req, res, next) => {
    try {
      const order = await prisma.labOrder.findUnique({
        where: { id: req.params.orderId },
        include: LAB_ORDER_INCLUDE
      });
      if (!order) return res.status(404).json({ error: 'Lab order not found' });

      const helperScope = req.user.role === 'help_worker' ? await getHelperLabScope(req.user) : null;
      if (!canAccessLabOrder(req.user, order, helperScope)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.render('lab-order', {
        user: req.user,
        order,
        error: null,
        message: null
      });
    } catch (error) {
      return next(error);
    }
  },

  createOrder: async (req, res, next) => {
    try {
      const parsed = createLabOrderSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid lab order payload.' });
      }

      const appointmentId = parsed.data.appointmentId || null;
      const requestedPatientId = parsed.data.patientId || null;
      let familyMemberId = parsed.data.familyMemberId || null;

      const appointment = await findOrderAppointment(appointmentId);
      if (appointmentId && !appointment) {
        return res.status(404).json({ error: 'Appointment not found.' });
      }

      if (req.user.role === 'patient') {
        if (appointment && appointment.patientId !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else if (req.user.role === 'doctor') {
        if (!appointment) {
          return res.status(400).json({ error: 'Doctor lab orders require an appointment context.' });
        }
        if (appointment.doctorId !== req.user.id) {
          return res.status(403).json({ error: 'Only assigned doctor can order tests for this appointment.' });
        }
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const patientId =
        req.user.role === 'patient'
          ? req.user.id
          : appointment?.patientId || requestedPatientId || null;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient context is required.' });
      }

      if (requestedPatientId && requestedPatientId !== patientId) {
        return res.status(400).json({ error: 'Patient mismatch for selected context.' });
      }

      if (appointment?.familyMemberId) {
        familyMemberId = appointment.familyMemberId;
      }

      if (familyMemberId) {
        const familyMember = await prisma.familyMember.findFirst({
          where: {
            id: familyMemberId,
            ownerPatientId: patientId
          },
          select: { id: true }
        });
        if (!familyMember) {
          return res.status(400).json({ error: 'Invalid family member for this patient.' });
        }
      }

      const catalogIds = parsed.data.testCatalogIds || [];
      const catalogTests = catalogIds.length
        ? await prisma.labTestCatalog.findMany({
            where: { id: { in: catalogIds }, isActive: true },
            select: {
              id: true,
              name: true,
              sampleType: true,
              priceCents: true
            }
          })
        : [];

      if (catalogTests.length !== catalogIds.length) {
        return res.status(400).json({ error: 'One or more selected lab tests are unavailable.' });
      }

      const customTests = parsed.data.customTests || [];
      const itemPayload = [
        ...catalogTests.map((test) => ({
          catalogTestId: test.id,
          testName: test.name,
          sampleType: test.sampleType || null,
          instructions: null,
          priceCents: test.priceCents ?? null
        })),
        ...customTests.map((test) => ({
          catalogTestId: null,
          testName: test.name,
          sampleType: test.sampleType || null,
          instructions: test.instructions || null,
          priceCents: test.priceCents ?? null
        }))
      ];

      if (!itemPayload.length) {
        return res.status(400).json({ error: 'Select at least one test for the lab order.' });
      }

      const created = await prisma.labOrder.create({
        data: {
          patientId,
          appointmentId,
          orderedByDoctorId: req.user.role === 'doctor' ? req.user.id : appointment?.doctorId || null,
          familyMemberId,
          status: 'requested',
          clinicalNotes: parsed.data.clinicalNotes || null,
          items: {
            create: itemPayload
          }
        },
        include: LAB_ORDER_INCLUDE
      });

      return res.status(201).render('lab-order', {
        user: req.user,
        order: created,
        error: null,
        message: 'Lab order created.'
      });
    } catch (error) {
      return next(error);
    }
  },

  updateOrderStatus: async (req, res, next) => {
    try {
      const parsed = updateLabOrderStatusSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid lab status update.' });
      }

      const order = await prisma.labOrder.findUnique({
        where: { id: req.params.orderId },
        include: LAB_ORDER_INCLUDE
      });
      if (!order) return res.status(404).json({ error: 'Lab order not found' });

      const helperScope = req.user.role === 'help_worker' ? await getHelperLabScope(req.user) : null;
      if (!canAccessLabOrder(req.user, order, helperScope)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (req.user.role === 'patient' && parsed.data.status !== 'cancelled') {
        return res.status(403).json({ error: 'Patients can only cancel a lab order.' });
      }

      if (req.user.role === 'help_worker') {
        return res.status(403).json({ error: 'Helpers cannot change lab order status.' });
      }

      const updated = await prisma.labOrder.update({
        where: { id: order.id },
        data: { status: parsed.data.status },
        include: LAB_ORDER_INCLUDE
      });

      return res.render('lab-order', {
        user: req.user,
        order: updated,
        error: null,
        message: `Lab order marked as ${parsed.data.status.replace('_', ' ')}.`
      });
    } catch (error) {
      return next(error);
    }
  },

  attachReport: async (req, res, next) => {
    try {
      const parsed = attachLabReportSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid report attachment request.' });
      }

      const [order, document] = await Promise.all([
        prisma.labOrder.findUnique({ where: { id: req.params.orderId }, include: LAB_ORDER_INCLUDE }),
        prisma.document.findUnique({ where: { id: parsed.data.documentId } })
      ]);

      if (!order) return res.status(404).json({ error: 'Lab order not found' });
      if (!document) return res.status(404).json({ error: 'Document not found' });

      if (req.user.role !== 'doctor' && req.user.role !== 'admin' && !(req.user.role === 'patient' && req.user.id === order.patientId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (!String(document.contentType || '').toLowerCase().includes('pdf')) {
        return res.status(415).json({ error: 'Only PDF reports can be linked to lab orders.' });
      }

      if (document.ownerId !== order.patientId) {
        return res.status(403).json({ error: 'Report document must belong to the same patient.' });
      }

      if (order.appointmentId && document.appointmentId && document.appointmentId !== order.appointmentId) {
        return res.status(400).json({ error: 'Report document appointment does not match this lab order.' });
      }

      const updated = await prisma.labOrder.update({
        where: { id: order.id },
        data: {
          reportDocumentId: document.id,
          status: order.status === 'completed' ? 'completed' : 'report_ready'
        },
        include: LAB_ORDER_INCLUDE
      });

      return res.render('lab-order', {
        user: req.user,
        order: updated,
        error: null,
        message: 'Lab report linked successfully.'
      });
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = { labsController };
