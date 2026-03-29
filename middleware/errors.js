const { sendApiError } = require('./api-response');
const { logger } = require('../services/logger.service');

function notFoundHandler(req, res) {
  if (req.isApi) return sendApiError(req, res, 404, 'Not found', 'NOT_FOUND');
  return res.status(404).send('Not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Unexpected error';
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  logger.error('request.error', {
    requestId: req.requestId || null,
    status,
    code,
    message,
    path: req.originalUrl,
    method: req.method
  });

  if (req.isApi) return sendApiError(req, res, status, message, code);

  if (status >= 500) {
    return res.status(status).send('Unexpected error');
  }

  return res.status(status).send(message);
}

module.exports = { notFoundHandler, errorHandler };
