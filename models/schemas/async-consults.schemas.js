const { z } = require('zod');

const createAsyncConsultSchema = z.object({
  patientId: z.string().uuid().optional().or(z.literal('')),
  doctorId: z.string().uuid(),
  familyMemberId: z.string().uuid().optional().or(z.literal('')),
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  subject: z.string().min(3).max(140),
  symptoms: z.string().min(10).max(4000),
  preferredLanguage: z.string().max(80).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
});

const addAsyncReplySchema = z.object({
  message: z.string().min(2).max(4000)
});

const closeAsyncConsultSchema = z.object({
  reason: z.string().max(1000).optional().or(z.literal(''))
});

module.exports = {
  createAsyncConsultSchema,
  addAsyncReplySchema,
  closeAsyncConsultSchema
};
