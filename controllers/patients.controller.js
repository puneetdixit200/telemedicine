const { z } = require('zod');
const { prisma } = require('../models/db');

const schema = z.object({
  chronicConditions: z.string().optional().or(z.literal('')),
  basicHealthInfo: z.string().optional().or(z.literal(''))
});

const familyCreateSchema = z.object({
  fullName: z.string().min(2),
  relationToPatient: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  chronicConditions: z.string().optional().or(z.literal('')),
  basicHealthInfo: z.string().optional().or(z.literal(''))
});

const familyUpdateSchema = familyCreateSchema.extend({
  familyMemberId: z.string().uuid()
});

async function loadWorkspaceData(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patientProfile: true, familyMembers: { orderBy: { fullName: 'asc' } } }
  });

  const completedAppointments = await prisma.appointment.findMany({
    where: { patientId: userId, status: 'completed' },
    include: {
      doctor: { select: { fullName: true } },
      familyMember: { select: { fullName: true } },
      prescription: true
    },
    orderBy: { startAt: 'desc' },
    take: 100
  });

  return { user, completedAppointments };
}

const patientsController = {
  viewWorkspace: async (req, res, next) => {
    try {
      const { user, completedAppointments } = await loadWorkspaceData(req.user.id);
      return res.render('patient-workspace', {
        user,
        completedAppointments,
        error: null,
        message: null
      });
    } catch (e) {
      return next(e);
    }
  },

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
,

  createFamilyMember: async (req, res, next) => {
    try {
      const parsed = familyCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        const { user, completedAppointments } = await loadWorkspaceData(req.user.id);
        return res.status(400).render('patient-workspace', {
          user,
          completedAppointments,
          error: 'Invalid family member input.',
          message: null
        });
      }

      await prisma.familyMember.create({
        data: {
          ownerPatientId: req.user.id,
          fullName: parsed.data.fullName,
          relationToPatient: parsed.data.relationToPatient || null,
          gender: parsed.data.gender || null,
          dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
          chronicConditions: parsed.data.chronicConditions || null,
          basicHealthInfo: parsed.data.basicHealthInfo || null
        }
      });

      return res.redirect('/patients/workspace');
    } catch (e) {
      return next(e);
    }
  },

  updateFamilyMember: async (req, res, next) => {
    try {
      const parsed = familyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        const { user, completedAppointments } = await loadWorkspaceData(req.user.id);
        return res.status(400).render('patient-workspace', {
          user,
          completedAppointments,
          error: 'Invalid family member update.',
          message: null
        });
      }

      const member = await prisma.familyMember.findFirst({
        where: { id: parsed.data.familyMemberId, ownerPatientId: req.user.id }
      });
      if (!member) return res.status(404).render('dashboard', { user: req.user, message: 'Family member not found' });

      await prisma.familyMember.update({
        where: { id: member.id },
        data: {
          fullName: parsed.data.fullName,
          relationToPatient: parsed.data.relationToPatient || null,
          gender: parsed.data.gender || null,
          dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
          chronicConditions: parsed.data.chronicConditions || null,
          basicHealthInfo: parsed.data.basicHealthInfo || null
        }
      });

      return res.redirect('/patients/workspace');
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { patientsController };
