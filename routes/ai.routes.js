const express = require('express');
const rateLimit = require('express-rate-limit');
const { authRequired } = require('../middleware/auth');
const { aiController } = require('../controllers/ai.controller');

const router = express.Router();

const aiLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: Math.max(5, Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 40)),
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'AI request limit reached. Please retry in a moment.',
		code: 'AI_RATE_LIMITED'
	}
});

router.use(authRequired);
router.use(aiLimiter);

router.get('/context', aiController.getContext);
router.post('/draft-note', aiController.draftDoctorNote);
router.post('/visit-summary', aiController.generateVisitSummary);
router.post('/simplify-medication', aiController.simplifyMedication);
router.post('/triage-assist', aiController.runTriageAssistant);
router.post('/reminder-text', aiController.generateReminderText);
router.post('/document-assist', aiController.documentAssistant);
router.post('/helper-guidance', aiController.helperGuidance);
router.post('/translate-chat', aiController.translateChat);

module.exports = router;
