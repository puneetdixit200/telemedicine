const express = require('express');
const { authRequired } = require('../middleware/auth');
const { usersController } = require('../controllers/users.controller');

const router = express.Router();

router.post('/presence/ping', authRequired, usersController.pingPresence);
router.get('/me', authRequired, usersController.viewMe);
router.post('/me', authRequired, usersController.updateMe);

module.exports = router;
