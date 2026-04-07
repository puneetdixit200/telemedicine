const { prisma } = require('../models/db');
const {
  createOrderSchema,
  updateOrderStatusSchema
} = require('../models/schemas/pharmacy.schemas');

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

async function getHelperOrderScope(user) {
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

const PHARMACY_ORDER_INCLUDE = {
  patient: { select: { id: true, fullName: true } },
  placedBy: { select: { id: true, fullName: true, role: true } },
  appointment: {
    select: {
      id: true,
      startAt: true,
      doctorId: true,
      doctor: { select: { id: true, fullName: true } },
      familyMember: { select: { id: true, fullName: true } }
    }
  },
  prescription: {
    select: {
      id: true,
      diagnosis: true,
      handoffCode: true,
      pharmacyName: true,
      pharmacyContact: true
    }
  }
};

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item?.name || '').trim(),
      dosage: String(item?.dosage || '').trim(),
      frequency: String(item?.frequency || '').trim(),
      duration: String(item?.duration || '').trim(),
      quantity: Number(item?.quantity) > 0 ? Number(item.quantity) : 1,
      instructions: String(item?.instructions || '').trim()
    }))
    .filter((item) => item.name);
}

function normalizeItemsFromPrescription(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item?.name || '').trim(),
      dosage: String(item?.dosage || '').trim(),
      frequency: String(item?.frequency || '').trim(),
      duration: String(item?.duration || '').trim(),
      quantity: 1,
      instructions: ''
    }))
    .filter((item) => item.name);
}

function summarizeOrders(orders) {
  const summary = {
    placed: 0,
    processing: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0
  };

  orders.forEach((order) => {
    if (summary[order.status] !== undefined) {
      summary[order.status] += 1;
    }
  });

  return summary;
}

function canAccessOrderByRole(user, order, helperScope) {
  if (user.role === 'admin') return true;
  if (user.role === 'patient') return order.patientId === user.id;
  if (user.role === 'doctor') {
    return order.placedById === user.id || order.appointment?.doctorId === user.id;
  }
  if (user.role === 'help_worker') {
    const scope = helperScope || { patientIds: [], appointmentIds: [] };
    return scope.patientIds.includes(order.patientId) || scope.appointmentIds.includes(order.appointmentId);
  }
  return false;
}

async function findAppointmentForOrder(appointmentId) {
  if (!appointmentId) return null;
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      prescription: true,
      doctor: { select: { id: true, fullName: true } },
      patient: { select: { id: true, fullName: true } },
      familyMember: { select: { id: true, fullName: true } }
    }
  });
}

async function findPrescriptionForOrder(prescriptionId) {
  if (!prescriptionId) return null;
  return prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      appointment: {
        include: {
          doctor: { select: { id: true, fullName: true } },
          patient: { select: { id: true, fullName: true } },
          familyMember: { select: { id: true, fullName: true } }
        }
      }
    }
  });
}

const pharmacyController = {
  listOrders: async (req, res, next) => {
    try {
      let where;

      if (req.user.role === 'patient') {
        where = { patientId: req.user.id };
      } else if (req.user.role === 'doctor') {
        where = {
          OR: [{ placedById: req.user.id }, { appointment: { doctorId: req.user.id } }]
        };
      } else if (req.user.role === 'help_worker') {
        const scope = await getHelperOrderScope(req.user);
        const clauses = [];
        if (scope.patientIds.length) clauses.push({ patientId: { in: scope.patientIds } });
        if (scope.appointmentIds.length) clauses.push({ appointmentId: { in: scope.appointmentIds } });
        where = clauses.length ? { OR: clauses } : { id: '__no_access__' };
      } else if (req.user.role === 'admin') {
        where = {};
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const orders = await prisma.pharmacyOrder.findMany({
        where,
        include: PHARMACY_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      return res.render('pharmacy-orders', {
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
      const order = await prisma.pharmacyOrder.findUnique({
        where: { id: req.params.orderId },
        include: PHARMACY_ORDER_INCLUDE
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });

      const helperScope = req.user.role === 'help_worker' ? await getHelperOrderScope(req.user) : null;
      if (!canAccessOrderByRole(req.user, order, helperScope)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.render('pharmacy-order', {
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
      const parsed = createOrderSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid pharmacy order payload.' });
      }

      const appointmentId = parsed.data.appointmentId || null;
      const requestedPrescriptionId = parsed.data.prescriptionId || null;
      const requestedPatientId = parsed.data.patientId || null;

      const [appointment, prescription] = await Promise.all([
        findAppointmentForOrder(appointmentId),
        findPrescriptionForOrder(requestedPrescriptionId)
      ]);

      if (appointmentId && !appointment) {
        return res.status(404).json({ error: 'Appointment not found.' });
      }

      if (requestedPrescriptionId && !prescription) {
        return res.status(404).json({ error: 'Prescription not found.' });
      }

      if (appointment && prescription && prescription.appointmentId !== appointment.id) {
        return res.status(400).json({ error: 'Prescription does not belong to selected appointment.' });
      }

      const linkedAppointment = appointment || prescription?.appointment || null;
      const linkedPrescription = prescription || appointment?.prescription || null;

      if (req.user.role === 'patient') {
        if (linkedAppointment && linkedAppointment.patientId !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else if (req.user.role === 'doctor') {
        if (!linkedAppointment) {
          return res.status(400).json({ error: 'Doctor orders require a linked appointment or prescription.' });
        }
        if (linkedAppointment.doctorId !== req.user.id) {
          return res.status(403).json({ error: 'Only the assigned doctor can place this order.' });
        }
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const derivedPatientId =
        req.user.role === 'patient'
          ? req.user.id
          : linkedAppointment?.patientId || requestedPatientId || null;

      if (!derivedPatientId) {
        return res.status(400).json({ error: 'Patient context is required for pharmacy order.' });
      }

      if (requestedPatientId && requestedPatientId !== derivedPatientId) {
        return res.status(400).json({ error: 'Patient mismatch for selected context.' });
      }

      let items = normalizeOrderItems(parsed.data.items);
      if (!items.length && linkedPrescription?.items) {
        items = normalizeItemsFromPrescription(linkedPrescription.items);
      }

      if (!items.length) {
        return res.status(400).json({ error: 'At least one medicine item is required.' });
      }

      const created = await prisma.pharmacyOrder.create({
        data: {
          patientId: derivedPatientId,
          appointmentId: linkedAppointment?.id || null,
          prescriptionId: linkedPrescription?.id || null,
          placedById: req.user.id,
          pharmacyName: parsed.data.pharmacyName || linkedPrescription?.pharmacyName || null,
          pharmacyContact: parsed.data.pharmacyContact || linkedPrescription?.pharmacyContact || null,
          handoffCode: parsed.data.handoffCode || linkedPrescription?.handoffCode || null,
          deliveryAddress: parsed.data.deliveryAddress || null,
          notes: parsed.data.notes || null,
          status: 'placed',
          items
        },
        include: PHARMACY_ORDER_INCLUDE
      });

      return res.status(201).render('pharmacy-order', {
        user: req.user,
        order: created,
        error: null,
        message: 'Pharmacy order placed.'
      });
    } catch (error) {
      return next(error);
    }
  },

  updateOrderStatus: async (req, res, next) => {
    try {
      const parsed = updateOrderStatusSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid status update.' });
      }

      const order = await prisma.pharmacyOrder.findUnique({
        where: { id: req.params.orderId },
        include: PHARMACY_ORDER_INCLUDE
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const helperScope = req.user.role === 'help_worker' ? await getHelperOrderScope(req.user) : null;
      if (!canAccessOrderByRole(req.user, order, helperScope)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (req.user.role === 'patient' && !['cancelled', 'delivered'].includes(parsed.data.status)) {
        return res.status(403).json({ error: 'Patients can only mark orders as delivered or cancelled.' });
      }

      if (req.user.role === 'help_worker') {
        return res.status(403).json({ error: 'Helpers cannot change order status.' });
      }

      const updated = await prisma.pharmacyOrder.update({
        where: { id: order.id },
        data: { status: parsed.data.status },
        include: PHARMACY_ORDER_INCLUDE
      });

      return res.render('pharmacy-order', {
        user: req.user,
        order: updated,
        error: null,
        message: `Order marked as ${parsed.data.status.replace('_', ' ')}.`
      });
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = { pharmacyController };
