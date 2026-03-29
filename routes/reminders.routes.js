const express = require('express');
const { authRequired, roleRequired } = require('../middleware/auth');
const { remindersController } = require('../controllers/reminders.controller');

const router = express.Router();

router.get('/', authRequired, remindersController.list);
router.post('/dispatch', authRequired, roleRequired('doctor', 'admin'), remindersController.dispatchNow);

module.exports = router;
