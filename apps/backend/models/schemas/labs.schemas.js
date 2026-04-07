const { z } = require('zod');

const optionalUuid = z.string().uuid().optional().or(z.literal(''));

const createCatalogTestSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(180),
  category: z.string().max(120).optional().or(z.literal('')),
  sampleType: z.string().max(120).optional().or(z.literal('')),
  fastingRequired: z.boolean().optional(),
  turnaroundHours: z.coerce.number().int().min(1).max(240).optional(),
  priceCents: z.coerce.number().int().min(0).max(2000000).optional(),
  isActive: z.boolean().optional()
});

const customLabTestSchema = z.object({
  name: z.string().min(2).max(180),
  sampleType: z.string().max(120).optional().or(z.literal('')),
  instructions: z.string().max(400).optional().or(z.literal('')),
  priceCents: z.coerce.number().int().min(0).max(2000000).optional()
});

const createLabOrderSchema = z.object({
  appointmentId: optionalUuid,
  patientId: optionalUuid,
  familyMemberId: optionalUuid,
  clinicalNotes: z.string().max(2000).optional().or(z.literal('')),
  testCatalogIds: z.array(z.string().uuid()).optional().default([]),
  customTests: z.array(customLabTestSchema).optional().default([])
});

const updateLabOrderStatusSchema = z.object({
  status: z.enum(['requested', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled'])
});

const attachLabReportSchema = z.object({
  documentId: z.string().uuid()
});

module.exports = {
  createCatalogTestSchema,
  createLabOrderSchema,
  updateLabOrderStatusSchema,
  attachLabReportSchema
};
