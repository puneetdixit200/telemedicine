const express = require('express');
const { authRequired, roleRequired } = require('../middleware/auth');
const { appointmentsController } = require('../controllers/appointments.controller');

const router = express.Router();

router.get('/', authRequired, appointmentsController.listMyAppointments);
router.get('/impact', authRequired, appointmentsController.viewImpactDashboard);
router.get('/:appointmentId', authRequired, appointmentsController.viewAppointment);
router.get('/:appointmentId/presence', authRequired, appointmentsController.getPresence);

router.post('/book', authRequired, roleRequired('patient'), appointmentsController.book);
router.post('/:appointmentId/prep', authRequired, roleRequired('patient'), appointmentsController.updatePreconsult);
router.post('/:appointmentId/cancel', authRequired, appointmentsController.cancel);
router.post('/:appointmentId/end', authRequired, appointmentsController.endAppointment);

module.exports = router;
