const { z } = require('zod');

const optionalUuid = z.string().uuid().optional().or(z.literal(''));

const orderItemSchema = z.object({
  name: z.string().min(2).max(180),
  dosage: z.string().max(120).optional().or(z.literal('')),
  frequency: z.string().max(120).optional().or(z.literal('')),
  duration: z.string().max(120).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1).max(365).optional(),
  instructions: z.string().max(400).optional().or(z.literal(''))
});

const createOrderSchema = z.object({
  appointmentId: optionalUuid,
  prescriptionId: optionalUuid,
  patientId: optionalUuid,
  pharmacyName: z.string().max(180).optional().or(z.literal('')),
  pharmacyContact: z.string().max(180).optional().or(z.literal('')),
  deliveryAddress: z.string().max(320).optional().or(z.literal('')),
  handoffCode: z.string().max(64).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  items: z.array(orderItemSchema).optional().default([])
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['placed', 'processing', 'ready', 'delivered', 'cancelled'])
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  orderItemSchema
};
