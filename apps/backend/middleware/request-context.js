const { randomUUID } = require('crypto');
const { logger } = require('../services/logger.service');

function requestContext(req, res, next) {
  const incomingRequestId = String(req.get('x-request-id') || '').trim();
  const requestId = incomingRequestId ? incomingRequestId.slice(0, 128) : randomUUID();

  req.requestId = requestId;
  req.requestStartAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);

  return next();
}

function requestLogger(req, res, next) {
  res.on('finish', () => {
    const startedAt = req.requestStartAt || process.hrtime.bigint();
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.info('http.request', {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?.id || null
    });
  });

  return next();
}

module.exports = { requestContext, requestLogger };
