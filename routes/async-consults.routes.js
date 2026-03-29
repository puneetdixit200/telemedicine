const express = require('express');
const { authRequired } = require('../middleware/auth');
const { asyncConsultsController } = require('../controllers/async-consults.controller');

const router = express.Router();

router.get('/', authRequired, asyncConsultsController.listMine);
router.post('/', authRequired, asyncConsultsController.create);
router.get('/:consultId', authRequired, asyncConsultsController.viewOne);
router.post('/:consultId/replies', authRequired, asyncConsultsController.addReply);
router.post('/:consultId/close', authRequired, asyncConsultsController.close);

module.exports = router;
