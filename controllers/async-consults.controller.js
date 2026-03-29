const { prisma } = require('../models/db');
const {
  createAsyncConsultSchema,
  addAsyncReplySchema,
  closeAsyncConsultSchema
} = require('../models/schemas/async-consults.schemas');
const { isRecentlyOnline } = require('../services/presence.service');

function isAsyncConsultTableMissing(error) {
  const table = String(error?.meta?.table || '').toLowerCase();
  return Boolean(
    error &&
      error.code === 'P2021' &&
      (table.includes('asyncconsult') || table.includes('asyncconsultreply'))
  );
}

function toPresence(consult) {
  const doctorHeartbeatOnline = isRecentlyOnline(consult.doctor?.lastSeenAt);
  const patientHeartbeatOnline = isRecentlyOnline(consult.patient?.lastSeenAt);

  return {
    doctorOnline: doctorHeartbeatOnline && Boolean(consult.doctor?.doctorProfile?.callEnabled),
    patientOnline: patientHeartbeatOnline
  };
}

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

async function getHelperDelegationScope(user) {
  const phoneWhere = buildHelperPhoneWhere(user.phone);
  if (!phoneWhere.length) {
    return { helperIds: [], patientIds: [], appointmentIds: [] };
  }

  const helperLinks = await prisma.careSupportLink.findMany({
    where: {
      isActive: true,
      OR: phoneWhere
    },
    select: { id: true }
  });

  if (!helperLinks.length) {
    return { helperIds: [], patientIds: [], appointmentIds: [] };
  }

  const helperIds = helperLinks.map((item) => item.id);
  const consentRows = await prisma.consentAudit.findMany({
    where: {
      helperId: { in: helperIds },
      isActive: true,
      scope: { in: ['all', 'async_consult', 'appointment'] }
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
    if (row.scope === 'all' || row.scope === 'async_consult' || (row.scope === 'appointment' && !row.appointmentId)) {
      if (row.patientId) patientIds.add(row.patientId);
    }

    if (row.scope === 'appointment' && row.appointmentId) {
      appointmentIds.add(row.appointmentId);
    }
  });

  return {
    helperIds,
    patientIds: [...patientIds],
    appointmentIds: [...appointmentIds]
  };
}

async function ensureConsultAccess(consultId, user) {
  const consult = await prisma.asyncConsult.findUnique({
    where: { id: consultId },
    include: {
      doctor: {
        select: {
          id: true,
          fullName: true,
          lastSeenAt: true,
          doctorProfile: { select: { callEnabled: true } }
        }
      },
      patient: { select: { id: true, fullName: true, lastSeenAt: true } },
      familyMember: { select: { id: true, fullName: true } },
      appointment: { select: { id: true, startAt: true, status: true } },
      replies: {
        include: { author: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        take: 300
      }
    }
  });

  if (!consult) return null;
  if (user.role === 'admin') return consult;
  if (user.role === 'help_worker') {
    const scope = await getHelperDelegationScope(user);
    const isScopedPatient = scope.patientIds.includes(consult.patientId);
    const isScopedAppointment = consult.appointmentId && scope.appointmentIds.includes(consult.appointmentId);
    if (!isScopedPatient && !isScopedAppointment) return null;
    return consult;
  }
  if (user.id !== consult.patientId && user.id !== consult.doctorId) return null;
  return consult;
}

const asyncConsultsController = {
  listMine: async (req, res, next) => {
    try {
      let where;
      let helperGuidance = null;

      if (req.user.role === 'patient') {
        where = { patientId: req.user.id };
      } else if (req.user.role === 'doctor') {
        where = { doctorId: req.user.id };
      } else if (req.user.role === 'help_worker') {
        const scope = await getHelperDelegationScope(req.user);
        const clauses = [];
        if (scope.patientIds.length) clauses.push({ patientId: { in: scope.patientIds } });
        if (scope.appointmentIds.length) clauses.push({ appointmentId: { in: scope.appointmentIds } });
        where = clauses.length ? { OR: clauses } : { id: '__no_access__' };
        helperGuidance = clauses.length
          ? 'You are viewing async consults delegated to your helper account.'
          : 'No active async-consult delegations are linked to your helper phone yet.';
      } else if (req.user.role === 'admin') {
        where = {};
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const consultations = await prisma.asyncConsult.findMany({
        where,
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
              lastSeenAt: true,
              doctorProfile: { select: { callEnabled: true } }
            }
          },
          patient: { select: { id: true, fullName: true, lastSeenAt: true } },
          familyMember: { select: { id: true, fullName: true } },
          appointment: { select: { id: true, startAt: true, status: true } },
          _count: { select: { replies: true } },
          replies: {
            select: { id: true, authorRole: true, message: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [{ status: 'asc' }, { latestMessageAt: 'desc' }],
        take: 180
      });

      const queueStats = {
        total: consultations.length,
        waitingDoctor: consultations.filter((item) => item.status === 'waiting_doctor').length,
        waitingPatient: consultations.filter((item) => item.status === 'waiting_patient').length,
        closed: consultations.filter((item) => item.status === 'closed').length
      };

      const withPresence = consultations.map((consult) => ({
        ...consult,
        presence: toPresence(consult)
      }));

      return res.render('async-consults', {
        user: req.user,
        consultations: withPresence,
        queueStats,
        unsupported: false,
        guidance: helperGuidance
      });
    } catch (error) {
      if (!isAsyncConsultTableMissing(error)) return next(error);
      return res.render('async-consults', {
        user: req.user,
        consultations: [],
        queueStats: { total: 0, waitingDoctor: 0, waitingPatient: 0, closed: 0 },
        unsupported: true,
        guidance: null
      });
    }
  },

  create: async (req, res, next) => {
    try {
      if (req.user.role !== 'patient' && req.user.role !== 'help_worker') {
        return res.status(403).json({ error: 'Only patients or delegated help workers can start asynchronous consults.' });
      }

      const parsed = createAsyncConsultSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid async consult details.' });
      }

      const doctor = await prisma.user.findUnique({
        where: { id: parsed.data.doctorId },
        include: { doctorProfile: true }
      });
      if (!doctor || doctor.role !== 'doctor' || !doctor.isActive) {
        return res.status(404).json({ error: 'Doctor not found for this async consult.' });
      }

      let patientId = req.user.id;
      if (req.user.role === 'help_worker') {
        const requestedPatientId = parsed.data.patientId || null;
        if (!requestedPatientId) {
          return res.status(400).json({ error: 'Select a delegated patient for this async consult.' });
        }

        const scope = await getHelperDelegationScope(req.user);
        if (!scope.patientIds.includes(requestedPatientId)) {
          return res.status(403).json({ error: 'You do not have active consent to start async consults for this patient.' });
        }

        patientId = requestedPatientId;
      }

      const familyMemberId = parsed.data.familyMemberId || null;
      if (familyMemberId) {
        const member = await prisma.familyMember.findFirst({
          where: { id: familyMemberId, ownerPatientId: patientId }
        });
        if (!member) {
          return res.status(404).json({ error: 'Family member not found.' });
        }
      }

      const appointmentId = parsed.data.appointmentId || null;
      if (appointmentId) {
        const appointment = await prisma.appointment.findFirst({
          where: { id: appointmentId, patientId, doctorId: doctor.id }
        });
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found for this doctor.' });
        }
      }

      const consult = await prisma.asyncConsult.create({
        data: {
          patientId,
          doctorId: doctor.id,
          familyMemberId,
          appointmentId,
          subject: parsed.data.subject,
          symptoms: parsed.data.symptoms,
          preferredLanguage: parsed.data.preferredLanguage || null,
          priority: parsed.data.priority,
          status: 'waiting_doctor',
          latestMessageAt: new Date(),
          replies: {
            create: {
              authorRole: req.user.role === 'help_worker' ? 'helper' : 'patient',
              authorId: req.user.id,
              authorName: req.user.fullName,
              message: parsed.data.symptoms
            }
          }
        }
      });

      return res.json({
        ok: true,
        consultId: consult.id,
        redirectTo: `/async-consults/${consult.id}`
      });
    } catch (error) {
      if (!isAsyncConsultTableMissing(error)) return next(error);
      return res.status(503).json({ error: 'Async consult tables are missing. Apply latest database migration.' });
    }
  },

  viewOne: async (req, res, next) => {
    try {
      const consult = await ensureConsultAccess(req.params.consultId, req.user);
      if (!consult) return res.status(404).json({ error: 'Async consult not found.' });

      return res.render('async-consult-detail', {
        user: req.user,
        consult,
        presence: toPresence(consult),
        canReply: consult.status !== 'closed',
        unsupported: false
      });
    } catch (error) {
      if (!isAsyncConsultTableMissing(error)) return next(error);
      return res.status(503).json({ error: 'Async consult tables are missing. Apply latest database migration.' });
    }
  },

  addReply: async (req, res, next) => {
    try {
      const parsed = addAsyncReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Reply message is required.' });
      }

      const consult = await ensureConsultAccess(req.params.consultId, req.user);
      if (!consult) return res.status(404).json({ error: 'Async consult not found.' });
      if (consult.status === 'closed') {
        return res.status(409).json({ error: 'Consultation is closed.' });
      }

      const isDoctor = req.user.id === consult.doctorId;
      const isHelper = req.user.role === 'help_worker';
      const nextStatus = isDoctor ? 'waiting_patient' : 'waiting_doctor';
      const authorRole = isDoctor ? 'doctor' : isHelper ? 'helper' : 'patient';

      await prisma.$transaction(async (tx) => {
        await tx.asyncConsultReply.create({
          data: {
            consultId: consult.id,
            authorRole,
            authorId: req.user.id,
            authorName: req.user.fullName,
            message: parsed.data.message
          }
        });

        await tx.asyncConsult.update({
          where: { id: consult.id },
          data: {
            status: nextStatus,
            latestMessageAt: new Date()
          }
        });
      });

      const refreshed = await ensureConsultAccess(req.params.consultId, req.user);
      return res.json({ ok: true, consult: refreshed, presence: toPresence(refreshed) });
    } catch (error) {
      if (!isAsyncConsultTableMissing(error)) return next(error);
      return res.status(503).json({ error: 'Async consult tables are missing. Apply latest database migration.' });
    }
  },

  close: async (req, res, next) => {
    try {
      const parsed = closeAsyncConsultSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid close reason.' });
      }

      const consult = await ensureConsultAccess(req.params.consultId, req.user);
      if (!consult) return res.status(404).json({ error: 'Async consult not found.' });
      if (consult.status === 'closed') return res.json({ ok: true, consultId: consult.id, status: 'closed' });

      await prisma.$transaction(async (tx) => {
        if (parsed.data.reason) {
          await tx.asyncConsultReply.create({
            data: {
              consultId: consult.id,
              authorRole: 'system',
              authorId: req.user.id,
              authorName: req.user.fullName,
              message: `Conversation closed: ${parsed.data.reason}`
            }
          });
        }

        await tx.asyncConsult.update({
          where: { id: consult.id },
          data: {
            status: 'closed',
            latestMessageAt: new Date()
          }
        });
      });

      return res.json({ ok: true, consultId: consult.id, status: 'closed' });
    } catch (error) {
      if (!isAsyncConsultTableMissing(error)) return next(error);
      return res.status(503).json({ error: 'Async consult tables are missing. Apply latest database migration.' });
    }
  }
};

module.exports = { asyncConsultsController };
