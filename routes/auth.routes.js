const express = require('express');
const { authController } = require('../controllers/auth.controller');

const router = express.Router();

router.get('/login', authController.viewLogin);
router.post('/login', authController.login);
router.get('/register', authController.viewRegister);
router.post('/register', authController.register);
router.post('/logout', authController.logout);

module.exports = router;
