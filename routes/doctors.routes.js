const express = require('express');
const { authRequired, roleRequired } = require('../middleware/auth');
const { doctorsController } = require('../controllers/doctors.controller');

const router = express.Router();

router.get('/', authRequired, doctorsController.listDoctors);
router.get('/:doctorId', authRequired, doctorsController.viewDoctor);

router.get('/me/slots', authRequired, roleRequired('doctor'), doctorsController.viewMySlots);
router.post('/me/call-state', authRequired, roleRequired('doctor'), doctorsController.setCallState);
router.post('/me/slots/bulk', authRequired, roleRequired('doctor'), doctorsController.bulkUpdateSlots);

module.exports = router;
