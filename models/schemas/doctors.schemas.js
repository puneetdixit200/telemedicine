const { z } = require('zod');

const bulkSchema = z.object({
  date: z.string().min(10),
  startHourUtc: z.string().optional().or(z.literal('')),
  endHourUtc: z.string().optional().or(z.literal('')),
  action: z.enum(['make_available', 'make_busy'])
});

const callStateSchema = z.object({
  state: z.enum(['online', 'offline'])
});

module.exports = { bulkSchema, callStateSchema };
