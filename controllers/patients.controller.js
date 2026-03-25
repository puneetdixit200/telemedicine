const { z } = require('zod');
const { prisma } = require('../models/db');

const schema = z.object({
  chronicConditions: z.string().optional().or(z.literal('')),
  basicHealthInfo: z.string().optional().or(z.literal(''))
});

const patientsController = {
  viewMyHealth: async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { patientProfile: true } });
      return res.render('patient-health', { user, error: null, message: null });
    } catch (e) {
      return next(e);
    }
  },

  updateMyHealth: async (req, res, next) => {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { patientProfile: true } });
        return res.status(400).render('patient-health', { user, error: 'Invalid input', message: null });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          patientProfile: {
            upsert: {
              create: {
                chronicConditions: parsed.data.chronicConditions || null,
                basicHealthInfo: parsed.data.basicHealthInfo || null
              },
              update: {
                chronicConditions: parsed.data.chronicConditions || null,
                basicHealthInfo: parsed.data.basicHealthInfo || null
              }
            }
          }
        },
        include: { patientProfile: true }
      });

      return res.render('patient-health', { user: updated, error: null, message: 'Saved.' });
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { patientsController };
