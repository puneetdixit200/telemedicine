const { z } = require('zod');

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

module.exports = { updateSchema };
