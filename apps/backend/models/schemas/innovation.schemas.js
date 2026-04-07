const { z } = require('zod');

const optionalText = (max = 2000) => z.string().max(max).optional().or(z.literal(''));

const voiceIntentSchema = z.object({
  transcript: z.string().min(1).max(1200),
  language: optionalText(40)
});

const triagePreviewSchema = z.object({
  problemDescription: z.string().min(1).max(4000)
});

const vitalsCreateSchema = z.object({
  source: optionalText(80),
  bpSystolic: z.coerce.number().int().min(50).max(280).optional(),
  bpDiastolic: z.coerce.number().int().min(30).max(180).optional(),
  temperatureC: z.coerce.number().min(30).max(46).optional(),
  glucoseMgDl: z.coerce.number().min(30).max(800).optional(),
  spo2Percent: z.coerce.number().int().min(40).max(100).optional(),
  pulseBpm: z.coerce.number().int().min(20).max(240).optional(),
  weightKg: z.coerce.number().min(1).max(400).optional(),
  notes: optionalText(2000)
});

const qrTokenCreateSchema = z.object({
  patientId: z.string().uuid(),
  label: optionalText(120),
  expiresInHours: z.coerce.number().int().min(1).max(24 * 30).default(72)
});

const carePlanCreateSchema = z.object({
  patientId: z.string().uuid(),
  familyMemberId: z.string().uuid().optional().or(z.literal('')),
  condition: z.string().min(2).max(240),
  checkInIntervalDays: z.coerce.number().int().min(1).max(180).default(30),
  milestones: z.array(z.string().max(240)).max(24).optional(),
  notes: optionalText(3000)
});

const carePlanCheckInSchema = z.object({
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  status: z.string().max(40).optional(),
  notes: optionalText(2000),
  vitalsSnapshot: z.record(z.any()).optional()
});

const emergencyCreateSchema = z.object({
  locationLat: z.coerce.number().min(-90).max(90).optional(),
  locationLng: z.coerce.number().min(-180).max(180).optional(),
  locationText: optionalText(240),
  contactName: optionalText(120),
  contactPhone: optionalText(32),
  medicalSummary: optionalText(3000),
  latestVitals: z.record(z.any()).optional()
});

const externalThreadSchema = z.object({
  channel: z.enum(['sms', 'whatsapp']).default('whatsapp'),
  contactPhone: optionalText(32)
});

const externalMessageSchema = z.object({
  direction: z.enum(['inbound', 'outbound']),
  body: z.string().min(1).max(4000),
  deliveryStatus: optionalText(120),
  metadata: z.record(z.any()).optional()
});

const voiceNoteSchema = z.object({
  language: optionalText(24),
  transcriptText: z.string().min(2).max(4000),
  summaryText: optionalText(4000),
  source: optionalText(120)
});

const secondOpinionCreateSchema = z.object({
  secondDoctorId: z.string().uuid().optional().or(z.literal('')),
  consentNote: optionalText(2000)
});

const secondOpinionUpdateSchema = z.object({
  status: z.enum(['requested', 'accepted', 'completed', 'declined']),
  reviewSummary: optionalText(4000),
  notes: optionalText(2000)
});

const abhaLinkSchema = z.object({
  abhaId: z.string().min(6).max(64),
  abhaAddress: optionalText(160)
});

const offlineSyncSchema = z.object({
  queue: z
    .array(
      z.object({
        type: z.string().min(2).max(80),
        payload: z.record(z.any()).optional(),
        createdAt: z.string().datetime().optional()
      })
    )
    .max(200)
    .default([])
});

module.exports = {
  voiceIntentSchema,
  triagePreviewSchema,
  vitalsCreateSchema,
  qrTokenCreateSchema,
  carePlanCreateSchema,
  carePlanCheckInSchema,
  emergencyCreateSchema,
  externalThreadSchema,
  externalMessageSchema,
  voiceNoteSchema,
  secondOpinionCreateSchema,
  secondOpinionUpdateSchema,
  abhaLinkSchema,
  offlineSyncSchema
};
