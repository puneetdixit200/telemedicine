const { prisma } = require('../models/db');
const { updateSchema } = require('../models/schemas/users.schemas');
const { isRecentlyOnline } = require('../services/presence.service');

const usersController = {
  pingPresence: async (req, res, next) => {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { lastSeenAt: new Date() }
      });
      return res.json({ ok: true, at: new Date().toISOString() });
    } catch (e) {
      return next(e);
    }
  },

  presenceStatus: async (req, res, next) => {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { doctorProfile: true }
      });
      if (!fresh) return res.status(404).json({ error: 'User not found' });

      const isPresenceOnline = isRecentlyOnline(fresh.lastSeenAt);
      const isCallOnline =
        fresh.role === 'doctor' ? Boolean(fresh.doctorProfile?.callEnabled) && isPresenceOnline : isPresenceOnline;

      return res.json({ ok: true, isPresenceOnline, isCallOnline, role: fresh.role });
    } catch (e) {
      return next(e);
    }
  },

  viewMe: async (req, res, next) => {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { patientProfile: true, doctorProfile: true }
      });

      return res.render('profile', { user: fresh, error: null, message: null });
    } catch (e) {
      return next(e);
    }
  },

  updateMe: async (req, res, next) => {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        const fresh = await prisma.user.findUnique({
          where: { id: req.user.id },
          include: { patientProfile: true, doctorProfile: true }
        });
        return res.status(400).render('profile', { user: fresh, error: 'Invalid inputs.', message: null });
      }

      const data = parsed.data;

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          fullName: data.fullName,
          phone: data.phone || null,
          gender: data.gender || null,
          address: data.address || null,
          language: data.language || null,
          timeZone: data.timeZone || null,
          patientProfile:
            req.user.role === 'patient'
              ? {
                  upsert: {
                    create: {
                      chronicConditions: data.chronicConditions || null,
                      basicHealthInfo: data.basicHealthInfo || null
                    },
                    update: {
                      chronicConditions: data.chronicConditions || null,
                      basicHealthInfo: data.basicHealthInfo || null
                    }
                  }
                }
              : undefined,
          doctorProfile:
            req.user.role === 'doctor'
              ? {
                  upsert: {
                    create: {
                      specialization: data.specialization || 'General',
                      yearsOfExperience: data.yearsOfExperience ? Number(data.yearsOfExperience) : null,
                      qualifications: data.qualifications || null,
                      clinicName: data.clinicName || null,
                      consultationLanguages: data.consultationLanguages || null,
                      description: data.description || null
                    },
                    update: {
                      specialization: data.specialization || undefined,
                      yearsOfExperience: data.yearsOfExperience ? Number(data.yearsOfExperience) : null,
                      qualifications: data.qualifications || null,
                      clinicName: data.clinicName || null,
                      consultationLanguages: data.consultationLanguages || null,
                      description: data.description || null
                    }
                  }
                }
              : undefined
        },
        include: { patientProfile: true, doctorProfile: true }
      });

      return res.render('profile', { user: updated, error: null, message: 'Profile updated.' });
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { usersController };
