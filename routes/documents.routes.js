const express = require('express');
const multer = require('multer');
const { authRequired } = require('../middleware/auth');
const { documentsController } = require('../controllers/documents.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload', authRequired, upload.single('file'), documentsController.upload);
router.get('/local/:blobName(*)', authRequired, documentsController.downloadLocal);
router.get('/:documentId/download', authRequired, documentsController.downloadLink);

module.exports = router;
