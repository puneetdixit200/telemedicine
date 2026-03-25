const express = require('express');
const { authRequired } = require('../middleware/auth');
const { callsController } = require('../controllers/calls.controller');

const router = express.Router();

router.get('/:appointmentId', authRequired, callsController.viewCall);
router.post('/:appointmentId/end', authRequired, callsController.endCall);

module.exports = router;
