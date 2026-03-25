const { z } = require('zod');
const { prisma } = require('../models/db');
const { getAppointmentPresence } = require('../services/presence.service');

const bookSchema = z.object({
  slotId: z.string().uuid(),
  mode: z.enum(['video', 'audio', 'text']).default('video')
});

const preconsultSchema = z.object({
  problemDescription: z.string().max(4000).optional().or(z.literal('')),
  medicationsText: z.string().max(4000).optional().or(z.literal(''))
});

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { include: { doctorProfile: true } },
      patient: { include: { patientProfile: true } },
      documents: true,
      prescription: true
    }
  });
  if (!appt) return null;
  if (user.role === 'admin') return appt;
  if (user.id !== appt.patientId && user.id !== appt.doctorId) return null;
  return appt;
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
          prescription: { select: { id: true } }
        },
        orderBy: { startAt: 'asc' },
        take: 100
      });

      return res.render('appointments', { user: req.user, appointments });
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

      return res.render('appointment', { user: req.user, appointment: appt, presence, error: null, message: null });
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
            slotId: slot.id
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
        return res.status(400).render('appointment', {
          user: req.user,
          appointment: appt,
          presence: appt ? getAppointmentPresence(appt) : null,
          error: 'Invalid input',
          message: null
        });
      }

      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });
      if (req.user.role !== 'patient' || req.user.id !== appt.patientId) {
        return res.status(403).render('appointment', {
          user: req.user,
          appointment: appt,
          presence: getAppointmentPresence(appt),
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

      return res.render('appointment', {
        user: req.user,
        appointment: updated,
        presence: getAppointmentPresence(updated),
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

      if (req.user.role !== 'admin' && req.user.id !== appt.patientId && req.user.id !== appt.doctorId) {
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
};

module.exports = { appointmentsController };
