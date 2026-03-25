const PDFDocument = require('pdfkit');
const { z } = require('zod');
const { prisma } = require('../models/db');

const upsertSchema = z.object({
  diagnosis: z.string().min(2).max(500),
  itemsText: z.string().max(4000).optional().or(z.literal('')),
  medicationName: z.union([z.string(), z.array(z.string())]).optional(),
  dosage: z.union([z.string(), z.array(z.string())]).optional(),
  frequency: z.union([z.string(), z.array(z.string())]).optional(),
  duration: z.union([z.string(), z.array(z.string())]).optional(),
  instructions: z.string().optional().or(z.literal('')),
  followUpAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal(''))
});

function parseItems(itemsText) {
  // One per line: name, dosage, frequency, duration
  const lines = String(itemsText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const parts = line.split(',').map((p) => p.trim());
    return {
      name: parts[0] || line,
      dosage: parts[1] || '',
      frequency: parts[2] || '',
      duration: parts[3] || ''
    };
  });
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function parseStructuredItems(raw) {
  const names = toArray(raw.medicationName).map((v) => String(v || '').trim());
  const dosages = toArray(raw.dosage).map((v) => String(v || '').trim());
  const frequencies = toArray(raw.frequency).map((v) => String(v || '').trim());
  const durations = toArray(raw.duration).map((v) => String(v || '').trim());

  const maxLen = Math.max(names.length, dosages.length, frequencies.length, durations.length);
  const items = [];
  for (let i = 0; i < maxLen; i++) {
    const name = names[i] || '';
    const dosage = dosages[i] || '';
    const frequency = frequencies[i] || '';
    const duration = durations[i] || '';
    if (!name && !dosage && !frequency && !duration) continue;
    items.push({ name: name || 'Medication', dosage, frequency, duration });
  }
  return items;
}

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { select: { id: true, fullName: true } },
      patient: { select: { id: true, fullName: true } },
      prescription: true
    }
  });
  if (!appt) return null;
  if (user.role === 'admin') return appt;
  if (user.id !== appt.patientId && user.id !== appt.doctorId) return null;
  return appt;
}

const prescriptionsController = {
  viewPrescription: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Not found' });

      return res.render('prescription', { user: req.user, appointment: appt, error: null, message: null });
    } catch (e) {
      return next(e);
    }
  },

  upsertPrescription: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt) return res.status(404).render('dashboard', { user: req.user, message: 'Not found' });
      if (req.user.role !== 'doctor' || req.user.id !== appt.doctorId) {
        return res.status(403).render('dashboard', { user: req.user, message: 'Only the assigned doctor can write this.' });
      }
      if (appt.status !== 'booked') {
        return res.status(409).render('prescription', {
          user: req.user,
          appointment: appt,
          error: 'Appointment is closed. Prescription cannot be edited.',
          message: null
        });
      }

      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).render('prescription', {
          user: req.user,
          appointment: appt,
          error: 'Invalid inputs (diagnosis + at least one medication line required).',
          message: null
        });
      }

      let items = parseStructuredItems(parsed.data);
      if (items.length === 0 && parsed.data.itemsText) {
        items = parseItems(parsed.data.itemsText);
      }
      if (items.length === 0) {
        return res.status(400).render('prescription', {
          user: req.user,
          appointment: appt,
          error: 'Add at least one medication with name/dosage/frequency/duration.',
          message: null
        });
      }

      await prisma.prescription.upsert({
        where: { appointmentId },
        update: {
          diagnosis: parsed.data.diagnosis,
          items,
          instructions: parsed.data.instructions || null,
          followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
          notes: parsed.data.notes || null
        },
        create: {
          appointmentId,
          diagnosis: parsed.data.diagnosis,
          items,
          instructions: parsed.data.instructions || null,
          followUpAt: parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null,
          notes: parsed.data.notes || null
        }
      });

      await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'completed' } });

      const refreshed = await ensureAppointmentAccess(appointmentId, req.user);
      return res.render('prescription', { user: req.user, appointment: refreshed, error: null, message: 'Saved.' });
    } catch (e) {
      return next(e);
    }
  },

  downloadPdf: async (req, res, next) => {
    try {
      const appointmentId = req.params.appointmentId;
      const appt = await ensureAppointmentAccess(appointmentId, req.user);
      if (!appt || !appt.prescription) return res.status(404).render('dashboard', { user: req.user, message: 'Prescription not found' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=prescription-${appointmentId}.pdf`);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);

      doc.fontSize(18).text('Prescription', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Doctor: ${appt.doctor.fullName}`);
      doc.text(`Patient: ${appt.patient.fullName}`);
      doc.text(`Appointment: ${new Date(appt.startAt).toISOString().replace('T', ' ').slice(0, 16)} UTC`);
      doc.moveDown();

      doc.fontSize(13).text('Diagnosis:', { underline: true });
      doc.fontSize(12).text(appt.prescription.diagnosis);
      doc.moveDown();

      doc.fontSize(13).text('Medications:', { underline: true });
      const items = Array.isArray(appt.prescription.items) ? appt.prescription.items : [];
      items.forEach((item, idx) => {
        doc.fontSize(12).text(`${idx + 1}. ${item.name || ''}`);
        const parts = [item.dosage, item.frequency, item.duration].filter(Boolean).join(' | ');
        if (parts) doc.fontSize(10).text(parts, { indent: 14 });
      });
      doc.moveDown();

      if (appt.prescription.instructions) {
        doc.fontSize(13).text('Instructions:', { underline: true });
        doc.fontSize(12).text(appt.prescription.instructions);
        doc.moveDown();
      }

      if (appt.prescription.followUpAt) {
        doc.fontSize(12).text(`Follow-up: ${new Date(appt.prescription.followUpAt).toISOString().slice(0, 10)}`);
      }

      if (appt.prescription.notes) {
        doc.moveDown();
        doc.fontSize(10).text(`Notes: ${appt.prescription.notes}`);
      }

      doc.end();
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { prescriptionsController };
