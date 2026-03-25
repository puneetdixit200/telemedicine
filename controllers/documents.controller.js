const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../models/db');
const { uploadBuffer, getReadSasUrl } = require('../services/storage.service');

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, doctorId: true, patientId: true }
  });
  if (!appt) return null;
  if (user.role === 'admin') return appt;
  if (user.id !== appt.patientId && user.id !== appt.doctorId) return null;
  return appt;
}

const documentsController = {
  upload: async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file' });
      if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can upload documents' });

      const appointmentId = req.body.appointmentId || null;
      if (appointmentId) {
        const appt = await ensureAppointmentAccess(appointmentId, req.user);
        if (!appt || appt.patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      }

      const safeName = (req.file.originalname || 'document')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 120);
      const blobName = `${req.user.id}/${uuidv4()}-${safeName}`;

      await uploadBuffer({ blobName, buffer: req.file.buffer, contentType: req.file.mimetype });

      const doc = await prisma.document.create({
        data: {
          ownerId: req.user.id,
          appointmentId,
          fileName: req.file.originalname,
          contentType: req.file.mimetype,
          sizeBytes: req.file.size,
          blobName
        }
      });

      return res.json({ ok: true, document: doc });
    } catch (e) {
      return next(e);
    }
  },

  downloadLink: async (req, res, next) => {
    try {
      const documentId = req.params.documentId;
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) return res.status(404).json({ error: 'Not found' });

      if (req.user.role !== 'admin') {
        if (doc.ownerId !== req.user.id) {
          if (!doc.appointmentId) return res.status(403).json({ error: 'Forbidden' });
          const appt = await ensureAppointmentAccess(doc.appointmentId, req.user);
          if (!appt) return res.status(403).json({ error: 'Forbidden' });
        }
      }

      const url = getReadSasUrl({ blobName: doc.blobName, expiresInMinutes: 10 });
      return res.redirect(url);
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { documentsController };
