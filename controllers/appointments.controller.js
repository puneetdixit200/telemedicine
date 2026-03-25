const { prisma } = require('../models/db');
const { bookSchema, preconsultSchema } = require('../models/schemas/appointments.schemas');
const { getAppointmentPresence } = require('../services/presence.service');

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { include: { doctorProfile: true } },
      patient: { include: { patientProfile: true } },
      familyMember: true,
      documents: true,
      prescription: true
    }
  });
  if (!appt) return null;
  if (user.role === 'admin') return appt;
  if (user.id !== appt.patientId && user.id !== appt.doctorId) return null;
  return appt;
}

async function loadPatientHistory(appointment) {
  const where = appointment.familyMemberId
    ? { patientId: appointment.patientId, familyMemberId: appointment.familyMemberId, status: 'completed' }
    : { patientId: appointment.patientId, familyMemberId: null, status: 'completed' };

  const historyAppointments = await prisma.appointment.findMany({
    where: {
      ...where,
      id: { not: appointment.id }
    },
    include: {
      doctor: { select: { fullName: true } },
      prescription: true
    },
    orderBy: { startAt: 'desc' },
    take: 20
  });

  return {
    currentPatientProfile: appointment.familyMember
      ? {
          name: appointment.familyMember.fullName,
          chronicConditions: appointment.familyMember.chronicConditions,
          basicHealthInfo: appointment.familyMember.basicHealthInfo,
          relationToPatient: appointment.familyMember.relationToPatient
        }
      : {
          name: appointment.patient.fullName,
          chronicConditions: appointment.patient.patientProfile?.chronicConditions || null,
          basicHealthInfo: appointment.patient.patientProfile?.basicHealthInfo || null,
          relationToPatient: null
        },
    historyAppointments
  };
}

async function loadWorkspaceDocuments(appointment) {
  const where = {
    ownerId: appointment.patientId,
    appointmentId: null,
    familyMemberId: appointment.familyMemberId || null
  };

  return prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

const appointmentsController = {
  listMyAppointments: async (req, res, next) => {
    try {
      const where =
        req.user.role === 'doctor'
          ? { doctorId: req.user.id }
          : req.user.role === 'patient'
            ? { patientId: req.user.id }
            : {};

      const appointments = await prisma.appointment.findMany({
        where,
        include: {
          doctor: { select: { id: true, fullName: true } },
          patient: { select: { id: true, fullName: true } },
          familyMember: { select: { id: true, fullName: true } },
          prescription: { select: { id: true } }
        },
        orderBy: { startAt: 'desc' },
        take: 300
      });

      const now = new Date();
      const upcomingAppointments = appointments
        .filter((a) => a.status === 'booked' && new Date(a.startAt) >= now)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

      const doneAppointments = appointments
        .filter((a) => !(a.status === 'booked' && new Date(a.startAt) >= now))
        .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));

      return res.render('appointments', {
        user: req.user,
        upcomingAppointments,
        doneAppointments
      });
    } catch (e) {
      return next(e);
    }
  },

  viewAppointment: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });

      const presence = getAppointmentPresence(appt);
      const history = await loadPatientHistory(appt);
      const workspaceDocuments = await loadWorkspaceDocuments(appt);
      const familyMembers =
        req.user.role === 'patient' && req.user.id === appt.patientId
          ? await prisma.familyMember.findMany({
              where: { ownerPatientId: req.user.id },
              orderBy: { fullName: 'asc' }
            })
          : [];

      return res.render('appointment', {
        user: req.user,
        appointment: appt,
        presence,
        history,
        workspaceDocuments,
        familyMembers,
        error: null,
        message: null
      });
    } catch (e) {
      return next(e);
    }
  },

  getPresence: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).json({ error: 'Appointment not found' });

      const presence = getAppointmentPresence(appt);
      return res.json({ ok: true, ...presence });
    } catch (e) {
      return next(e);
    }
  },

  book: async (req, res, next) => {
    try {
      const parsed = bookSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).render('dashboard', { user: req.user, message: 'Invalid booking request' });

      const { slotId, mode } = parsed.data;
      const familyMemberId = parsed.data.familyMemberId || null;

      if (familyMemberId) {
        const member = await prisma.familyMember.findFirst({
          where: { id: familyMemberId, ownerPatientId: req.user.id }
        });
        if (!member) {
          return res.status(403).render('dashboard', { user: req.user, message: 'Invalid family member selection.' });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.slot.updateMany({
          where: { id: slotId, status: 'available' },
          data: { status: 'booked' }
        });
        if (updated.count !== 1) {
          const err = new Error('Slot is not available.');
          err.status = 409;
          throw err;
        }

        const slot = await tx.slot.findUnique({ where: { id: slotId } });
        if (!slot) {
          const err = new Error('Slot not found.');
          err.status = 404;
          throw err;
        }

        const appt = await tx.appointment.create({
          data: {
            patientId: req.user.id,
            doctorId: slot.doctorId,
            startAt: slot.startAt,
            mode,
            status: 'booked',
            slotId: slot.id,
            familyMemberId
          }
        });

        await tx.slot.update({
          where: { id: slot.id },
          data: { appointment: { connect: { id: appt.id } } }
        });

        return appt;
      });

      return res.redirect(`/appointments/${result.id}`);
    } catch (e) {
      if (req.accepts('html')) {
        return res.status(e.status || 500).render('dashboard', { user: req.user, message: e.message || 'Booking failed' });
      }
      return next(e);
    }
  },

  updatePreconsult: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const parsed = preconsultSchema.safeParse(req.body);
      if (!parsed.success) {
        const appt = await ensureAppointmentAccess(appointmentId, req.user);
        const history = appt ? await loadPatientHistory(appt) : null;
        const familyMembers =
          appt && req.user.role === 'patient' && req.user.id === appt.patientId
            ? await prisma.familyMember.findMany({
                where: { ownerPatientId: req.user.id },
                orderBy: { fullName: 'asc' }
              })
            : [];
        return res.status(400).render('appointment', {
          user: req.user,
          appointment: appt,
          presence: appt ? getAppointmentPresence(appt) : null,
          history,
          workspaceDocuments: appt ? await loadWorkspaceDocuments(appt) : [],
          familyMembers,
          error: 'Invalid input',
          message: null
        });
      }

      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });
      if (appt.status !== 'booked') {
        return res.status(409).render('dashboard', { user: req.user, message: 'Appointment already closed.' });
      }
      if (appt.status !== 'booked') {
        return res.status(409).render('appointment', {
          user: req.user,
          appointment: appt,
          presence: getAppointmentPresence(appt),
          history: await loadPatientHistory(appt),
          workspaceDocuments: await loadWorkspaceDocuments(appt),
          familyMembers: await prisma.familyMember.findMany({ where: { ownerPatientId: req.user.id }, orderBy: { fullName: 'asc' } }),
          error: 'Appointment is closed. Editing is not allowed.',
          message: null
        });
      }
      if (req.user.role !== 'patient' || req.user.id !== appt.patientId) {
        const familyMembers =
          req.user.role === 'patient' && req.user.id === appt.patientId
            ? await prisma.familyMember.findMany({
                where: { ownerPatientId: req.user.id },
                orderBy: { fullName: 'asc' }
              })
            : [];
        return res.status(403).render('appointment', {
          user: req.user,
          appointment: appt,
          presence: getAppointmentPresence(appt),
          history: await loadPatientHistory(appt),
          workspaceDocuments: await loadWorkspaceDocuments(appt),
          familyMembers,
          error: 'Only patient can update this.',
          message: null
        });
      }

      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          problemDescription: parsed.data.problemDescription || null,
          medicationsText: parsed.data.medicationsText || null
        },
        include: {
          doctor: { include: { doctorProfile: true } },
          patient: { include: { patientProfile: true } },
          documents: true,
          prescription: true
        }
      });

      const familyMembers = await prisma.familyMember.findMany({
        where: { ownerPatientId: req.user.id },
        orderBy: { fullName: 'asc' }
      });
      return res.render('appointment', {
        user: req.user,
        appointment: updated,
        presence: getAppointmentPresence(updated),
        history: await loadPatientHistory(updated),
        workspaceDocuments: await loadWorkspaceDocuments(updated),
        familyMembers,
        error: null,
        message: 'Saved.'
      });
    } catch (e) {
      return next(e);
    }
  },

  cancel: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });

      if (req.user.role !== 'admin' && req.user.id !== appt.doctorId) {
        return res.status(403).render('dashboard', { user: req.user, message: 'Forbidden' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: 'cancelled' }
        });
        if (appt.slotId) {
          await tx.slot.update({ where: { id: appt.slotId }, data: { status: 'available', appointment: { disconnect: true } } });
        }
      });

      return res.redirect('/appointments');
    } catch (e) {
      return next(e);
    }
  }
,

  endAppointment: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });

      if (req.user.role !== 'admin' && req.user.id !== appt.patientId && req.user.id !== appt.doctorId) {
        return res.status(403).render('dashboard', { user: req.user, message: 'Forbidden' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: 'completed' }
        });
        await tx.callSession.updateMany({
          where: { appointmentId },
          data: { status: 'ended', endedAt: new Date() }
        });
      });

      return res.redirect(`/appointments/${appointmentId}`);
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { appointmentsController };
