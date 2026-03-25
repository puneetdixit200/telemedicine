const jwt = require('jsonwebtoken');
const { prisma } = require('../models/db');
const { getAppointmentPresence } = require('../services/presence.service');

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { include: { doctorProfile: true } },
      patient: { select: { id: true, fullName: true, lastSeenAt: true } }
    }
  });
  if (!appt) return null;
  if (user.role === 'admin') return appt;
  if (user.id !== appt.patientId && user.id !== appt.doctorId) return null;
  return appt;
}

const callsController = {
  viewCall: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });

      const presence = getAppointmentPresence(appt);
      if (!presence.canStartCall) {
        return res.status(403).render('dashboard', {
          user: req.user,
          message: 'Both doctor and patient must be online to start the call.'
        });
      }

      await prisma.callSession.upsert({
        where: { appointmentId },
        update: {},
        create: { appointmentId, status: 'ready' }
      });

      // Short-lived token for Socket.IO auth (cookie is HttpOnly).
      const socketToken = jwt.sign({ sub: req.user.id, role: req.user.role }, process.env.JWT_SECRET, {
        expiresIn: '15m'
      });

      const callConfigJson = JSON.stringify({
        appointmentId: appt.id,
        socketToken,
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        defaultMode: appt.mode
      });
      const callConfigEncoded = encodeURIComponent(callConfigJson);

      return res.render('call', {
        user: req.user,
        appointment: appt,
        socketToken,
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        callConfigJson,
        callConfigEncoded
      });
    } catch (e) {
      return next(e);
    }
  },

  endCall: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).json({ error: 'Not found' });

      await prisma.callSession.updateMany({
        where: { appointmentId },
        data: { status: 'ended', endedAt: new Date() }
      });

      return res.redirect(`/appointments/${appointmentId}`);
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { callsController };
