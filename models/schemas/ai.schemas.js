const { z } = require('zod');

const nonEmptyLanguage = z.string().trim().min(2).max(40);

const appointmentIdSchema = z.string().uuid();
const optionalUuid = z.string().uuid().optional().or(z.literal(''));

const draftNoteSchema = z.object({
  appointmentId: appointmentIdSchema,
  focus: z.string().trim().max(600).optional().or(z.literal(''))
});

const visitSummarySchema = z.object({
  appointmentId: appointmentIdSchema,
  audience: z.enum(['patient', 'caregiver', 'doctor']).default('patient'),
  language: nonEmptyLanguage.optional().or(z.literal(''))
});

const simplifyMedicationSchema = z.object({
  appointmentId: appointmentIdSchema,
  language: nonEmptyLanguage.optional().or(z.literal('')),
  readingLevel: z.enum(['easy', 'standard']).default('easy')
});

const triageAssistSchema = z.object({
  subject: z.string().trim().min(3).max(140),
  symptoms: z.string().trim().min(10).max(4000),
  preferredLanguage: nonEmptyLanguage.optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  patientId: optionalUuid
});

const reminderTextSchema = z.object({
  appointmentId: appointmentIdSchema,
  tone: z.enum(['warm', 'formal', 'urgent']).default('warm'),
  language: nonEmptyLanguage.optional().or(z.literal('')),
  channel: z.enum(['sms', 'whatsapp']).default('sms')
});

const documentAssistSchema = z.object({
  documentId: z.string().uuid(),
  question: z.string().trim().min(3).max(1200),
  language: nonEmptyLanguage.optional().or(z.literal(''))
});

const helperGuidanceSchema = z.object({
  patientId: optionalUuid,
  goal: z.string().trim().min(3).max(400),
  language: nonEmptyLanguage.optional().or(z.literal(''))
});

const translateChatSchema = z.object({
  appointmentId: appointmentIdSchema,
  text: z.string().trim().min(1).max(2000),
  targetLanguage: nonEmptyLanguage,
  sourceLanguage: nonEmptyLanguage.optional().or(z.literal(''))
});

module.exports = {
  draftNoteSchema,
  visitSummarySchema,
  simplifyMedicationSchema,
  triageAssistSchema,
  reminderTextSchema,
  documentAssistSchema,
  helperGuidanceSchema,
  translateChatSchema
};
