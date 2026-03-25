const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../models/db');
const { uploadBuffer, getReadSasUrl, getLocalFilePath } = require('../services/storage.service');

async function ensureAppointmentAccess(appointmentId, user) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, doctorId: true, patientId: true, familyMemberId: true, status: true }
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
      const uploadFor = req.body.uploadFor || '';
      let familyTargetId = null;

      if (!uploadFor) {
        return res.status(400).json({ error: 'Please choose who this file is for.' });
      }

      if (uploadFor !== 'user') {
        const familyMember = await prisma.familyMember.findFirst({
          where: { id: uploadFor, ownerPatientId: req.user.id }
        });
        if (!familyMember) {
          return res.status(400).json({ error: 'Invalid family member selected.' });
        }
        familyTargetId = familyMember.id;
      }

      if (appointmentId) {
        const appt = await ensureAppointmentAccess(appointmentId, req.user);
        if (!appt || appt.patientId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (appt.status !== 'booked') return res.status(409).json({ error: 'Appointment is closed. Upload is not allowed.' });

        if (appt.familyMemberId) {
          if (familyTargetId !== appt.familyMemberId) {
            return res.status(400).json({ error: 'This appointment is for a specific family member. Select the same name.' });
          }
        }

        if (!appt.familyMemberId) {
          if (uploadFor !== 'user') {
            return res.status(400).json({ error: 'This appointment is for main user. Select main user.' });
          }
        }
      }

      const safeName = (req.file.originalname || 'document')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 120);
      const ownerSegment = familyTargetId ? `family_${familyTargetId}` : 'user';
      const blobName = `${req.user.id}/${ownerSegment}/${uuidv4()}-${safeName}`;

      await uploadBuffer({ blobName, buffer: req.file.buffer, contentType: req.file.mimetype });

      const doc = await prisma.document.create({
        data: {
          ownerId: req.user.id,
          familyMemberId: familyTargetId,
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
      if (url.startsWith('/documents/local/')) {
        const filePath = getLocalFilePath(doc.blobName);
        return res.download(filePath, doc.fileName);
      }
      return res.redirect(url);
    } catch (e) {
      return next(e);
    }
  },

  downloadLocal: async (req, res, next) => {
    try {
      const blobName = decodeURIComponent(req.params.blobName || '');
      const doc = await prisma.document.findFirst({ where: { blobName } });
      if (!doc) return res.status(404).json({ error: 'Not found' });

      if (req.user.role !== 'admin') {
        if (doc.ownerId !== req.user.id) {
          if (!doc.appointmentId) return res.status(403).json({ error: 'Forbidden' });
          const appt = await ensureAppointmentAccess(doc.appointmentId, req.user);
          if (!appt) return res.status(403).json({ error: 'Forbidden' });
        }
      }

      const filePath = getLocalFilePath(doc.blobName);
      return res.download(filePath, doc.fileName);
    } catch (e) {
      return next(e);
    }
  }
};

module.exports = { documentsController };
