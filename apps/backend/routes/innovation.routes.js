const express = require('express');
const { authRequired } = require('../middleware/auth');
const { innovationController } = require('../controllers/innovation.controller');

const router = express.Router();

router.get('/public/records/:token', innovationController.getPublicRecordByToken);

router.use(authRequired);

router.post('/voice/intent', innovationController.voiceIntent);
router.post('/triage/preview', innovationController.triagePreview);

router.post('/appointments/:appointmentId/vitals', innovationController.recordVitals);
router.get('/appointments/:appointmentId/vitals', innovationController.listVitals);

router.post('/patients/qr-token', innovationController.createQrToken);
router.get('/patients/:patientId/full-details', innovationController.viewPatientFullDetails);
router.get('/patients/access-by-token/:token', innovationController.viewPatientByShareToken);

router.post('/patients/:patientId/care-plans', innovationController.createCarePlan);
router.get('/patients/:patientId/care-plans', innovationController.listCarePlans);
router.post('/care-plans/:planId/check-ins', innovationController.createCarePlanCheckIn);

router.post('/emergency/ambulance', innovationController.quickAmbulanceEscalation);
router.post('/appointments/:appointmentId/emergency', innovationController.escalateEmergency);
router.get('/emergencies', innovationController.listEmergencies);

router.post('/appointments/:appointmentId/external-thread', innovationController.upsertExternalThread);
router.post('/external-threads/:threadId/messages', innovationController.postExternalMessage);
router.get('/external-threads/:threadId/messages', innovationController.listExternalMessages);

router.post('/appointments/:appointmentId/voice-notes', innovationController.createVoiceNote);
router.get('/appointments/:appointmentId/voice-notes', innovationController.listVoiceNotes);

router.get('/patients/:patientId/trends', innovationController.patientTrends);
router.get('/patients/:patientId/refill-reminders', innovationController.refillReminders);

router.post('/patients/me/abha', innovationController.linkAbha);
router.get('/patients/me/abha', innovationController.getAbha);

router.post('/appointments/:appointmentId/second-opinions', innovationController.createSecondOpinion);
router.get('/appointments/:appointmentId/second-opinions', innovationController.listSecondOpinionsByAppointment);
router.post('/second-opinions/:requestId/status', innovationController.updateSecondOpinion);

router.get('/doctors/:doctorId/trust-score', innovationController.doctorTrustScore);

router.post('/offline/sync', innovationController.syncOfflineQueue);

module.exports = router;
