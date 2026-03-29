const { z } = require('zod');

const createHelperSchema = z.object({
  helperName: z.string().min(2).max(120),
  helperPhone: z.string().min(8).max(24),
  relationToPatient: z.string().max(120).optional().or(z.literal('')),
  village: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal(''))
});

const toggleHelperSchema = z.object({
  active: z.coerce.boolean().optional()
});

const createConsentSchema = z.object({
  helperId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  scope: z.enum(['appointment', 'async_consult', 'records', 'all']).default('appointment'),
  notes: z.string().max(2000).optional().or(z.literal(''))
});

module.exports = {
  createHelperSchema,
  toggleHelperSchema,
  createConsentSchema
};
