const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pharmacyController } = require('../controllers/pharmacy.controller');

const router = express.Router();

router.get('/orders', authRequired, pharmacyController.listOrders);
router.post('/orders', authRequired, pharmacyController.createOrder);
router.get('/orders/:orderId', authRequired, pharmacyController.viewOrder);
router.post('/orders/:orderId/status', authRequired, pharmacyController.updateOrderStatus);

module.exports = router;
