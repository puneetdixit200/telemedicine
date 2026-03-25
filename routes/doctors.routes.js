const express = require('express');
const { authRequired, roleRequired } = require('../middleware/auth');
const { doctorsController } = require('../controllers/doctors.controller');

const router = express.Router();

router.get('/', authRequired, doctorsController.listDoctors);
router.get('/me/slots', authRequired, roleRequired('doctor'), doctorsController.viewMySlots);
router.get('/me/analytics', authRequired, roleRequired('doctor'), doctorsController.viewAnalytics);
router.post('/me/call-state', authRequired, roleRequired('doctor'), doctorsController.setCallState);
router.post('/me/slots/bulk', authRequired, roleRequired('doctor'), doctorsController.bulkUpdateSlots);
router.get('/:doctorId', authRequired, doctorsController.viewDoctor);

module.exports = router;
