const express = require('express');
const { authRequired } = require('../middleware/auth');
const { supportController } = require('../controllers/support.controller');

const router = express.Router();

router.get('/consents', authRequired, supportController.listConsents);
router.post('/helpers', authRequired, supportController.createHelper);
router.post('/helpers/:helperId/toggle', authRequired, supportController.toggleHelper);
router.post('/consents', authRequired, supportController.grantConsent);

module.exports = router;
