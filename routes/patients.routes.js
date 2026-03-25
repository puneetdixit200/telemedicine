const express = require('express');
const { authRequired, roleRequired } = require('../middleware/auth');
const { patientsController } = require('../controllers/patients.controller');

const router = express.Router();

router.get('/me', authRequired, roleRequired('patient'), patientsController.viewMyHealth);
router.post('/me', authRequired, roleRequired('patient'), patientsController.updateMyHealth);

module.exports = router;
