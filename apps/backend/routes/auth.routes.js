const express = require('express');
const { authController } = require('../controllers/auth.controller');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/login', authController.viewLogin);
router.post('/login', authController.login);
router.post('/session-location', authRequired, authController.setSessionLocation);
router.get('/register', authController.viewRegister);
router.post('/register', authController.register);
router.post('/logout', authController.logout);

module.exports = router;
