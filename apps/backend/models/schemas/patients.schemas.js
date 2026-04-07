const { z } = require('zod');

const patientHealthSchema = z.object({
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

module.exports = { patientHealthSchema, familyCreateSchema, familyUpdateSchema };
