const { z } = require('zod');
const { prisma } = require('../models/db');
const { isRecentlyOnline } = require('../services/presence.service');

const bulkSchema = z.object({
  date: z.string().min(10), // YYYY-MM-DD
  startHourUtc: z.string().optional().or(z.literal('')),
  endHourUtc: z.string().optional().or(z.literal('')),
  action: z.enum(['make_available', 'make_busy'])
});

const callStateSchema = z.object({
  state: z.enum(['online', 'offline'])
});

function getUtcRangeForDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map((v) => Number(v));
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return { start, end };
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

const doctorsController = {
  listDoctors: async (req, res, next) => {
    try {
      if (req.user.role === 'doctor') {
        return res.redirect('/doctors/me/slots');
      }

      const { specialization, language, online } = req.query;
      const where = {
        role: 'doctor',
        isActive: true,
        doctorProfile: {
          is: {
            ...(specialization ? { specialization: { contains: String(specialization), mode: 'insensitive' } } : {}),
            ...(language ? { consultationLanguages: { contains: String(language), mode: 'insensitive' } } : {})
          }
        }
      };

      const doctors = await prisma.user.findMany({
        where,
        include: { doctorProfile: true },
        orderBy: { fullName: 'asc' }
      });

      const doctorsWithStatus = doctors.map((d) => ({
        ...d,
        online: Boolean(d.doctorProfile?.callEnabled) && isRecentlyOnline(d.lastSeenAt)
      }));

      const doctorsFiltered =
        online === 'online'
          ? doctorsWithStatus.filter((d) => d.online)
          : online === 'offline'
            ? doctorsWithStatus.filter((d) => !d.online)
            : doctorsWithStatus;

      return res.render('doctors', {
        user: req.user,
        doctors: doctorsFiltered,
        specialization: specialization || '',
        language: language || '',
        online: online || 'all'
      });
    } catch (e) {
      return next(e);
    }
  },

  viewDoctor: async (req, res, next) => {
    try {
      const doctorId = req.params.doctorId;
      if (req.user.role === 'doctor' && req.user.id !== doctorId) {
        return res.status(403).render('dashboard', { user: req.user, message: 'Doctors cannot access other doctor profiles.' });
      }

      const doctor = await prisma.user.findUnique({
        where: { id: doctorId },
        include: { doctorProfile: true }
      });
      if (!doctor || doctor.role !== 'doctor') return res.status(404).render('dashboard', { user: req.user, message: 'Doctor not found' });

      const now = new Date();
      const slots = await prisma.slot.findMany({
        where: { doctorId, startAt: { gte: now } },
        orderBy: { startAt: 'asc' },
        take: 48
      });

      const familyMembers =
        req.user.role === 'patient'
          ? await prisma.familyMember.findMany({
              where: { ownerPatientId: req.user.id },
              orderBy: { fullName: 'asc' }
            })
          : [];

      const doctorOnline = Boolean(doctor.doctorProfile?.callEnabled) && isRecentlyOnline(doctor.lastSeenAt);
      return res.render('doctor', { user: req.user, doctor, slots, doctorOnline, familyMembers });
    } catch (e) {
      return next(e);
    }
  },

  viewMySlots: async (req, res, next) => {
    try {
      const doctor = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { doctorProfile: true }
      });
      const now = new Date();
      const slots = await prisma.slot.findMany({
        where: { doctorId: req.user.id, startAt: { gte: now } },
        orderBy: { startAt: 'asc' },
        take: 96
      });
      return res.render('doctor-slots', {
        user: doctor || req.user,
        slots,
        error: null,
        message: null,
        callState: doctor?.doctorProfile?.callEnabled ? 'online' : 'offline'
      });
    } catch (e) {
      return next(e);
    }
  },

  viewAnalytics: async (req, res, next) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const start = startOfUtcDay(sevenDaysAgo);

      const appts = await prisma.appointment.findMany({
        where: {
          doctorId: req.user.id,
          startAt: { gte: start }
        },
        select: { startAt: true, status: true }
      });

      const statusCounts = { booked: 0, completed: 0, cancelled: 0, no_show: 0 };
      const byDay = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        byDay[d.toISOString().slice(0, 10)] = 0;
      }

      appts.forEach((a) => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        const key = new Date(a.startAt).toISOString().slice(0, 10);
        if (Object.prototype.hasOwnProperty.call(byDay, key)) byDay[key] += 1;
      });

      const maxDaily = Math.max(1, ...Object.values(byDay));
      const dailySeries = Object.entries(byDay).map(([day, count]) => ({
        day,
        count,
        widthPct: Math.round((count / maxDaily) * 100)
      }));

      return res.render('doctor-analytics', {
        user: req.user,
        statusCounts,
        dailySeries
      });
    } catch (e) {
      return next(e);
    }
  },

  setCallState: async (req, res, next) => {
    try {
      const parsed = callStateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).render('dashboard', { user: req.user, message: 'Invalid call state.' });
      }

      const callEnabled = parsed.data.state === 'online';
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          lastSeenAt: new Date(),
          doctorProfile: {
            upsert: {
              create: { specialization: 'General', callEnabled },
              update: { callEnabled }
            }
          }
        }
      });

      return res.redirect('/doctors/me/slots');
    } catch (e) {
      return next(e);
    }
  },

  bulkUpdateSlots: async (req, res, next) => {
    try {
      const parsed = bulkSchema.safeParse(req.body);
      if (!parsed.success) {
        const doctor = await prisma.user.findUnique({
          where: { id: req.user.id },
          include: { doctorProfile: true }
        });
        const slots = await prisma.slot.findMany({ where: { doctorId: req.user.id }, orderBy: { startAt: 'asc' }, take: 96 });
        return res.status(400).render('doctor-slots', {
          user: doctor || req.user,
          slots,
          error: 'Invalid input',
          message: null,
          callState: doctor?.doctorProfile?.callEnabled ? 'online' : 'offline'
        });
      }

      const { date, action } = parsed.data;
      const { start, end } = getUtcRangeForDate(date);

      // Generate 15-min slots 09:00-17:00 UTC by default
      const startHour = parsed.data.startHourUtc ? Number(parsed.data.startHourUtc) : 9;
      const endHour = parsed.data.endHourUtc ? Number(parsed.data.endHourUtc) : 17;

      const base = new Date(start);
      base.setUTCHours(startHour, 0, 0, 0);
      const limit = new Date(start);
      limit.setUTCHours(endHour, 0, 0, 0);

      const targets = [];
      for (let t = base.getTime(); t < limit.getTime(); t += 15 * 60 * 1000) {
        targets.push(new Date(t));
      }

      const status = action === 'make_available' ? 'available' : 'busy';

      await prisma.$transaction(
        targets.map((startAt) =>
          prisma.slot.upsert({
            where: { doctorId_startAt: { doctorId: req.user.id, startAt } },
            update: {
              status: status,
              appointment: status === 'busy' ? { disconnect: true } : undefined
            },
            create: { doctorId: req.user.id, startAt, status }
          })
        )
      );

      const slots = await prisma.slot.findMany({
        where: { doctorId: req.user.id, startAt: { gte: new Date() } },
        orderBy: { startAt: 'asc' },
        take: 96
      });
      const doctor = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { doctorProfile: true }
      });
      return res.render('doctor-slots', {
        user: doctor || req.user,
        slots,
        error: null,
        message: 'Slots updated.',
        callState: doctor?.doctorProfile?.callEnabled ? 'online' : 'offline'
      });
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { doctorsController };
