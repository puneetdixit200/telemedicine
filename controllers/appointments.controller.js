const { prisma } = require('../models/db');
const { bookSchema, preconsultSchema, reviewSchema } = require('../models/schemas/appointments.schemas');
const { getAppointmentPresence } = require('../services/presence.service');

function isMissingDoctorReviewTable(error) {
  return Boolean(
    error &&
      error.code === 'P2021' &&
      String(error.meta?.table || '')
        .toLowerCase()
        .includes('doctorreview')
  );
}

async function ensureAppointmentAccess(appointmentId, user) {
  let appt;
  try {
    appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { include: { doctorProfile: true } },
        patient: { include: { patientProfile: true } },
        familyMember: true,
        documents: true,
        prescription: true,
        review: true
      }
    });
  } catch (error) {
    if (!isMissingDoctorReviewTable(error)) throw error;
    appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { include: { doctorProfile: true } },
        patient: { include: { patientProfile: true } },
        familyMember: true,
        documents: true,
        prescription: true
      }
    });
    if (appt) {
      appt.review = null;
    }
  }

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

function computeTriage(problemDescription) {
  const text = String(problemDescription || '').toLowerCase();
  if (!text) return { level: 'unknown', score: 0, label: 'Not assessed' };

  const criticalTerms = ['chest pain', 'breathing', 'unconscious', 'stroke', 'seizure', 'bleeding heavily'];
  const urgentTerms = ['high fever', 'severe pain', 'vomiting', 'dehydration', 'infection', 'wheezing'];
  const moderateTerms = ['headache', 'rash', 'fatigue', 'cough', 'sore throat', 'stomach pain'];

  let score = 0;
  criticalTerms.forEach((t) => {
    if (text.includes(t)) score += 3;
  });
  urgentTerms.forEach((t) => {
    if (text.includes(t)) score += 2;
  });
  moderateTerms.forEach((t) => {
    if (text.includes(t)) score += 1;
  });

  if (score >= 6) return { level: 'critical', score, label: 'Critical' };
  if (score >= 3) return { level: 'high', score, label: 'High' };
  if (score >= 1) return { level: 'moderate', score, label: 'Moderate' };
  return { level: 'low', score, label: 'Low' };
}

function buildReminderInfo(startAt) {
  const now = Date.now();
  const startMs = new Date(startAt).getTime();
  const diffMins = Math.round((startMs - now) / 60000);

  if (Number.isNaN(diffMins)) {
    return { dueSoon: false, label: 'Schedule unavailable', minutesUntil: null };
  }
  if (diffMins <= 0) {
    return { dueSoon: true, label: 'Session time reached', minutesUntil: diffMins };
  }
  if (diffMins <= 30) {
    return { dueSoon: true, label: 'Reminder: starts in under 30 minutes', minutesUntil: diffMins };
  }
  if (diffMins <= 24 * 60) {
    return { dueSoon: true, label: 'Reminder: starts within 24 hours', minutesUntil: diffMins };
  }
  return { dueSoon: false, label: 'No reminder yet', minutesUntil: diffMins };
}

async function renderAppointmentPage(res, reqUser, appointment, opts = {}) {
  const history = await loadPatientHistory(appointment);
  const workspaceDocuments = await loadWorkspaceDocuments(appointment);
  const familyMembers =
    opts.familyMembers ||
    (reqUser.role === 'patient' && reqUser.id === appointment.patientId
      ? await prisma.familyMember.findMany({
          where: { ownerPatientId: reqUser.id },
          orderBy: { fullName: 'asc' }
        })
      : []);

  return res.render('appointment', {
    user: reqUser,
    appointment,
    presence: getAppointmentPresence(appointment),
    history,
    workspaceDocuments,
    familyMembers,
    triage: computeTriage(appointment.problemDescription),
    reminder: buildReminderInfo(appointment.startAt),
    error: opts.error || null,
    message: opts.message || null
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

      let appointments;
      try {
        appointments = await prisma.appointment.findMany({
          where,
          include: {
            doctor: { select: { id: true, fullName: true } },
            patient: { select: { id: true, fullName: true } },
            familyMember: { select: { id: true, fullName: true } },
            prescription: { select: { id: true } },
            review: { select: { id: true, rating: true } }
          },
          orderBy: { startAt: 'desc' },
          take: 300
        });
      } catch (error) {
        if (!isMissingDoctorReviewTable(error)) throw error;
        const fallback = await prisma.appointment.findMany({
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
        appointments = fallback.map((appointment) => ({ ...appointment, review: null }));
      }

      const now = new Date();
      const upcomingAppointments = appointments
        .filter((a) => a.status === 'booked' && new Date(a.startAt) >= now)
        .map((a) => ({
          ...a,
          triage: computeTriage(a.problemDescription),
          reminder: buildReminderInfo(a.startAt)
        }))
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

      const doneAppointments = appointments
        .filter((a) => !(a.status === 'booked' && new Date(a.startAt) >= now))
        .map((a) => ({
          ...a,
          triage: computeTriage(a.problemDescription),
          reminder: buildReminderInfo(a.startAt)
        }))
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

      return renderAppointmentPage(res, req.user, appt);
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
        if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });
        res.status(400);
        return renderAppointmentPage(res, req.user, appt, {
          error: 'Invalid input'
        });
      }

      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });
      if (appt.status !== 'booked') {
        return res.status(409).render('dashboard', { user: req.user, message: 'Appointment already closed.' });
      }
      if (req.user.role !== 'patient' || req.user.id !== appt.patientId) {
        res.status(403);
        return renderAppointmentPage(res, req.user, appt, {
          error: 'Only patient can update this.'
        });
      }

      let updated;
      try {
        updated = await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            problemDescription: parsed.data.problemDescription || null,
            medicationsText: parsed.data.medicationsText || null
          },
          include: {
            doctor: { include: { doctorProfile: true } },
            patient: { include: { patientProfile: true } },
            documents: true,
            prescription: true,
            review: true
          }
        });
      } catch (error) {
        if (!isMissingDoctorReviewTable(error)) throw error;
        updated = await prisma.appointment.update({
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
        updated.review = null;
      }

      const familyMembers = await prisma.familyMember.findMany({
        where: { ownerPatientId: req.user.id },
        orderBy: { fullName: 'asc' }
      });
      return renderAppointmentPage(res, req.user, updated, { familyMembers, message: 'Saved.' });
    } catch (e) {
      return next(e);
    }
  },

  submitReview: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const parsed = reviewSchema.safeParse(req.body);
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Appointment not found' });

      if (!parsed.success) {
        res.status(400);
        return renderAppointmentPage(res, req.user, appt, {
          error: 'Please provide a valid rating between 1 and 5.'
        });
      }

      if (req.user.id !== appt.patientId) {
        res.status(403);
        return renderAppointmentPage(res, req.user, appt, {
          error: 'Only the patient can submit a doctor review.'
        });
      }

      if (appt.status !== 'completed') {
        res.status(409);
        return renderAppointmentPage(res, req.user, appt, {
          error: 'You can review a doctor only after the appointment is completed.'
        });
      }

      const normalizedComment = parsed.data.comment ? parsed.data.comment.trim() : null;

      try {
        await prisma.doctorReview.upsert({
          where: { appointmentId },
          update: {
            rating: parsed.data.rating,
            comment: normalizedComment || null
          },
          create: {
            appointmentId,
            doctorId: appt.doctorId,
            patientId: appt.patientId,
            rating: parsed.data.rating,
            comment: normalizedComment || null
          }
        });
      } catch (error) {
        if (!isMissingDoctorReviewTable(error)) throw error;
        return renderAppointmentPage(res, req.user, appt, {
          message: 'Review feature is temporarily unavailable. Please run the latest database migration.'
        });
      }

      const refreshed = await ensureAppointmentAccess(appointmentId, req.user);
      return renderAppointmentPage(res, req.user, refreshed, {
        message: 'Thanks. Your review has been saved.'
      });
    } catch (e) {
      return next(e);
    }
  },

  viewImpactDashboard: async (req, res, next) => {
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
          prescription: { select: { followUpAt: true } },
          callSession: { select: { startedAt: true, endedAt: true } }
        },
        orderBy: { startAt: 'desc' },
        take: 400
      });

      const statusCounts = { booked: 0, completed: 0, cancelled: 0, no_show: 0 };
      let urgentCount = 0;
      let reminderDueCount = 0;
      let followUpCount = 0;
      let totalDurationMins = 0;
      let durationSamples = 0;

      const now = Date.now();
      const next14Days = now + 14 * 24 * 60 * 60 * 1000;

      for (const appointment of appointments) {
        statusCounts[appointment.status] = (statusCounts[appointment.status] || 0) + 1;

        const triage = computeTriage(appointment.problemDescription);
        if (triage.level === 'critical' || triage.level === 'high') urgentCount += 1;

        const reminder = buildReminderInfo(appointment.startAt);
        if (appointment.status === 'booked' && reminder.dueSoon) reminderDueCount += 1;

        if (appointment.prescription?.followUpAt) {
          const followUpAt = new Date(appointment.prescription.followUpAt).getTime();
          if (followUpAt >= now && followUpAt <= next14Days) followUpCount += 1;
        }

        if (appointment.callSession?.startedAt && appointment.callSession?.endedAt) {
          const minutes = Math.round(
            (new Date(appointment.callSession.endedAt).getTime() - new Date(appointment.callSession.startedAt).getTime()) / 60000
          );
          if (minutes > 0) {
            totalDurationMins += minutes;
            durationSamples += 1;
          }
        }
      }

      const total = appointments.length;
      const completionRate = total ? Math.round((statusCounts.completed / total) * 100) : 0;
      const avgConsultMins = durationSamples ? Math.round(totalDurationMins / durationSamples) : 0;

      return res.render('appointments-impact', {
        user: req.user,
        metrics: {
          total,
          statusCounts,
          completionRate,
          urgentCount,
          reminderDueCount,
          followUpCount,
          avgConsultMins
        }
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

      const isPatientOwner = req.user.role === 'patient' && req.user.id === appt.patientId;
      const isDoctorOwner = req.user.id === appt.doctorId;
      const isAdmin = req.user.role === 'admin';

      if (!isAdmin && !isDoctorOwner && !isPatientOwner) {
        return res.status(403).render('dashboard', { user: req.user, message: 'Forbidden' });
      }

      if (isPatientOwner && appt.status !== 'booked') {
        return res.status(409).render('dashboard', { user: req.user, message: 'Only booked appointments can be cancelled.' });
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
