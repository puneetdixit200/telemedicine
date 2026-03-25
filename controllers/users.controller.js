const { z } = require('zod');
const { prisma } = require('../models/db');

const updateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  language: z.string().optional().or(z.literal('')),
  timeZone: z.string().optional().or(z.literal('')),
  chronicConditions: z.string().optional().or(z.literal('')),
  basicHealthInfo: z.string().optional().or(z.literal('')),

  specialization: z.string().optional().or(z.literal('')),
  yearsOfExperience: z.string().optional().or(z.literal('')),
  qualifications: z.string().optional().or(z.literal('')),
  clinicName: z.string().optional().or(z.literal('')),
  consultationLanguages: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal(''))
});

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
