const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(8),
  role: z.enum(['patient', 'doctor', 'admin']),
  adminInviteCode: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  language: z.string().optional().or(z.literal('')),
  timeZone: z.string().optional().or(z.literal('')),
  specialization: z.string().optional().or(z.literal('')),
  yearsOfExperience: z.string().optional().or(z.literal('')),
  qualifications: z.string().optional().or(z.literal('')),
  clinicName: z.string().optional().or(z.literal('')),
  consultationLanguages: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal(''))
});

module.exports = { loginSchema, registerSchema };
